import json
with open('C:/Users/tharu/.gemini/antigravity/brain/b9f6b3d5-dbd9-4806-8c0a-0409580e1aca/.system_generated/logs/transcript_full.jsonl', 'r', encoding='utf8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'RUN_COMMAND' or data.get('type') == 'TOOL_RESPONSE':
                content = data.get('content', '')
                if 'AdminDashboard.jsx' in content and 'Total Lines: 1165' in content:
                    print("Found view_file response!")
                    print(content[:200])
        except:
            pass
