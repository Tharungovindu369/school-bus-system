import json
with open('C:/Users/tharu/.gemini/antigravity/brain/b9f6b3d5-dbd9-4806-8c0a-0409580e1aca/.system_generated/logs/transcript_full.jsonl', 'r', encoding='utf8') as f:
    diffs = []
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'PLANNER_RESPONSE':
                for call in data.get('tool_calls', []):
                    if call.get('name') in ['replace_file_content', 'multi_replace_file_content']:
                        args = call.get('args', {})
                        if 'AdminDashboard.jsx' in args.get('TargetFile', ''):
                            diffs.append(args)
        except:
            pass
    print(f"Found {len(diffs)} edits for AdminDashboard.jsx")
    for i, d in enumerate(diffs):
        print(f"Edit {i}: chunks={len(d.get('ReplacementChunks', []))}")
        for c in d.get('ReplacementChunks', []):
            print(f"  Line {c.get('StartLine')} - {c.get('EndLine')}")
