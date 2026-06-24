import json

transcript_path = r"C:\Users\tharu\.gemini\antigravity\brain\b9f6b3d5-dbd9-4806-8c0a-0409580e1aca\.system_generated\logs\transcript_full.jsonl"
largest_content = ""

for line in open(transcript_path, 'r', encoding='utf-8'):
    try:
        step = json.loads(line)
        if 'content' in step and isinstance(step['content'], str) and "app.post('/api/reception/scan'" in step['content']:
            if len(step['content']) > len(largest_content):
                largest_content = step['content']
    except:
        pass

if largest_content:
    with open('largest_snippet.js', 'w', encoding='utf-8') as f:
        f.write(largest_content)
    print(f"Found snippet of length {len(largest_content)}")
else:
    print("Not found")
