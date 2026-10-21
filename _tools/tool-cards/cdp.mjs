// node cdp.mjs <url> <w> <h> <mobile 0|1> [--js file.js] [--shot out.png] [--full]
// Drives headless Chrome over CDP: device emulation, eval, screenshot.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, w, h, mobile, ...rest] = process.argv.slice(2);
const opt = (k) => { const i = rest.indexOf(k); return i < 0 ? null : rest[i + 1]; };
const jsFile = opt('--js'), shot = opt('--shot'), full = rest.includes('--full');
const wait = +(opt('--wait') || 3500);
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// sweep profiles earlier runs couldn't delete (Chrome's helpers can hold them past exit); ones in use just fail
for (const d of readdirSync(tmpdir())) if (d.startsWith('cdp-')) try { rmSync(join(tmpdir(), d), { recursive: true, force: true }); } catch {}
const prof = mkdtempSync(join(tmpdir(), 'cdp-'));
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { await sleep(200); }
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const mob = mobile === '1';
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: mob });
if (mob) { await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] }); }
await send('Page.enable');
await send('Page.navigate', { url });
await sleep(wait);
if (jsFile) {
  const r = await send('Runtime.evaluate', { expression: readFileSync(jsFile, 'utf8'), awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(r.result.result?.value ?? r.result, null, 1));
  await sleep(600);
}
if (shot) {
  const p = { format: 'png' };
  if (full) { const m = await send('Page.getLayoutMetrics'); p.clip = { x: 0, y: 0, width: +w, height: m.result.cssContentSize.height, scale: 1 }; p.captureBeyondViewport = true; }
  const r = await send('Page.captureScreenshot', p);
  writeFileSync(shot, Buffer.from(r.result.data, 'base64'));
}
// wait for Chrome to quit, then drop its throwaway profile (they filled the disk once)
ws.close(); proc.on('exit', () => { try { rmSync(prof, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); } catch {} }); proc.kill();
process.exit(0);
