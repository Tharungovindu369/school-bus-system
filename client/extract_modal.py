import json

best = ''
for line in open('C:/Users/tharu/.gemini/antigravity/brain/b9f6b3d5-dbd9-4806-8c0a-0409580e1aca/.system_generated/logs/transcript_full.jsonl', 'r', encoding='utf-8'):
    if '3 Months' in line and 'UpdatePaymentModal' in line:
        try:
            j = json.loads(line)
            if j.get('type') == 'PLANNER_RESPONSE':
                for tc in j.get('tool_calls', []):
                    if tc.get('name') == 'default_api:multi_replace_file_content':
                        for chunk in tc.get('args', {}).get('ReplacementChunks', []):
                            if 'UpdatePaymentModal' in chunk.get('ReplacementContent', ''):
                                best = chunk.get('ReplacementContent', '')
        except:
            pass

with open('modal_extracted.jsx', 'w', encoding='utf-8') as f:
    f.write(best)
