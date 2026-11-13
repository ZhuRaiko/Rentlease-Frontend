// Execute the repository's TypeScript Node tests without emitting application files.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};

for (const name of fs.readdirSync(path.join(__dirname, '..', 'tests')).sort()) {
  if (name.endsWith('.test.ts')) require(path.join(__dirname, '..', 'tests', name));
}
