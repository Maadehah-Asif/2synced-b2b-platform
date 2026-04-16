const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

type QueryValue = string | number | boolean | null | undefined;

export class Module3ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "Module3ApiError";
    this.status = status;
  }
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`/m03${normalizedPath}`, API_BASE);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

function getReadableError(status: number, text: string) {
  const trimmed = text.trim();
  const looksHtml =
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    trimmed.startsWith("<");

  if (status === 401 || status === 403) {
    return "Unauthorized or invalid session";
  }

  if (status === 404) {
    return "Module 3 API route not found";
  }

  if (looksHtml) {
    return "Endpoint returned HTML instead of JSON";
  }

  return "";
}

export async function fetchModule3Json<T>(
  path: string,
  query?: Record<string, QueryValue>
): Promise<T> {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Module3ApiError("Unauthorized or invalid session", 401);
  }

  const res = await fetch(buildUrl(path, query), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const rawText = await res.text();
  const readableError = getReadableError(res.status, rawText);
  const contentType = res.headers.get("content-type") || "";
  const expectsJson = contentType.toLowerCase().includes("application/json");

  let parsed: any = null;
  if (rawText) {
    if (!expectsJson) {
      if (readableError) {
        throw new Module3ApiError(readableError, res.status);
      }
      throw new Module3ApiError("Endpoint returned a non-JSON response", res.status);
    }

    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Module3ApiError("Endpoint returned invalid JSON", res.status);
    }
  }

  if (!res.ok) {
    throw new Module3ApiError(
      parsed?.error || parsed?.message || readableError || `Request failed (${res.status})`,
      res.status
    );
  }

  return parsed as T;
}
