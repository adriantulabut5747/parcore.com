import urllib.request
import json
import os

API_KEY = os.environ.get('eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjU3OGJlNjAyLWUyNWMtNDY3ZS05ZTlkLTlmMjM0NzJjOTY2NyIsImlhdCI6MTc4MjU2NzM1NCwic3ViIjoiZGV2ZWxvcGVyLzM2MTAxNGYxLTAxODItNmIzZS03ZjhkLWY1N2ZkYTE3MTljOCIsInNjb3BlcyI6WyJjbGFzaCJdLCJsaW1pdHMiOlt7InRpZXIiOiJkZXZlbG9wZXIvc2lsdmVyIiwidHlwZSI6InRocm90dGxpbmcifSx7ImNpZHJzIjpbIjE3Mi4yMDIuMTAyLjIxMCJdLCJ0eXBlIjoiY2xpZW50In1dfQ.1QspQXGkYPJYVgDzdPx313DRqYzhY3wwMgFLYxaOb0svKiH4Y4YAzEw2RWtaCIL-LymXT4jGErHXGtv9oHSXAw')
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