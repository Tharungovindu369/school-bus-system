const fs = require('fs');
const readline = require('readline');
async function run() {
  const rl = readline.createInterface({
    input: fs.createReadStream('C:/Users/tharu/.gemini/antigravity/brain/b9f6b3d5-dbd9-4806-8c0a-0409580e1aca/.system_generated/logs/transcript_full.jsonl'),
    crlfDelay: Infinity
  });
  let maxLines = 0;
  let bestContent = '';
  for await (const line of rl) {
    if (line.includes("app.get('/api/buses'") || line.includes("app.post('/api/bus/start-return'")) {
      try {
        const step = JSON.parse(line);
        if (step.type === 'TOOL_RESPONSE' && step.content) {
          const lineCount = step.content.split('\n').length;
          if (lineCount > maxLines) {
            maxLines = lineCount;
            bestContent = step.content;
          }
        }
      } catch(e) {}
    }
  }
  console.log('Found max lines:', maxLines);
  fs.writeFileSync('best_index.txt', bestContent);
}
run();
