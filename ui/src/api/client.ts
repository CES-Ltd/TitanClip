const BASE = "/api";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  headers?: Record<string, string>;
}

function buildInit(method: string, body?: string | FormData, opts?: RequestOptions): RequestInit {
  const init: RequestInit = { method };
  if (body !== undefined) init.body = body;
  if (opts?.headers) init.headers = opts.headers;
  return init;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? undefined);
  const body = init?.body;
  if (!(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const { headers: _h, ...rest } = init ?? {};
  const res = await fetch(`${BASE}${path}`, {
    headers,
    credentials: "include",
    ...rest,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new ApiError(
      (errorBody as { error?: string } | null)?.error ?? `Request failed: ${res.status}`,
      res.status,
      errorBody,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, buildInit("GET", undefined, opts)),
  post: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, buildInit("POST", JSON.stringify(body), opts)),
  postForm: <T>(path: string, body: FormData) =>
    request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, buildInit("PUT", JSON.stringify(body), opts)),
  patch: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, buildInit("PATCH", JSON.stringify(body), opts)),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, buildInit("DELETE", undefined, opts)),
};

/** SHA-256 hash a string, returns hex. Used for PIN transport protection. */
export async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
