import urllib.request
import json
import os

API_KEY = os.environ.get('eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjcxOTNkM2JhLTQwYTctNDkzZS05MzllLWFlMjk0MjBhYmM0MyIsImlhdCI6MTc4MjU2NjM2Miwic3ViIjoiZGV2ZWxvcGVyLzM2MTAxNGYxLTAxODItNmIzZS03ZjhkLWY1N2ZkYTE3MTljOCIsInNjb3BlcyI6WyJjbGFzaCJdLCJsaW1pdHMiOlt7InRpZXIiOiJkZXZlbG9wZXIvc2lsdmVyIiwidHlwZSI6InRocm90dGxpbmcifSx7ImNpZHJzIjpbIjQ1Ljc5LjIxOC43OSJdLCJ0eXBlIjoiY2xpZW50In1dfQ.Hvg5Zj7VGmOA5For6opm11sQMR44m9m3rmrTeHiEhosKJ8YFhgk0LA0GPiEw43M977mLnwfaVRE1qMS64i0I4w')
CLAN_TAG = '%232GYPGPJP9'
OUTPUT_FILE = 'war.json'

url = f'https://cocproxy.royaleapi.dev/v1/clans/{CLAN_TAG}/currentwar'

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