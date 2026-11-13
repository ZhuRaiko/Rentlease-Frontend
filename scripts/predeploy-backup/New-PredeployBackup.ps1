<#
.SYNOPSIS
  Scoped, read-only predeployment recovery backup for ONE RentLease migration.

.DESCRIPTION
  Captures, for an explicit scope you pass in: schema-only dumps (Supabase CLI db dump), a roles-only dump, machine-readable catalog exports
  (migration history, function definitions, owners, ACLs, security-definer flags, md5(prosrc), triggers, RLS policies, indexes, constraints),
  row counts and md5 fingerprints of affected tables (no row data is stored), and the reviewed forward/rollback SQL. It then proves the live
  database did not change during the capture, restricts the folder with ACLs, writes a SHA-256 manifest, re-reads and re-verifies every file,
  and writes a receipt.

  READ-ONLY toward the hosted project: it never migrates, deploys, restores or writes. No passwords, tokens or keys are accepted or stored;
  the Supabase CLI's existing login and linked project are used. Needs Docker Desktop running (the CLI runs pg_dump in a container).
  This is a SCOPED RECOVERY backup, not full disaster recovery. See README.md in this folder.

.EXAMPLE
  .\New-PredeployBackup.ps1 -Feature admin-access -ExpectedProjectRef cxfsbwbwmwmgtqfonqth `
    -Schemas public,rentlease_reporting `
    -Functions public.get_rental_report,public.get_rental_reports,public.moderate_rental_report,public.is_admin,public.has_app_role,public.is_tier1_verified `
    -Tables public.reports,rentlease_reporting.cases,rentlease_reporting.events,rentlease_reporting.receipts `
    -ForwardSql supabase\migrations\20261112155016_admin_reports_access.sql -RollbackSql supabase\test-support\admin_reports_access_rollback.sql
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9]+(-[a-z0-9]+)*$')][string]$Feature,
  [Parameter(Mandatory)][ValidatePattern('^[a-z]{20}$')][string]$ExpectedProjectRef,
  [Parameter(Mandatory)][string[]]$Schemas,
  [Parameter(Mandatory)][string[]]$Functions,
  [Parameter(Mandatory)][string[]]$Tables,
  [string]$ForwardSql,
  [string]$RollbackSql,
  [string]$OutputRoot = 'C:\RentLease-Backups',
  [string]$RepoRoot,
  [string]$Notes = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

# `powershell -File` passes "a,b" as ONE string; accept both forms.
function Split-List([string[]]$Values) { @($Values | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
$Schemas = Split-List $Schemas; $Functions = Split-List $Functions; $Tables = Split-List $Tables

# ---- Validate every identifier that will be placed in SQL text
foreach ($s in $Schemas)   { if ($s -notmatch '^[a-z_][a-z0-9_]*$') { throw "Invalid schema name: $s" } }
foreach ($f in $Functions) { if ($f -notmatch '^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$') { throw "Invalid function (use schema.name): $f" } }
foreach ($t in $Tables)    { if ($t -notmatch '^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$') { throw "Invalid table (use schema.table): $t" } }
foreach ($f in $Functions) { if ($Schemas -notcontains $f.Split('.')[0]) { throw "Function $f is outside the declared schemas" } }
if (-not $RepoRoot) { $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Write-Text([string]$Path, [string]$Text) { [System.IO.File]::WriteAllText($Path, $Text, $utf8) }

# ---- Tooling
$cli = Join-Path $RepoRoot 'node_modules\.bin\supabase.cmd'
if (-not (Test-Path $cli)) { $found = Get-Command supabase.cmd -ErrorAction SilentlyContinue; if ($found) { $cli = $found.Source } else { throw 'Supabase CLI (supabase.cmd) not found' } }

function Invoke-Native([string]$File, [string[]]$Arguments, [string]$StdoutPath, [string]$StderrPath) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $env:ComSpec
  $psi.Arguments = '/c ""' + $File + '" ' + (($Arguments | ForEach-Object { '"' + $_ + '"' }) -join ' ') + '"'
  $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true; $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
  $psi.StandardOutputEncoding = $utf8; $psi.StandardErrorEncoding = $utf8; $psi.WorkingDirectory = $RepoRoot
  $p = [System.Diagnostics.Process]::Start($psi)
  $outTask = $p.StandardOutput.ReadToEndAsync(); $errTask = $p.StandardError.ReadToEndAsync()
  $p.WaitForExit()
  if ($StdoutPath) { Write-Text $StdoutPath $outTask.Result }
  if ($StderrPath) { Write-Text $StderrPath $errTask.Result }
  return [pscustomobject]@{ Exit = $p.ExitCode; Out = $outTask.Result; Err = $errTask.Result }
}
Add-Type -AssemblyName System.Web.Extensions
function ConvertFrom-BigJson([string]$Text) { $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer; $ser.MaxJsonLength = [int]::MaxValue; $ser.RecursionLimit = 1000; return $ser.DeserializeObject($Text) }

# ---- Preflight: project, CLI, Docker, history. Nothing is written yet.
$linked = (Get-Content (Join-Path $RepoRoot 'supabase\.temp\project-ref') -Raw).Trim()
if ($linked -ne $ExpectedProjectRef) { throw "Linked project '$linked' does not match expected '$ExpectedProjectRef'. Refusing to run." }
$cliVersion = (Invoke-Native $cli @('--version')).Out.Trim()
$dumpHelp = Invoke-Native $cli @('db', 'dump', '--help')
if ($dumpHelp.Exit -ne 0 -or $dumpHelp.Out -notmatch '--role-only') { throw 'supabase db dump --help did not describe the expected flags' }
$dockerServer = (& docker version --format '{{.Server.Version}}' 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $dockerServer) { throw 'Docker daemon is not running (needed for pg_dump). Start Docker Desktop and retry.' }
$gitCommit = (& git -C $RepoRoot rev-parse HEAD).Trim(); $gitDirty = [bool](& git -C $RepoRoot status --porcelain)

# ---- Protected folder first, so every file inherits the restricted ACL
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
$Dir = Join-Path $OutputRoot "$Feature-predeploy-$stamp"
if (Test-Path $Dir) { throw "Backup folder already exists: $Dir" }
New-Item -ItemType Directory -Path $Dir -Force | Out-Null
$me = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$allowedSids = @($me, 'S-1-5-18', 'S-1-5-32-544')
$icacls = & icacls $Dir /inheritance:r /grant:r "*${me}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F'
if ($LASTEXITCODE -ne 0) { throw "icacls failed: $icacls" }

$steps = New-Object System.Collections.ArrayList
function Add-Step([string]$Name, $Result, [string]$Path) {
  $bytes = if ($Path -and (Test-Path $Path)) { (Get-Item $Path).Length } else { 0 }
  [void]$steps.Add([pscustomobject]@{ step = $Name; exit = $Result.Exit; bytes = $bytes; file = if ($Path) { Split-Path $Path -Leaf } else { $null } })
  if ($Result.Exit -ne 0) { throw "$Name failed with exit code $($Result.Exit): $($Result.Err)" }
  if ($Path -and $bytes -lt 20) { throw "$Name produced empty output ($Path)" }
}
function Invoke-LinkedQuery([string]$Name, [string]$Sql) {
  $sqlPath = Join-Path $Dir "$Name.sql"; $jsonPath = Join-Path $Dir "$Name.json"; Write-Text $sqlPath $Sql
  $r = Invoke-Native $cli @('db', 'query', '--linked', '-f', $sqlPath, '-o', 'json') $jsonPath (Join-Path $Dir "$Name.log")
  Add-Step "query:$Name" $r $jsonPath
}

# ---- SQL (identifiers validated above)
$list = ($Schemas | ForEach-Object { "'$_'" }) -join ','
$catalogSql = @'
with s as (
select 'history' k,(select jsonb_agg(to_jsonb(m) order by version) from supabase_migrations.schema_migrations m) v
union all select 'schemas',(select jsonb_agg(nspname order by nspname) from pg_namespace where nspname in (<<L>>))
union all select 'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text[],'owner',pg_get_userbyid(c.relowner)) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p','v','m') and n.nspname in (<<L>>))
union all select 'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'identity',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text[],'secdef',p.prosecdef,'config',p.proconfig,'volatile',p.provolatile,'md5_prosrc',md5(p.prosrc)) order by n.nspname,p.proname,p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind in('f','p') and n.nspname in (<<L>>))
union all select 'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in (<<L>>))
union all select 'columns',(select jsonb_agg(to_jsonb(c) order by table_schema,table_name,ordinal_position) from information_schema.columns c where table_schema in (<<L>>))
union all select 'triggers',(select jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'definition',pg_get_triggerdef(t.oid)) order by t.tgrelid::regclass::text,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in (<<L>>))
union all select 'constraints',(select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) order by c.conrelid::regclass::text,c.conname) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in (<<L>>))
union all select 'indexes',(select jsonb_agg(to_jsonb(i) order by schemaname,tablename,indexname) from pg_indexes i where schemaname in (<<L>>))
union all select 'table_grants',(select jsonb_agg(to_jsonb(g) order by table_schema,table_name,grantee,privilege_type) from information_schema.table_privileges g where table_schema in (<<L>>))
union all select 'column_grants',(select jsonb_agg(to_jsonb(g) order by table_schema,table_name,column_name,grantee,privilege_type) from information_schema.column_privileges g where table_schema in (<<L>>))
union all select 'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'inherit',rolinherit,'createrole',rolcreaterole,'createdb',rolcreatedb,'login',rolcanlogin,'bypassrls',rolbypassrls) order by rolname) from pg_roles)
)
select (select jsonb_object_agg(k,coalesce(v,'null'::jsonb)) from s) as snapshot,(select jsonb_object_agg(k,md5(coalesce(v,'null'::jsonb)::text)) from s) as section_md5
'@ -replace '<<L>>', $list
$fingerprintSql = 'select jsonb_build_object(' + (($Tables | ForEach-Object { "'$_',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),''))) from $_ t)" }) -join ',') + ') as snapshot'
$pairs = ($Functions | ForEach-Object { $a = $_.Split('.'); "('$($a[0])','$($a[1])')" }) -join ','
$functionSql = "select jsonb_agg(jsonb_build_object('identity',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')','schema',n.nspname,'name',p.proname,'md5_prosrc',md5(p.prosrc),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text[],'secdef',p.prosecdef,'config',p.proconfig,'volatile',p.provolatile) order by n.nspname,p.proname,p.oid::regprocedure::text) as functions from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname,p.proname) in ($pairs)"
$historySql = 'select jsonb_agg(m.version order by m.version) as versions, count(*) as rows from supabase_migrations.schema_migrations m'

# ---- Capture
Invoke-LinkedQuery 'catalog-before' $catalogSql
Invoke-LinkedQuery 'data-fingerprints-before' $fingerprintSql
Invoke-LinkedQuery 'scope-functions' $functionSql
Invoke-LinkedQuery 'migration-history' $historySql
$ml = Invoke-Native $cli @('migration', 'list', '--linked', '-o', 'json') (Join-Path $Dir 'migration-list-local-vs-remote.json') (Join-Path $Dir 'migration-list.log'); Add-Step 'migration-list' $ml (Join-Path $Dir 'migration-list-local-vs-remote.json')
$schemaFile = Join-Path $Dir 'schema.sql'; $rolesFile = Join-Path $Dir 'roles.sql'
$d1 = Invoke-Native $cli @('db', 'dump', '--linked', '--schema', ($Schemas -join ','), '-f', $schemaFile) $null (Join-Path $Dir 'schema-cli.log'); Add-Step 'dump:schema-only' $d1 $schemaFile
$d2 = Invoke-Native $cli @('db', 'dump', '--linked', '--role-only', '-f', $rolesFile) $null (Join-Path $Dir 'roles-cli.log'); Add-Step 'dump:roles-only' $d2 $rolesFile
$schemaText = [System.IO.File]::ReadAllText($schemaFile)
foreach ($f in $Functions) { $name = $f.Split('.')[1]; if ($schemaText -notmatch [regex]::Escape($name)) { throw "schema.sql does not mention in-scope function $f" } }
Invoke-LinkedQuery 'catalog-after' $catalogSql
Invoke-LinkedQuery 'data-fingerprints-after' $fingerprintSql

# ---- Reviewed source (kept separate from dumps)
$src = Join-Path $Dir 'reviewed-source'; New-Item -ItemType Directory -Path $src | Out-Null
$sourceHashes = [ordered]@{}
foreach ($pair in @(@('forward', $ForwardSql), @('rollback', $RollbackSql))) {
  if ($pair[1]) {
    $p = if ([System.IO.Path]::IsPathRooted($pair[1])) { $pair[1] } else { Join-Path $RepoRoot $pair[1] }
    if (-not (Test-Path $p)) { throw "$($pair[0]) SQL not found: $p" }
    Copy-Item $p (Join-Path $src (Split-Path $p -Leaf))
    $raw = [System.IO.File]::ReadAllBytes($p); $lf = $utf8.GetBytes(([System.IO.File]::ReadAllText($p) -replace "`r`n", "`n"))
    $sourceHashes[$pair[0]] = [ordered]@{ file = (Split-Path $p -Leaf); sha256_raw = (Get-FileHash $p -Algorithm SHA256).Hash.ToLower(); sha256_lf_normalized = ([BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($lf)) -replace '-', '').ToLower() }
  } else {
    $sourceHashes[$pair[0]] = 'NOT SUPPLIED'
    Write-Text (Join-Path $src "$($pair[0])-NOT-SUPPLIED.txt") "No $($pair[0]) SQL was supplied for this backup scope. Nothing was invented. Re-run this script, with the reviewed file, immediately before applying a migration."
  }
}
Write-Text (Join-Path $Dir 'reviewed-source-hashes.json') ($sourceHashes | ConvertTo-Json -Depth 5)

# ---- Prove the live database did not change during the capture
$before = ConvertFrom-BigJson (Get-Content (Join-Path $Dir 'catalog-before.json') -Raw); $after = ConvertFrom-BigJson (Get-Content (Join-Path $Dir 'catalog-after.json') -Raw)
$mb = $before['rows'][0]['section_md5']; $ma = $after['rows'][0]['section_md5']
$changedSections = @($mb.Keys | Where-Object { $mb[$_] -ne $ma[$_] })
$fb = Get-Content (Join-Path $Dir 'data-fingerprints-before.json') -Raw; $fa = Get-Content (Join-Path $Dir 'data-fingerprints-after.json') -Raw
$fbo = (ConvertFrom-BigJson $fb)['rows'][0]['snapshot']; $fao = (ConvertFrom-BigJson $fa)['rows'][0]['snapshot']
$changedTables = @($fbo.Keys | Where-Object { ($fbo[$_]['count'] -ne $fao[$_]['count']) -or ($fbo[$_]['md5'] -ne $fao[$_]['md5']) })
$rowCounts = [ordered]@{}; foreach ($k in $fbo.Keys) { $rowCounts[$k] = [ordered]@{ before = $fbo[$k]['count']; after = $fao[$k]['count'] } }
$hist = (ConvertFrom-BigJson (Get-Content (Join-Path $Dir 'migration-history.json') -Raw))['rows'][0]
$fnRows = (ConvertFrom-BigJson (Get-Content (Join-Path $Dir 'scope-functions.json') -Raw))['rows'][0]['functions']
foreach ($f in $Functions) { $n = $f.Split('.'); if (-not (@($fnRows | Where-Object { $_['schema'] -eq $n[0] -and $_['name'] -eq $n[1] }).Count)) { throw "In-scope function not found in the live catalog: $f" } }
$comparison = [ordered]@{ schema_and_catalog_unchanged = ($changedSections.Count -eq 0); changed_catalog_sections = $changedSections; scoped_records_unchanged = ($changedTables.Count -eq 0); changed_tables = $changedTables; row_counts = $rowCounts; migration_history_rows = $hist['rows']; migration_history_versions = $hist['versions']; data_consistency = 'Catalog and fingerprints are read in separate queries; live activity may postdate a snapshot' }
Write-Text (Join-Path $Dir 'before-after-comparison.json') ($comparison | ConvertTo-Json -Depth 6)
if (-not $comparison.schema_and_catalog_unchanged) { Write-Warning "Catalog changed during capture: $($changedSections -join ', ')" }

# ---- Scope, versions, secret scan
$scope = [ordered]@{ feature = $Feature; project = $linked; created_utc = (Get-Date).ToUniversalTime().ToString('o'); schemas = $Schemas; functions = $Functions; tables_counted = $Tables; commit = $gitCommit; working_tree_dirty = $gitDirty
  tools = [ordered]@{ supabase_cli = $cliVersion; docker_server = $dockerServer; powershell = $PSVersionTable.PSVersion.ToString() }
  omitted = @('Auth users, passwords and sessions', 'Storage object bytes', 'Row data of any table (only counts and md5 fingerprints are stored)', 'Unrelated schemas and data', 'Edge Function source and secrets', 'Point-in-time recovery or a full database dump')
  limitations = 'Scoped same-project recovery material: schema-only dump, roles-only dump, catalog, ACLs, policies, functions and history for the declared scope. Not full disaster recovery. A hosted restore was not tested; do not replay roles.sql wholesale.'; notes = $Notes }
Write-Text (Join-Path $Dir 'backup-scope.json') ($scope | ConvertTo-Json -Depth 6)
$patterns = [ordered]@{ jwt = 'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.'; supabase_secret = 'sb_secret_|sbp_[a-f0-9]{20,}'; connection_string_with_password = 'postgres(ql)?://[^\s:]+:[^\s@]+@'; role_password = "(?i)\bPASSWORD\s+'" }
$scanHits = @(); foreach ($file in Get-ChildItem $Dir -Recurse -File) { $t = [System.IO.File]::ReadAllText($file.FullName); foreach ($k in $patterns.Keys) { if ($t -match $patterns[$k]) { $scanHits += "$($file.Name):$k" } } }
if ($scanHits.Count) { throw "Secret-like content found: $($scanHits -join ', '). Folder left in place for review: $Dir" }

# ---- Receipt (before the manifest so it is covered by it)
$fnTable = ($fnRows | ForEach-Object { "| ``$($_['identity'])`` | $($_['md5_prosrc']) | $($_['secdef']) | $($_['owner']) |" }) -join "`n"
$stepTable = ($steps | ForEach-Object { "| $($_.step) | $($_.exit) | $($_.bytes) |" }) -join "`n"
$receipt = @"
# Predeployment backup receipt: $Feature

- Project: ``$linked`` (matched expected ``$ExpectedProjectRef``)
- Created (UTC): $($scope.created_utc)
- Folder: ``$Dir``
- Schemas: $($Schemas -join ', ')
- Supabase CLI $cliVersion; Docker server $dockerServer; PowerShell $($PSVersionTable.PSVersion)
- Repo commit: $gitCommit (working tree dirty: $gitDirty)
- Migration history: $($hist['rows']) rows; latest $(@($hist['versions'])[-1])
- Live database unchanged during capture: catalog $($comparison.schema_and_catalog_unchanged), scoped records $($comparison.scoped_records_unchanged)
- Restore test performed: NO. These are scoped recovery backups, not full disaster recovery.

## Steps and exit codes
| Step | Exit | Bytes |
| --- | --- | --- |
$stepTable

## In-scope functions (md5 of prosrc)
| Function | md5(prosrc) | security definer | owner |
| --- | --- | --- | --- |
$fnTable

## Reviewed source
Forward: $(if ($sourceHashes['forward'] -is [string]) { $sourceHashes['forward'] } else { $sourceHashes['forward']['file'] + ' sha256 ' + $sourceHashes['forward']['sha256_lf_normalized'] + ' (LF-normalized)' })
Rollback: $(if ($sourceHashes['rollback'] -is [string]) { $sourceHashes['rollback'] } else { $sourceHashes['rollback']['file'] + ' sha256 ' + $sourceHashes['rollback']['sha256_lf_normalized'] + ' (LF-normalized)' })

## Omitted
$(($scope.omitted | ForEach-Object { "- $_" }) -join "`n")

## Limitations
$($scope.limitations)

SHA-256 manifest, ACL and re-read verification results are in ``sha256-manifest.json`` and the final console summary / ``final-verification.json`` (the latter is written after the manifest and is not listed in it).
"@
Write-Text (Join-Path $Dir 'RECEIPT.md') $receipt

# ---- Manifest, then re-read and re-verify every file
$manifestPath = Join-Path $Dir 'sha256-manifest.json'
$entries = foreach ($file in (Get-ChildItem $Dir -Recurse -File | Where-Object { $_.FullName -ne $manifestPath } | Sort-Object FullName)) { [ordered]@{ path = $file.FullName.Substring($Dir.Length + 1); bytes = $file.Length; sha256 = (Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLower() } }
Write-Text $manifestPath (@($entries) | ConvertTo-Json -Depth 4)
$mismatch = @(); $empty = @(); foreach ($e in (Get-Content $manifestPath -Raw | ConvertFrom-Json)) { $f = Join-Path $Dir $e.path; if (-not (Test-Path $f)) { $mismatch += $e.path; continue }; if ((Get-Item $f).Length -eq 0) { $empty += $e.path }; if ((Get-FileHash $f -Algorithm SHA256).Hash.ToLower() -ne $e.sha256) { $mismatch += $e.path } }

# ---- ACL verification (icacls output is recorded; SIDs are compared, not names)
$items = @(Get-Item $Dir) + @(Get-ChildItem $Dir -Recurse); $bad = @()
foreach ($item in $items) { foreach ($rule in (Get-Acl $item.FullName).Access) { $sid = $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value; if ($allowedSids -notcontains $sid) { $bad += "$($item.Name):$sid" } } }
$rootProtected = (Get-Acl $Dir).AreAccessRulesProtected
$final = [ordered]@{ manifest_entries = @($entries).Count; files_reread = @($entries).Count; hash_mismatches = $mismatch; empty_files = $empty; acl_items_checked = $items.Count; root_inheritance_disabled = $rootProtected; unexpected_principals = $bad; allowed = 'Current Windows user, SYSTEM, Administrators only'; icacls_root = (& icacls $Dir) -join "`n" }
Write-Text (Join-Path $Dir 'final-verification.json') ($final | ConvertTo-Json -Depth 4)
if ($mismatch.Count -or $empty.Count -or $bad.Count -or -not $rootProtected) { throw "Verification failed: mismatches=$($mismatch -join ',') empty=$($empty -join ',') acl=$($bad -join ',') protected=$rootProtected" }

Write-Output ([pscustomobject]@{ Folder = $Dir; Files = (@($entries).Count + 2); Project = $linked; CatalogUnchanged = $comparison.schema_and_catalog_unchanged; RecordsUnchanged = $comparison.scoped_records_unchanged; HistoryRows = $hist['rows']; HashMismatches = 0; AclItemsChecked = $items.Count })
