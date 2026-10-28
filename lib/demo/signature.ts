/**
 * Deterministic "handwritten" signature paths for demo data (viewBox 0 0 240 60).
 * Real signatures are captured on the server's phone and by the commissioner's signing tool.
 */

function rng(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10_000) / 10_000;
  };
}

export function signaturePath(name: string): string {
  const r = rng(name);
  const letters = name.replace(/[^A-Za-z]/g, '').slice(0, 9) || 'x';
  const step = 200 / letters.length;
  let x = 12;
  let y = 38;
  const parts: string[] = [`M ${x.toFixed(1)} ${y.toFixed(1)}`];
  for (let i = 0; i < letters.length; i++) {
    const tall = /[A-Zbdfhklt]/.test(letters[i]!) ? 1 : 0.55;
    const h = (14 + r() * 14) * tall;
    const nx = x + step * (0.8 + r() * 0.4);
    const ny = 36 + (r() - 0.5) * 8;
    // up-stroke loop then down into the next letter
    parts.push(
      `C ${(x + step * 0.2).toFixed(1)} ${(y - h).toFixed(1)}, ${(x + step * 0.7).toFixed(1)} ${(y - h * 1.1).toFixed(1)}, ${(x + step * 0.45).toFixed(1)} ${(y - 2).toFixed(1)}`,
      `S ${(nx - step * 0.2).toFixed(1)} ${(ny + 6 * r()).toFixed(1)}, ${nx.toFixed(1)} ${ny.toFixed(1)}`,
    );
    x = nx;
    y = ny;
  }
  // underline flourish
  parts.push(`M ${(16 + r() * 10).toFixed(1)} ${(48 + r() * 4).toFixed(1)} Q 120 ${(42 + r() * 6).toFixed(1)}, ${Math.min(232, x + 10).toFixed(1)} ${(46 + r() * 6).toFixed(1)}`);
  return parts.join(' ');
}
