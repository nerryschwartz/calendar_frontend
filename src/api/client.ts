import { ApiError, type ApiErrorDetail } from "./types";

const baseUrl = import.meta.env.VITE_API_BASE_URL as string;

async function parseError(response: Response): Promise<never> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError({
      errors: [
        { code: "HTTP_ERROR", message: response.statusText, details: {} },
      ],
    });
  }

  if (body && typeof body === "object" && "detail" in body) {
    throw new ApiError((body as { detail: ApiErrorDetail }).detail);
  }

  throw new ApiError({
    errors: [{ code: "HTTP_ERROR", message: response.statusText, details: {} }],
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) {
    await parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}
