import json

transcript_path = r"C:\Users\tharu\.gemini\antigravity\brain\b9f6b3d5-dbd9-4806-8c0a-0409580e1aca\.system_generated\logs\transcript_full.jsonl"
recovered = None

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
            # Find when we view or get the file entirely, or multi_replace responses
            if 'content' in step and 'type' in step and step['type'] == 'TOOL_RESPONSE':
                output = step['content']
                # If we read the file using Get-Content earlier
                if "app.put('/api/fee/:id'" in output and "listen(config.port" in output:
                    recovered = output
        except:
            pass

if recovered:
    with open('recovered_index.js', 'w', encoding='utf-8') as f:
        f.write(recovered)
    print("Recovered!")
else:
    print("Not found")
