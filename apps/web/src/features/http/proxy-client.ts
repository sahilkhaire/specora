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

  if (!proxyResponse.ok || !payload.ok) {
    throw new Error(payload.error ?? `Proxy request failed with HTTP ${proxyResponse.status}`);
  }

  return payload;
}
