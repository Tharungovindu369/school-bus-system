import json
res = ''
for line in open('C:/Users/tharu/.gemini/antigravity/brain/b9f6b3d5-dbd9-4806-8c0a-0409580e1aca/.system_generated/logs/transcript_full.jsonl', 'r', encoding='utf-8'):
    if 'Bus Reassignment' in line and 'import ManageCredentials' in line:
        res = line
with open('AdminDashboard_extracted.txt', 'w', encoding='utf-8') as f:
    f.write(res)
