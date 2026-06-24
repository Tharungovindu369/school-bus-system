import json
import re

transcript_path = r"C:\Users\tharu\.gemini\antigravity\brain\b9f6b3d5-dbd9-4806-8c0a-0409580e1aca\.system_generated\logs\transcript.jsonl"

for line in open(transcript_path, 'r', encoding='utf-8'):
    if "The following changes were made by the multi_replace_file_content tool to: D:\\school-bus-system\\server\\index.js" in line:
        diff_match = re.search(r'\[diff_block_start\](.*?)\[diff_block_end\]', line, re.DOTALL)
        if diff_match:
            diff = diff_match.group(1)
            with open('diff_out.txt', 'w', encoding='utf-8') as f:
                f.write(diff)
            print("Found diff!")
