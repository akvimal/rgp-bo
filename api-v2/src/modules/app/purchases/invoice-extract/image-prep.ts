import { Canvas, createCanvas } from '@napi-rs/canvas';

/**
 * A page or photo made easier for OCR to read: turned to grey, contrast stretched (a grey header band and a faint scan become
 * clear text), and straightened when the scan is tilted by a degree or two. Nothing is thresholded: that lost fine print.
 */
export function prepare(source: Canvas): Canvas {
  const w = source.width, h = source.height;
  const ctx = source.getContext('2d');
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  const gray = new Uint8Array(n);
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < n; i++) {
    const g = Math.round(0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]);
    gray[i] = g;
    hist[g]++;
  }
  // stretch between the 1st and 99th percentile of brightness
  const pct = (p: number) => { let c = 0; for (let v = 0; v < 256; v++) { c += hist[v]; if (c >= n * p) return v; } return 255; };
  const lo = pct(0.01), hi = Math.max(pct(0.99), lo + 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(255, Math.round(((gray[i] - lo) * 255) / (hi - lo))));
    gray[i] = v;
    d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = v;
    d[4 * i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const angle = skewAngle(gray, w, h);
  if (Math.abs(angle) < 0.3) return source;
  const out = createCanvas(w, h);
  const o = out.getContext('2d');
  o.fillStyle = '#ffffff';
  o.fillRect(0, 0, w, h);
  o.translate(w / 2, h / 2);
  o.rotate((-angle * Math.PI) / 180);
  o.drawImage(source, -w / 2, -h / 2);
  return out;
}

/** how far the text lines tilt, in degrees (positive: the right side is lower): the angle at which the dark pixels pile into the sharpest rows */
export function skewAngle(gray: Uint8Array, w: number, h: number): number {
  const step = Math.max(2, Math.round(Math.max(w, h) / 700));
  const xs: number[] = [], ys: number[] = [];
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (gray[y * w + x] < 110) { xs.push(x / step); ys.push(y / step); }
  if (xs.length < 200) return 0;
  const rows = Math.ceil(h / step) + Math.ceil(w / step) + 4;
  let best = 0, bestScore = -1;
  for (let a = -4; a <= 4.001; a += 0.25) {
    const s = Math.sin((a * Math.PI) / 180), c = Math.cos((a * Math.PI) / 180);
    const bins = new Float64Array(rows);
    const shift = Math.ceil(w / step) + 2;
    for (let i = 0; i < xs.length; i++) bins[Math.round(ys[i] * c - xs[i] * s) + shift]++;
    let score = 0;
    for (let i = 0; i < rows; i++) score += bins[i] * bins[i];
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best;
}
