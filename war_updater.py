import urllib.request
import json
import os

API_KEY = os.environ.get('COC_API_KEY')
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