// 전시장 TV(/wall/) 프레임 측정. macOS Google Chrome을 헤드리스로 띄우고 CPU를 느리게 해서 저사양 맥을 흉내 낸다.
// 사용: node tools/perf/bench.mjs [주소] [옵션]
//   --throttle=6     CPU 느리게 하는 배수 (1 = 이 맥 그대로)
//   --size=1280x800  화면 크기(CSS 픽셀)   --dpr=2  레티나 배율
//   --warm=12 --secs=10   기다리는 시간, 재는 시간(초)
//   --shot=파일.png  마지막 화면 저장   --gpu  GPU로 그리기 (기본은 CPU로만 그림)
//   --min=50  타워에 이만큼 올라올 때까지 기다림(최대 --warm초)
// 실제 하드웨어(GPU, 디스플레이)와는 다르다. 같은 조건에서 두 버전을 비교하는 용도.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v = 'true'] = a.slice(2).split('='); return [k, v];
}));
const url = process.argv.slice(2).find(a => !a.startsWith('--')) || 'http://127.0.0.1:8766/wall/';
const throttle = Number(args.throttle || 1);
const [W, H] = (args.size || '1280x800').split('x').map(Number);
const dpr = Number(args.dpr || 2);
const warm = Number(args.warm || 12), secs = Number(args.secs || 10);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const port = await new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const profile = mkdtempSync(join(tmpdir(), 'tower-bench-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, '--no-first-run', '--no-default-browser-check', '--mute-audio',
  // GPU 없이 CPU로 그리게 해서, CPU를 느리게 하면 그리기도 같이 느려지게 한다 (오래된 내장 그래픽 흉내)
  ...(args.gpu === 'true' ? [] : ['--disable-gpu', '--disable-accelerated-2d-canvas', '--disable-gpu-compositing']),
  'about:blank',
], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill('SIGKILL'); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} };
process.on('exit', cleanup);

let target;
for (let i = 0; i < 50 && !target; i++) {
  await new Promise(r => setTimeout(r, 200));
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
}
if (!target) { console.error('Chrome에 연결하지 못함'); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 0; const waiting = new Map(); const errors = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise(r => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: dpr, mobile: false });
await send('Emulation.setCPUThrottlingRate', { rate: throttle });
await send('Page.navigate', { url });
const minSnails = Number(args.min || 50);
const startWait = Date.now();
while (Date.now() - startWait < warm * 1000) {
  await new Promise(r => setTimeout(r, 1000));
  const n = await evaluate(`typeof snails !== 'undefined' && document.querySelector('#stage canvas') ? snails.length : -1`);
  if (n >= minSnails) break;
}
await new Promise(r => setTimeout(r, 3000));

// 그리기 함수별 시간 (전역 함수를 감싸서 잰다)
await evaluate(`(() => {
  const t = window.__cost = {};
  const wrap = (name, owner = window) => {
    const f = owner[name]; if (typeof f !== 'function') return;
    owner[name] = function (...a) { const s = performance.now(); try { return f.apply(this, a); } finally { t[name] = (t[name] || 0) + performance.now() - s; } };
  };
  ['draw', 'drawLeaf', 'drawPillar', 'drawSnail', 'drawPortal', 'drawPart', 'drawBoxes', 'updateSnails', 'updateParts'].forEach(n => wrap(n));
  if (typeof SnailArt !== 'undefined') ['renderSprite', 'drawSlime', 'updateSlime'].forEach(n => wrap(n, SnailArt.prototype));
  const di = CanvasRenderingContext2D.prototype; wrap('drawImage', di); wrap('createRadialGradient', di);
  return true;
})()`);

const result = await evaluate(`new Promise(done => {
  const times = []; let last = performance.now(); const end = last + ${secs * 1000};
  for (const k in window.__cost) window.__cost[k] = 0;
  const step = now => { times.push(now - last); last = now; if (now < end) requestAnimationFrame(step); else finish(); };
  const finish = () => {
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const pct = q => times[Math.min(times.length - 1, Math.floor(q * times.length))];
    const cost = {}; for (const k in window.__cost) cost[k] = +(window.__cost[k] / times.length).toFixed(2);
    done({ frames: times.length, fps: +(1000 / avg).toFixed(1), p50ms: +pct(0.5).toFixed(1), p95ms: +pct(0.95).toFixed(1),
      snails: typeof snails !== 'undefined' ? snails.length : -1, canvas: (() => { const c = document.querySelector('#stage canvas'); return c ? c.width + 'x' + c.height : null; })(),
      perFrameMs: cost });
  };
  requestAnimationFrame(step);
})`);

if (args.shot) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(args.shot, Buffer.from(shot.result.data, 'base64'));
}
console.log(JSON.stringify({ url, throttle, size: `${W}x${H}@${dpr}x`, ...result, errors: errors.slice(0, 3) }, null, 1));
ws.close();
cleanup();
process.exit(0);
