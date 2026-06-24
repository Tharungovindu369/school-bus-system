const fs = require('fs');
const readline = require('readline');

async function recover() {
  const rl = readline.createInterface({
    input: fs.createReadStream('C:/Users/tharu/.gemini/antigravity/brain/b9f6b3d5-dbd9-4806-8c0a-0409580e1aca/.system_generated/logs/transcript_full.jsonl'),
    crlfDelay: Infinity
  });

  let fileContent = fs.readFileSync('server/index.js.staged', 'utf16le');
  if (fileContent.charCodeAt(0) === 0xFEFF || fileContent.charCodeAt(0) === 0xFFFE) {
    fileContent = fileContent.slice(1);
  }
  
  // Normalize everything to LF
  fileContent = fileContent.replace(/\r\n/g, '\n');

  let patchCount = 0;

  for await (const line of rl) {
    try {
      const step = JSON.parse(line);
      if (step.tool_calls) {
        for (const call of step.tool_calls) {
          if (!call.args || !call.args.TargetFile || !call.args.TargetFile.includes('server/index.js')) continue;
          
          if (call.name.endsWith('replace_file_content')) {
            const target = call.args.TargetContent.replace(/\r\n/g, '\n');
            const replacement = call.args.ReplacementContent.replace(/\r\n/g, '\n');
            if (fileContent.includes(target)) {
              fileContent = fileContent.replace(target, replacement);
              patchCount++;
            } else {
              console.log('Missed target in replace_file_content');
            }
          }
          if (call.name.endsWith('multi_replace_file_content')) {
            const chunks = [...call.args.ReplacementChunks];
            for (const chunk of chunks) {
              const target = chunk.TargetContent.replace(/\r\n/g, '\n');
              const replacement = chunk.ReplacementContent.replace(/\r\n/g, '\n');
              if (fileContent.includes(target)) {
                fileContent = fileContent.replace(target, replacement);
                patchCount++;
              } else {
                console.log('Missed target in multi_replace_file_content');
              }
            }
          }
        }
      }
    } catch (e) {}
  }
  
  fs.writeFileSync('server/index.js.perfect', fileContent, 'utf8');
  console.log('Recovered bytes:', Buffer.byteLength(fileContent, 'utf8'), 'Patches applied:', patchCount);
}

recover();
