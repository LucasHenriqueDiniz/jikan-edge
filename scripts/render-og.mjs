#!/usr/bin/env node
// Regenerates site/og.png — the 1200x630 social preview card.
//
//   npm run og        (then open the URL it prints, if it does not open by itself)
//
// Why a browser instead of an image library: the card uses the same two webfonts as the landing
// page, and every pure-Node rasteriser available here either cannot load a webfont or substitutes
// a system face silently. Chrome already has the exact renderer the site is designed against, so
// the card is drawn on a <canvas> at exactly 1200x630 and POSTed back here as PNG bytes.
//
// Canvas rather than screenshotting a styled <div>: a screenshot is at the mercy of the window
// size and device pixel ratio, and comes out scaled. toBlob() gives the exact pixels asked for.
//
// The numbers on the card (route count, p50) are copy like any other and go stale — they live in
// CARD below, not in a binary nobody can grep.

import { createServer } from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'site', 'og.png');
const PORT = 8791;

const CARD = {
  eyebrow: 'Unofficial MyAnimeList API',
  eyebrowAccent: 'Jikan v4 parity',
  title: ['jikan', '-edge'],
  tagline: ['Anime, manga, characters, people and users —', "served entirely from Cloudflare's edge."],
  facts: [
    ['97', 'routes'],
    ['7 ms', 'p50'],
    ['no', 'auth'],
    ['free', ''],
  ],
  url: 'jikan.lucashdo.com',
  foot: 'MIT · open source',
};

// Same palette as site/index.html. Kept in sync by hand; there is no build step to share it.
const C = {
  ink: '#0b0e14',
  line: '#232a3a',
  paper: '#e9e5d9',
  paperDim: '#9aa0ae',
  paperFaint: '#5d6474',
  vermillion: '#ff4b33',
  gold: '#d8b46a',
  teal: '#6fd3c7',
};

const page = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>body{margin:0;background:#222;display:grid;place-items:center;min-height:100vh}
canvas{width:900px;height:472px;box-shadow:0 20px 60px #0008}
#s{position:fixed;top:8px;left:8px;font:14px monospace;color:#fff;background:#000a;padding:6px 10px;border-radius:6px}</style>
</head><body>
<div id="s">rendering…</div><canvas id="c" width="1200" height="630"></canvas>
<script>
const C = ${JSON.stringify(C)}, CARD = ${JSON.stringify(CARD)};
const DISPLAY = '"Bricolage Grotesque", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, Consolas, monospace';

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
};

// Draws two-tone text (bright value + dim label) and returns the total advance.
function pair(ctx, value, label, x, y, size) {
  ctx.font = '500 ' + size + 'px ' + MONO;
  ctx.fillStyle = C.paper; ctx.fillText(value, x, y);
  let w = ctx.measureText(value).width;
  if (label) {
    ctx.font = '400 ' + size + 'px ' + MONO;
    ctx.fillStyle = C.paperDim;
    ctx.fillText(' ' + label, x + w, y);
    w += ctx.measureText(' ' + label).width;
  }
  return w;
}

async function draw() {
  const c = document.getElementById('c'), ctx = c.getContext('2d');
  const W = 1200, H = 630;

  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);

  // Grid, drawn offscreen so a radial gradient can mask it the way the CSS mask-image does.
  const g = document.createElement('canvas'); g.width = W; g.height = H;
  const gx = g.getContext('2d');
  gx.strokeStyle = C.line; gx.lineWidth = 1;
  for (let x = 0.5; x < W; x += 72) { gx.moveTo(x, 0); gx.lineTo(x, H); }
  for (let y = 0.5; y < H; y += 72) { gx.moveTo(0, y); gx.lineTo(W, y); }
  gx.stroke();
  const mask = gx.createRadialGradient(360, 0, 0, 360, 0, 720);
  mask.addColorStop(0, '#000f'); mask.addColorStop(0.75, '#0000');
  gx.globalCompositeOperation = 'destination-in';
  gx.fillStyle = mask; gx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.35; ctx.drawImage(g, 0, 0); ctx.globalAlpha = 1;

  // Oversized watermark, bled off the right edge so it reads as texture rather than a logo.
  ctx.save();
  ctx.globalAlpha = 0.13; ctx.fillStyle = C.vermillion;
  ctx.font = '420px serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText('時', W + 60, H / 2);
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

  const top = ctx.createLinearGradient(0, 0, W, 0);
  top.addColorStop(0, C.vermillion); top.addColorStop(0.3, C.vermillion);
  top.addColorStop(0.6, C.gold); top.addColorStop(1, 'rgba(216,180,106,0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, 6);

  const X = 80;

  ctx.font = '400 21px ' + MONO;
  ctx.letterSpacing = '3px';
  ctx.fillStyle = C.paperDim;
  const eyebrow = CARD.eyebrow.toUpperCase() + ' · ';
  ctx.fillText(eyebrow, X, 104);
  ctx.fillStyle = C.teal;
  ctx.font = '500 21px ' + MONO;
  ctx.fillText(CARD.eyebrowAccent.toUpperCase(), X + ctx.measureText(eyebrow).width, 104);
  ctx.letterSpacing = '0px';

  ctx.font = '800 104px ' + DISPLAY;
  ctx.fillStyle = C.paper;
  ctx.fillText(CARD.title[0], X, 246);
  ctx.fillStyle = C.vermillion;
  ctx.fillText(CARD.title[1], X + ctx.measureText(CARD.title[0]).width, 246);

  ctx.font = '350 33px ' + DISPLAY;
  ctx.fillStyle = C.paperDim;
  ctx.fillText(CARD.tagline[0], X, 306);
  ctx.fillText(CARD.tagline[1], X, 350);

  let cx = X;
  for (const [value, label] of CARD.facts) {
    ctx.font = '500 21px ' + MONO;
    const inner = ctx.measureText(value + (label ? ' ' + label : '')).width;
    const w = inner + 40;
    ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    roundRect(ctx, cx, 425, w, 46, 23);
    ctx.fill(); ctx.stroke();
    pair(ctx, value, label, cx + 20, 455, 21);
    cx += w + 14;
  }

  ctx.fillStyle = C.teal;
  ctx.beginPath(); ctx.arc(X + 6, 549, 6, 0, Math.PI * 2); ctx.fill();
  ctx.font = '500 29px ' + MONO;
  ctx.fillStyle = C.vermillion;
  ctx.fillText(CARD.url, X + 24, 559);

  ctx.font = '400 19px ' + MONO;
  ctx.fillStyle = C.paperFaint;
  ctx.textAlign = 'right';
  ctx.fillText(CARD.foot, W - X, 559);
}

(async () => {
  const s = document.getElementById('s');
  try {
    await document.fonts.load('800 104px "Bricolage Grotesque"');
    await document.fonts.load('500 21px "IBM Plex Mono"');
    await document.fonts.ready;
    await draw();
    const blob = await new Promise((r) => document.getElementById('c').toBlob(r, 'image/png'));
    const res = await fetch('/save', { method: 'POST', body: blob });
    s.textContent = res.ok ? 'saved ' + (await res.text()) : 'save failed';
  } catch (e) { s.textContent = 'error: ' + e.message; }
})();
</script></body></html>`;

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/save' && req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const png = Buffer.concat(chunks);
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, png);
    const message = `site/og.png — ${png.length} bytes`;
    process.stdout.write(`\n✔ ${message}\n`);
    res.end(message);
    // The whole point of the server is this one write; hanging around would just block the shell.
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 250);
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(page);
});

server.listen(PORT, () => process.stdout.write(`Open http://127.0.0.1:${PORT}/ to render site/og.png\n`));
// Never leave a stray listener behind if the page is never opened.
setTimeout(() => {
  process.stdout.write('\n✖ Timed out waiting for the browser to POST the image.\n');
  process.exit(1);
}, 120000);
