export function formatMoney(cents: number, currency = 'CAD'): string {
  return (cents / 100).toLocaleString('en-CA', { style: 'currency', currency });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function shortKey(key: string): string {
  return `${key.slice(0, 8)}…`;
}
