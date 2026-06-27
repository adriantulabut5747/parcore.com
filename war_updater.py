import urllib.request
import json
import os

API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6ImE2ZmU2ZDViLTU1NjMtNDY4Mi05ZWFhLTkzOGU3ODNjNTE2MCIsImlhdCI6MTc4MjQ3ODgzMCwic3ViIjoiZGV2ZWxvcGVyLzM2MTAxNGYxLTAxODItNmIzZS03ZjhkLWY1N2ZkYTE3MTljOCIsInNjb3BlcyI6WyJjbGFzaCJdLCJsaW1pdHMiOlt7InRpZXIiOiJkZXZlbG9wZXIvc2lsdmVyIiwidHlwZSI6InRocm90dGxpbmcifSx7ImNpZHJzIjpbIjEzOC44NC43MS4xNjQiXSwidHlwZSI6ImNsaWVudCJ9XX0.TGLnadTYS6CVLlq9DpS96Ez3qlD47SE_j8jhKlshwHMpo-v4Nr9vXO7XieVOGZEK-AgkzaJEmGkJAoQtjvnjzw'
CLAN_TAG = '%232GYPGPJP9'
OUTPUT_FILE = 'war.json'

url = f'https://api.clashofclans.com/v1/clans/{CLAN_TAG}/currentwar'

req = urllib.request.Request(url, headers={
    'Authorization': f'Bearer {API_KEY}',
    'Accept': 'application/json'
})

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(data, f)
        print('War data updated successfully')
        print(f'War state: {data.get("state", "unknown")}')
except Exception as e:
    print(f'Error: {e}')