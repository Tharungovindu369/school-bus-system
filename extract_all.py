import json

transcript_path = r"C:\Users\tharu\.gemini\antigravity\brain\b9f6b3d5-dbd9-4806-8c0a-0409580e1aca\.system_generated\logs\transcript_full.jsonl"
count = 0

for line in open(transcript_path, 'r', encoding='utf-8'):
    try:
        step = json.loads(line)
        if 'content' in step and isinstance(step['content'], str) and "app.post('/api/reception/scan'" in step['content']:
            with open(f'snippet_{count}.js', 'w', encoding='utf-8') as f:
                f.write(step['content'])
            count += 1
    except:
        pass
print(f"Saved {count} snippets")
