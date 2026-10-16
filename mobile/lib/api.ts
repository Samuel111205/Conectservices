import { clearTokens, readTokens, saveTokens, type SessionTokens } from "./session-store";

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshInFlight: Promise<SessionTokens | null> | null = null;

function errorMessage(body: unknown, status: number): string {
  if (typeof body === "string" && body.trim()) return body;
  if (Array.isArray(body)) {
    for (const value of body) {
      const message = errorMessage(value, status);
      if (message) return message;
    }
  }
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    for (const value of Object.values(record)) {
      const message = errorMessage(value, status);
      if (message) return message;
    }
  }
  if (status === 401) return "A tua sessão terminou. Entra novamente para continuar.";
  if (status >= 500) return "O serviço está temporariamente indisponível. Tenta novamente.";
  return "Não foi possível concluir o pedido. Confirma os dados e tenta novamente.";
}

async function responseBody<T>(response: Response): Promise<T> {
  const text = response.status === 204 ? "" : await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    throw new ApiError(errorMessage(body, response.status), response.status);
  }
  return body as T;
}

function apiUrl(path: string) {
  return `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;
}

function apiSignal(signal?: AbortSignal | null) {
  return signal
    ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
    : AbortSignal.timeout(15_000);
}

async function refreshTokens(): Promise<SessionTokens | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const current = await readTokens();
      if (!current) return null;
      try {
        const response = await fetch(apiUrl("/auth/token/refresh/"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ refresh: current.refresh }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          await clearTokens();
          return null;
        }
        const tokens = (await response.json()) as Partial<SessionTokens>;
        if (typeof tokens.access !== "string" || typeof tokens.refresh !== "string") {
          await clearTokens();
          return null;
        }
        await saveTokens({ access: tokens.access, refresh: tokens.refresh });
        return { access: tokens.access, refresh: tokens.refresh };
      } catch {
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tokens = await readTokens();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (tokens?.access) headers.set("Authorization", `Bearer ${tokens.access}`);

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...options,
      headers,
      signal: apiSignal(options.signal),
    });
  } catch {
    throw new ApiError(
      "Não foi possível ligar à plataforma ou o pedido demorou demasiado. Confirma a rede e o endereço da API.",
      0,
    );
  }

  if (response.status === 401 && tokens?.refresh && path !== "/auth/token/refresh/") {
    const renewed = await refreshTokens();
    if (renewed) {
      headers.set("Authorization", `Bearer ${renewed.access}`);
      const retryOptions =
        path === "/auth/logout/" && options.body
          ? { ...options, body: JSON.stringify({ refresh: renewed.refresh }) }
          : options;
      try {
        response = await fetch(apiUrl(path), {
          ...retryOptions,
          headers,
          signal: apiSignal(options.signal),
        });
      } catch {
        throw new ApiError("Não foi possível repetir o pedido. Confirma a rede e tenta novamente.", 0);
      }
    }
  }

  if (response.status === 204) return undefined as T;
  return responseBody<T>(response);
}

