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
    const detail = body.detail;
    if (Array.isArray(detail)) {
      throw new ApiError({
        errors: detail.map((issue: unknown) => {
          const item =
            issue && typeof issue === "object"
              ? (issue as Record<string, unknown>)
              : {};
          const location = Array.isArray(item.loc) ? item.loc.join(".") : "";
          const message =
            typeof item.msg === "string" ? item.msg : "Invalid value";
          return {
            code:
              typeof item.type === "string" ? item.type : "VALIDATION_ERROR",
            message: location ? `${location}: ${message}` : message,
            details: {},
          };
        }),
      });
    }
    if (
      detail &&
      typeof detail === "object" &&
      "errors" in detail &&
      Array.isArray(detail.errors) &&
      detail.errors.every(
        (error) =>
          error &&
          typeof error === "object" &&
          typeof error.message === "string",
      )
    ) {
      throw new ApiError(detail as ApiErrorDetail);
    }
    if (typeof detail === "string") {
      throw new ApiError({
        errors: [{ code: "HTTP_ERROR", message: detail, details: {} }],
      });
    }
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
