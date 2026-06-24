import json
import re

content = open('AdminDashboard_real_extracted.txt', 'r', encoding='utf-8').read()
try:
    j = json.loads(content)
except json.JSONDecodeError:
    print("Invalid JSON in extracted text")
    exit(1)

best_str = ""
def search_dict(d):
    global best_str
    for k, v in d.items():
        if isinstance(v, dict):
            search_dict(v)
        elif isinstance(v, list):
            for i in v:
                if isinstance(i, dict):
                    search_dict(i)
                elif isinstance(i, str):
                    if 'import ManageCredentials' in i and len(i) > len(best_str):
                        best_str = i
        elif isinstance(v, str):
            if 'import ManageCredentials' in v and len(v) > len(best_str):
                best_str = v

search_dict(j)
print("Found string of length:", len(best_str))
with open('AdminDashboard_perfect.jsx', 'w', encoding='utf-8') as f:
    f.write(best_str)
