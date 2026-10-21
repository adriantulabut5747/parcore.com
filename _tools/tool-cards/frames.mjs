// node frames.mjs <url> <w> <h> <mobile> <selector> <out-prefix> t1,t2,... (seconds)
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [url, w, h, mobile, sel, pre, ts, preJs] = process.argv.slice(2);
const port = 9300 + Math.floor(Math.random() * 500);
// sweep profiles earlier runs couldn't delete (Chrome's helpers can hold them past exit); ones in use just fail
for (const d of readdirSync(tmpdir())) if (d.startsWith('cdp-')) try { rmSync(join(tmpdir(), d), { recursive: true, force: true }); } catch {}
const prof = mkdtempSync(join(tmpdir(), 'cdp-'));
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target; for (let i = 0; i < 50 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { await sleep(200); } }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result?.value;
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 2, mobile: mobile === '1' });
await send('Page.enable'); await send('Page.navigate', { url }); await sleep(3500);
if (preJs) { await ev(preJs); await sleep(300); }
const box = await ev(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return {x:r.left+scrollX-8,y:r.top+scrollY-8,width:r.width+16,height:r.height+16}})()`);
for (const t of ts.split(',')) {
  await ev(`document.getAnimations().forEach(a=>{a.pause();a.currentTime=${+t * 1000};})`);
  await sleep(120);
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { ...box, scale: 1 } });
  writeFileSync(`${pre}-${t}.png`, Buffer.from(r.result.data, 'base64'));
}
// wait for Chrome to quit, then drop its throwaway profile (they filled the disk once)
ws.close(); proc.on('exit', () => { try { rmSync(prof, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); } catch {} process.exit(0); }); proc.kill();
