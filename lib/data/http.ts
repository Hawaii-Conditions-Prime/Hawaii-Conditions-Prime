// Shared fetch helper for upstream providers.
//
// Every provider call is time-bounded so a slow upstream can't hold a paid
// request open until the platform timeout, and failures surface as a typed
// error rather than an unhandled rejection.

export class UpstreamError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

const DEFAULT_TIMEOUT_MS = 8000;

export async function fetchJson<T>(
  provider: string,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        // NWS rejects requests without a descriptive User-Agent.
        "User-Agent": "hawaii-conditions-mcp (+https://hawaii-conditions-prime.vercel.app)",
        Accept: "application/json",
        ...rest.headers,
      },
    });

    if (!res.ok) {
      throw new UpstreamError(provider, `${provider} returned HTTP ${res.status}`, res.status);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new UpstreamError(provider, `${provider} timed out after ${timeoutMs}ms`);
    }
    throw new UpstreamError(provider, `${provider} request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

// Runs a provider call that is one part of a larger response, degrading to a
// structured error object instead of failing the whole (already paid for) call.
export async function settleSection<T>(
  section: string,
  run: () => Promise<T>,
): Promise<T | { error: string; source: string }> {
  try {
    return await run();
  } catch (err) {
    return {
      error: err instanceof UpstreamError ? err.message : `${section} unavailable`,
      source: section,
    };
  }
}
