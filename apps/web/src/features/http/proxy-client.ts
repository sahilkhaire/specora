export interface TryoutProxyRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string | null;
}

export interface TryoutProxyResponse {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  body: string;
  error?: string;
}

export async function fetchViaTryoutProxy(
  proxyUrl: string,
  request: TryoutProxyRequest
): Promise<TryoutProxyResponse> {
  const proxyResponse = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body ?? null
    })
  });

  let payload: TryoutProxyResponse;
  try {
    payload = (await proxyResponse.json()) as TryoutProxyResponse;
  } catch {
    throw new Error(`Proxy returned invalid JSON (HTTP ${proxyResponse.status}).`);
  }

  // The proxy answers 502 with ok:false for upstream non-2xx, but still relays the
  // upstream status, headers and body. Those are real API responses to show the user.
  if (payload && typeof payload.status === "number" && payload.status > 0) {
    return { ...payload, headers: payload.headers ?? {}, body: payload.body ?? "" };
  }

  throw new Error(payload?.error ?? `Proxy request failed with HTTP ${proxyResponse.status}`);
}
