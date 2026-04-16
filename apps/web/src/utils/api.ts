type ApiErrorBody = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export async function fetchFromApi(url: string, init?: RequestInit, apiBase?: string) {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(`Could not reach the API server at ${apiBase || url}. Restart the backend and try again.`);
  }
}

export async function parseApiJson<T>(res: Response, fallbackError: string): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as ApiErrorBody;
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.message || json?.error || fallbackError || `Request failed with HTTP ${res.status}`);
  }
  return json as T;
}
