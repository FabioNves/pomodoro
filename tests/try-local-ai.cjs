const path = require('node:path');
const assert = require('node:assert/strict');
const { createLocalAI } = require('../native/desktop/local-ai.cjs');
const ai = createLocalAI({ runtimeDirectory: path.resolve('native/desktop/ai-runtime') });
(async () => {
  try {
    assert(ai.status().available, 'Local model/runtime missing');
    for (const [text, action] of [
      ['I am struggling to focus today. Can you give me one small tip?', 'none'],
      ['Please pause my timer for a moment.', 'pause'],
      ['I would like to take a break now.', 'break'],
      ['Do not start a timer. Just tell me a short joke.', 'none'],
    ]) {
      const start = Date.now();
      const answer = await ai.ask(text);
      console.log(JSON.stringify({ text, ...answer, milliseconds: Date.now() - start }));
      assert.equal(answer.action, action);
    }
  } finally { ai.stop(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
