const fs = require('fs');
const readline = require('readline');

async function recover() {
  const rl = readline.createInterface({
    input: fs.createReadStream('C:/Users/tharu/.gemini/antigravity/brain/b9f6b3d5-dbd9-4806-8c0a-0409580e1aca/.system_generated/logs/transcript_full.jsonl'),
    crlfDelay: Infinity
  });

  // Start from the staged pristine version, decode it as utf16le just in case (we know it's utf16le)
  let fileContent = fs.readFileSync('server/index.js.staged', 'utf16le');
  // Strip BOM
  if (fileContent.charCodeAt(0) === 0xFEFF || fileContent.charCodeAt(0) === 0xFFFE) {
    fileContent = fileContent.slice(1);
  }

  for await (const line of rl) {
    try {
      const step = JSON.parse(line);
      if (step.tool_calls) {
        for (const call of step.tool_calls) {
          if (!call.args || !call.args.TargetFile || !call.args.TargetFile.includes('server/index.js')) continue;
          
          if (call.name.endsWith('replace_file_content')) {
            const target = call.args.TargetContent;
            const replacement = call.args.ReplacementContent;
            if (fileContent.includes(target)) {
              fileContent = fileContent.replace(target, replacement);
            } else {
              // Try to fallback to replacing just a smaller chunk if there's leading/trailing whitespace mismatches
              console.log('Missed target in replace_file_content');
            }
          }
          if (call.name.endsWith('multi_replace_file_content')) {
            const chunks = [...call.args.ReplacementChunks];
            for (const chunk of chunks) {
              const target = chunk.TargetContent;
              const replacement = chunk.ReplacementContent;
              if (fileContent.includes(target)) {
                fileContent = fileContent.replace(target, replacement);
              } else {
                console.log('Missed target in multi_replace_file_content');
              }
            }
          }
        }
      }
    } catch (e) {}
  }
  fs.writeFileSync('server/index.js.recovered2', fileContent, 'utf8');
  console.log('Recovered using string replace! Bytes:', Buffer.byteLength(fileContent, 'utf8'));
}

recover();
