/**
 * Shared client instance for the portal.
 *
 * NEXT_PUBLIC_API_MOCK=1 swaps in the in-memory mock so the portal runs without the NestJS API.
 * Auth is not wired yet (Blueprint §2.1 leaves the provider open); replace `getAccessToken`
 * with your provider's session lookup once chosen.
 */
import { createApiClient, type ApiClient } from './client';
import { createMockApiClient } from './mock';

function createDefaultClient(): ApiClient {
  if (process.env.NEXT_PUBLIC_API_MOCK === '1') return createMockApiClient();
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    // Fail on first use, not at import, so pages that never call the API still build.
    return new Proxy({} as ApiClient, {
      get() {
        throw new Error('NEXT_PUBLIC_API_BASE_URL is not set. Copy .env.example to .env.local, or set NEXT_PUBLIC_API_MOCK=1.');
      },
    });
  }
  return createApiClient({
    baseUrl,
    getAccessToken: async () => null, // TODO: return the signed-in user's JWT
  });
}

export const api: ApiClient = createDefaultClient();

export { createApiClient } from './client';
export type { ApiClient, MutationOptions, RequestOptions, UploadDocumentOptions } from './client';
export { ApiError, NetworkError } from './errors';
export { newIdempotencyKey, sha256Hex, type IdempotencyKey } from './idempotency';
export { MOCK_3DS_PAYMENT_ID, mockThreeDS } from './mock';
