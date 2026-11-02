// Photoreal render: takes a JPEG of the current 3D view and asks an image-editing model
// (via Vercel AI Gateway, authenticated by the deployment's OIDC token) to repaint it as an
// architectural photograph while keeping geometry and camera locked.
import { generateText } from 'ai';

const MODEL = process.env.RENDER_MODEL || 'google/gemini-3.1-flash-image';
const FALLBACKS = ['google/gemini-2.5-flash-image'];
const PER_IP_HOUR = +(process.env.RENDER_PER_IP_HOUR || 8);
const PER_INSTANCE_DAY = +(process.env.RENDER_PER_DAY || 150);
const MAX_BYTES = 2_500_000;

// Best-effort limiter (per warm instance). Hard ceiling should also be an AI Gateway budget.
const hits = new Map(); let day = { d: '', n: 0 };
function limited(ip) {
  const now = Date.now(), today = new Date().toISOString().slice(0, 10);
  if (day.d !== today) day = { d: today, n: 0 };
  if (day.n >= PER_INSTANCE_DAY) return 'The studio has hit today\'s render limit. Try again tomorrow.';
  const arr = (hits.get(ip) || []).filter(t => now - t < 3600_000);
  if (arr.length >= PER_IP_HOUR) { const wait = Math.ceil((3600_000 - (now - arr[0])) / 60000); return `You've used ${PER_IP_HOUR} renders this hour. Next one frees up in ~${wait} min.`; }
  arr.push(now); hits.set(ip, arr); day.n++; return null;
}
const clean = (s, n = 80) => String(s || '').replace(/[^\p{L}\p{N} ,.'&()\-–—·°]/gu, '').slice(0, n);
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function buildPrompt(m) {
  return [
    `Re-render this 3D preview as a real, ultra-photorealistic architectural photograph for a luxury magazine (Architectural Digest / Dezeen).`,
    `STRICT: keep the exact camera position, focal length, framing and horizon. Keep the house exactly where it is, with the same footprint, massing, number of storeys, roof shapes, window positions and orientation. Keep the landform, coastline/water and tree placement. Do not add or remove buildings, do not move or resize the house, do not crop.`,
    `Only upgrade realism: real materials (${m.styleLine || m.style}), physically correct ${m.time} lighting and shadows, believable vegetation, real water, atmospheric depth, subtle lens characteristics, interior lights where natural.`,
    `Scene: a ${m.size} ${m.style} home (${m.layout}) in ${m.land}, inspired by ${m.inspired}. ${m.landLine}`,
    `Shot on a full-frame camera, tilt-shift corrected verticals, natural colour grading. No text, no watermark, no people in the foreground.`,
  ].join('\n');
}

export async function POST(req) {
  const origin = req.headers.get('origin') || '';
  if (origin && !/^https:\/\/dream-home[\w-]*\.vercel\.app$|^http:\/\/localhost(:\d+)?$/.test(origin)) return json(403, { error: 'Not allowed from this site.' });
  const ip = (req.headers.get('x-forwarded-for') || 'anon').split(',')[0].trim();
  const len = +(req.headers.get('content-length') || 0); if (len > MAX_BYTES * 1.4) return json(413, { error: 'Snapshot too large.' });
  let body; try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const m = body?.meta || {}; const img = String(body?.image || '');
  const mt = img.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!mt || mt[2].length > MAX_BYTES * 1.37) return json(400, { error: 'Missing or oversized snapshot.' });
  const meta = Object.fromEntries(['land', 'inspired', 'landLine', 'style', 'styleLine', 'layout', 'size', 'time'].map(k => [k, clean(m[k], k.endsWith('Line') ? 160 : 60)]));
  const lim = limited(ip); if (lim) return json(429, { error: lim });
  const prompt = buildPrompt(meta); const t0 = Date.now();
  let lastErr;
  for (const model of [MODEL, ...FALLBACKS]) {
    try {
      const r = await generateText({
        model, maxRetries: 1, abortSignal: AbortSignal.timeout(110_000),
        messages: [{ role: 'user', content: [{ type: 'file', mediaType: mt[1], data: mt[2] }, { type: 'text', text: prompt }] }],
        providerOptions: { google: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: body.aspect && /^\d+:\d+$/.test(body.aspect) ? body.aspect : undefined } } },
      });
      const f = r.files?.find(x => x.mediaType?.startsWith('image/'));
      if (!f) { lastErr = new Error('Model returned no image'); continue; }
      return json(200, { image: `data:${f.mediaType};base64,${f.base64}`, model, ms: Date.now() - t0 });
    } catch (e) { lastErr = e; console.error('render failed', model, e?.statusCode || '', String(e?.message || e).slice(0, 200)); }
  }
  const msg = String(lastErr?.message || '');
  if (/credit|budget|quota|402/i.test(msg)) return json(503, { error: 'Rendering is paused (AI credits or budget reached).' });
  return json(502, { error: 'The renderer is busy right now. Please try again in a moment.' });
}
export const maxDuration = 120;
