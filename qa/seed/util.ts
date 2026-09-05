/** Small async helpers for the generator. */

export async function pool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export function progress(label: string, total: number) {
  let done = 0;
  let last = Date.now();
  return () => {
    done++;
    if (done === total || Date.now() - last > 1500) {
      process.stdout.write(`\r  ${label}: ${done}/${total}   `);
      last = Date.now();
      if (done === total) process.stdout.write('\n');
    }
  };
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function isoAt(daysBack: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
