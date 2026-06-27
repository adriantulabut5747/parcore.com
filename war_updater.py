import urllib.request
import json
import os

EMAIL = os.environ.get('COC_EMAIL')
PASSWORD = os.environ.get('COC_PASSWORD')
KEY_NAME = 'apikeypaclash'
CLAN_TAG = '%232GYPGPJP9'
OUTPUT_FILE = 'war.json'

def get_my_ip():
    with urllib.request.urlopen('https://api.ipify.org?format=json') as r:
        return json.loads(r.read())['ip']

def login():
    data = json.dumps({'email': EMAIL, 'password': PASSWORD}).encode()
    req = urllib.request.Request(
        'https://developer.clashofclans.com/api/login',
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as r:
        result = json.loads(r.read())
        cookie = r.headers.get('Set-Cookie')
        return result, cookie

def get_keys(cookie):
    req = urllib.request.Request(
        'https://developer.clashofclans.com/api/apikey/list',
        headers={'Cookie': cookie}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def delete_key(cookie, key_id):
    data = json.dumps({'id': key_id}).encode()
    req = urllib.request.Request(
        'https://developer.clashofclans.com/api/apikey/revoke',
        data=data,
        headers={'Content-Type': 'application/json', 'Cookie': cookie}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def create_key(cookie, ip):
    data = json.dumps({
        'name': KEY_NAME,
        'description': 'autokey',
        'cidrRanges': [ip]
    }).encode()
    req = urllib.request.Request(
        'https://developer.clashofclans.com/api/apikey/create',
        data=data,
        headers={'Content-Type': 'application/json', 'Cookie': cookie}
    )
    with urllib.request.urlopen(req) as r:
        result = json.loads(r.read())
        return result['key']['key']

def get_war_data(api_key):
    url = f'https://api.clashofclans.com/v1/clans/{CLAN_TAG}/currentwar'
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {api_key}',
        'Accept': 'application/json'
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

try:
    print('Getting current IP...')
    my_ip = get_my_ip()
    print(f'IP: {my_ip}')

    print('Logging into Clash API...')
    _, cookie = login()

    print('Getting existing keys...')
    keys = get_keys(cookie)
    for key in keys.get('keys', []):
        if key['name'] == KEY_NAME:
            print(f'Deleting old key: {key["id"]}')
            delete_key(cookie, key['id'])

    print('Creating new key with current IP...')
    api_key = create_key(cookie, my_ip)
    print('Key created!')

    print('Fetching war data...')
    data = get_war_data(api_key)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(data, f)
    print('War data updated successfully!')
    print(f'War state: {data.get("state", "unknown")}')

except Exception as e:
    print(f'Error: {e}')