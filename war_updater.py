import urllib.request
import json
import os

API_KEY = os.environ.get('COC_API_KEY', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6Ijg4YzYwOWRmLTRjNGQtNDE3Zi04NzYyLTM4ZGY0NTBjODg5YyIsImlhdCI6MTc4MjU2MjA0Mywic3ViIjoiZGV2ZWxvcGVyLzM2MTAxNGYxLTAxODItNmIzZS03ZjhkLWY1N2ZkYTE3MTljOCIsInNjb3BlcyI6WyJjbGFzaCJdLCJsaW1pdHMiOlt7InRpZXIiOiJkZXZlbG9wZXIvc2lsdmVyIiwidHlwZSI6InRocm90dGxpbmcifSx7ImNpZHJzIjpbIjEuMi4zLjQiXSwidHlwZSI6ImNsaWVudCJ9XX0.IBIDEUyX-G7JrM2Ivs40LYFpVa2eBO6hAm4KfCwvASzLPWfBTOhayvMWmboPZDGLLqOiRvYjhfX0famoYnddRg')
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