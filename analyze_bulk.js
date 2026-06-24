const fs = require('fs');
const path = require('path');
const dir = `C:\\Users\\tharu\\.gemini\\antigravity\\brain\\b9f6b3d5-dbd9-4806-8c0a-0409580e1aca\\.system_generated\\tasks`;

const files = fs.readdirSync(dir).filter(f => f.endsWith('.log'));
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  if (content.includes('Bulk Fee Update')) {
    const lines = content.split('\n').filter(l => l.includes('Bulk Fee Update'));
    if (lines.length > 0) {
      console.log(`--- ${file} ---`);
      console.log(lines.join('\n'));
    }
  }
}
