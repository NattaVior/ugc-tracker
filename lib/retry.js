import "server-only";

export class RetryableHttpError extends Error {
  constructor(message, retryAfterMs) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}

function retryAfter(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

export async function withRetry(operation, retries = 2) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try { return await operation(); } catch (error) {
      last = error;
      if (attempt === retries) break;
      const exponential = Math.min(15000, 1000 * (2 ** attempt));
      const serverDelay = error instanceof RetryableHttpError ? error.retryAfterMs || 0 : 0;
      await new Promise((resolve) => setTimeout(resolve, Math.max(exponential, serverDelay)));
    }
  }
  throw last instanceof Error ? last : new Error("Operation failed");
}

export function retryAfterFrom(response) {
  return retryAfter(response.headers.get("retry-after"));
}
