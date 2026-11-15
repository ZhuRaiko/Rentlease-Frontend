// Node test reporter used by scripts/run-tests.cjs. It writes one JSON line per finished test (and one for the run summary)
// to its destination, so the guard can compare the results with tests/known-failures.json. It prints nothing else.
module.exports = async function* testResultsReporter(source) {
  for await (const event of source) {
    if (event.type === 'test:pass' || event.type === 'test:fail') {
      const { name, file, nesting, skip, todo } = event.data;
      if (nesting !== 0) continue; // the suite has only top-level tests; ignore anything nested
      const status = event.type === 'test:fail' ? 'fail' : skip !== undefined && skip !== false ? 'skip' : todo !== undefined && todo !== false ? 'todo' : 'pass';
      yield `${JSON.stringify({ status, name, file })}\n`;
    } else if (event.type === 'test:summary') {
      yield `${JSON.stringify({ summary: true, counts: event.data.counts })}\n`;
    }
  }
};
