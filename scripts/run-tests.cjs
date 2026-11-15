// `npm test`: runs the whole suite and fails only on failures that are not on the committed known-failures list.
//
// What runs in Node is unchanged: scripts/run-test-suite.cjs is the previous runner, byte for byte (one process, every
// tests/*.test.ts, the same `.ts` loader). This wrapper starts it in a child process with a reporter that records each test's
// result, then compares the results with tests/known-failures.json:
//   - a failing test that is not on the list fails the run (exit 1);
//   - a listed test that now passes is reported, so the entry can be deleted (this does not fail the run);
//   - a listed test that no longer exists is reported, so a rename cannot hide a failure (this does not fail the run);
//   - a run that did not finish (a test file threw while loading, the process crashed) fails the run.
// The list is for tests that already fail; add to it only on purpose, with a reason, and delete entries as the tests are fixed.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const knownPath = path.join(root, 'tests', 'known-failures.json');
const keyOf = (file, name) => `${file}::${name}`;
const relative = (file) => path.relative(root, file).split(path.sep).join('/');
const fatal = (message) => { console.error(`\nKnown-failures guard: ${message}`); process.exit(1); };

function readKnownFailures() {
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(knownPath, 'utf8')); } catch (error) { return fatal(`cannot read tests/known-failures.json (${error.message})`); }
  if (!parsed || !Array.isArray(parsed.failures)) return fatal('tests/known-failures.json must be { "failures": [ { "file", "name", "reason" } ] }');
  const known = new Map();
  for (const entry of parsed.failures) {
    if (!entry || typeof entry.file !== 'string' || typeof entry.name !== 'string' || typeof entry.reason !== 'string' || !entry.reason.trim()) return fatal(`every entry needs a string file, name and non-empty reason: ${JSON.stringify(entry)}`);
    const key = keyOf(entry.file, entry.name);
    if (known.has(key)) return fatal(`duplicate entry for ${key}`);
    known.set(key, entry);
  }
  return known;
}

const known = readKnownFailures();
const resultsPath = path.join(os.tmpdir(), `rentlease-test-results-${process.pid}.jsonl`);
fs.rmSync(resultsPath, { force: true });

const child = spawnSync(process.execPath, [
  '--test-reporter=spec', '--test-reporter-destination=stdout',
  // A reporter given by absolute path must be a file:// URL on Windows.
  `--test-reporter=${pathToFileURL(path.join(__dirname, 'test-results-reporter.cjs')).href}`, `--test-reporter-destination=${resultsPath}`,
  path.join(__dirname, 'run-test-suite.cjs'),
], { stdio: 'inherit', cwd: process.cwd() });

let lines = [];
try { lines = fs.readFileSync(resultsPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)); } catch { /* handled below as an unfinished run */ }
fs.rmSync(resultsPath, { force: true });
const summary = lines.find((line) => line.summary);
// Two tests in one file may share a name, so keep every status per key: a key fails if any test with that name fails.
const statuses = new Map();
const finished = lines.filter((line) => !line.summary);
for (const line of finished) { const key = keyOf(relative(line.file), line.name); statuses.set(key, [...(statuses.get(key) ?? []), line.status]); }
const results = new Map([...statuses].map(([key, list]) => [key, list.includes('fail') ? 'fail' : list.every((status) => status === 'pass') ? 'pass' : list[0]]));

console.log('\nKnown-failures guard (tests/known-failures.json)');
if (!summary) {
  console.log('  FAIL: the run did not finish, so no result can be trusted (a test file may have thrown while loading).');
  process.exit(1);
}
const failed = [...results].filter(([, status]) => status === 'fail').map(([key]) => key);
const unexpected = failed.filter((key) => !known.has(key));
const knownFailing = failed.filter((key) => known.has(key));
const nowPassing = [...known.keys()].filter((key) => results.get(key) === 'pass');
const notFound = [...known.keys()].filter((key) => !results.has(key));
const show = (title, keys) => { console.log(`  ${title}`); for (const key of keys) console.log(`    - ${key.replace('::', '  >  ')}`); };

console.log(`  ${finished.length} tests: ${failed.length} failing (${knownFailing.length} known, ${unexpected.length} not on the list); ${known.size} on the list.`);
if (nowPassing.length) show(`${nowPassing.length} listed test(s) now PASS. Delete these entries from tests/known-failures.json:`, nowPassing);
if (notFound.length) show(`${notFound.length} listed test(s) were not found in this run (renamed or deleted?). Fix or delete these entries:`, notFound);
if (unexpected.length) {
  show(`FAIL: ${unexpected.length} failing test(s) are not on the known-failures list:`, unexpected);
  process.exit(1);
}
if (child.status !== 0 && failed.length === 0) {
  console.log(`  FAIL: the test process exited with status ${child.status} although no test failed (an error outside a test).`);
  process.exit(1);
}
console.log(knownFailing.length ? `  OK: every failing test is a known failure (${knownFailing.length} remain on the list).` : '  OK: no failing tests.');
