/**
 * Idempotency keys (Blueprint §6: required on every POST that creates or pays).
 *
 * The key identifies one logical operation, not one HTTP request. Generate it
 * when the user starts an action (e.g. clicks "Authorize & submit"), keep it
 * in component state, and reuse it for every retry of that action. A new key
 * per retry defeats the purpose: a timed-out submit that actually succeeded
 * would authorize the card twice.
 */

export type IdempotencyKey = string & { readonly __idempotencyKey: true };

export function newIdempotencyKey(): IdempotencyKey {
  // Available in all modern browsers (secure contexts) and Node 19+.
  return crypto.randomUUID() as IdempotencyKey;
}

/** Hex SHA-256 of a file, computed in the browser before upload (Blueprint §7.4). */
export async function sha256Hex(data: Blob | ArrayBuffer): Promise<string> {
  const buf = data instanceof Blob ? await data.arrayBuffer() : data;
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
