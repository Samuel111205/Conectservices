export class ApiRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function obterMensagemApi(data, status) {
  if (typeof data === "string" && data.trim()) {
    if (/^\s*(?:<!doctype html|<html\b)/i.test(data)) {
      if (status === 404) return "O recurso solicitado não foi encontrado.";
      if (status >= 500) return "O serviço está temporariamente indisponível. Tenta novamente.";
      return "Não foi possível concluir o pedido. Tenta novamente.";
    }
    return data;
  }
  if (Array.isArray(data)) {
    for (const value of data) {
      const message = obterMensagemApi(value, status);
      if (message) return message;
    }
  }
  if (data && typeof data === "object") {
    if (typeof data.detail === "string") return data.detail;
    for (const value of Object.values(data)) {
      const message = obterMensagemApi(value, status);
      if (message) return message;
    }
  }
  if (status === 401) return "A tua sessão terminou. Entra novamente para continuar.";
  if (status >= 500) return "O serviço está temporariamente indisponível. Tenta novamente.";
  return null;
}

function rotaDaApi(url, method) {
  const parsed = new URL(url, window.location.origin);
  let path = `${parsed.pathname.replace(/\/+$/, "")}/`;
  const verbo = method.toUpperCase();

  if (path === "/api/auth/token" || path === "/api/auth/token/") {
    path = "/api/v1/auth/web/session/";
  } else if (path === "/api/auth/logout" || path === "/api/auth/logout/") {
    path = "/api/v1/auth/web/session/logout/";
  } else if (path.startsWith("/api/auth/")) {
    const rotaConta = path.match(
      /^\/api\/auth\/(me|register|verify-email(?:\/resend)?|password-reset(?:\/confirm)?)\/$/,
    );
    path = rotaConta
      ? `/api/v1/auth/${rotaConta[1]}/`
      : path.replace(/^\/api\/auth\//, "/api/v1/");
    path = path.replace(/^\/api\/v1\/admin\/dashboard\/$/, "/api/v1/dashboard/admin/");
    path = path.replace(/^\/api\/v1\/analytics\/$/, "/api/v1/dashboard/analytics/");
    path = path.replace(/\/notifications\/read-all\/?$/, "/notifications/read_all/");
    path = path.replace(/\/notifications\/unread-count\/?$/, "/notifications/unread_count/");
    path = path.replace(
      /^\/api\/v1\/provider-verification-documents\/?$/,
      "/api/v1/providers/me/verification-documents/",
    );
    path = path.replace(
      /^\/api\/v1\/provider-verification-documents\/(\d+)\/?$/,
      "/api/v1/providers/me/verification-documents/$1/",
    );
    if (path === "/api/v1/services/" && verbo === "GET") {
      path = "/api/v1/services/mine/";
    }
    if (path === "/api/v1/products/" && verbo === "GET") {
      path = "/api/v1/products/mine/";
    }
  } else if (path.startsWith("/api/public/")) {
    path = path.replace(/^\/api\/public\//, "/api/v1/");
    path = path.replace(
      /^\/api\/v1\/analytics\/views\/?$/,
      "/api/v1/dashboard/analytics/views/",
    );
  }

  parsed.pathname = path;
  return parsed;
}

function csrfCookie() {
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith("csrftoken="));
  return cookie ? decodeURIComponent(cookie.slice("csrftoken=".length)) : "";
}

async function obterTokenCsrf(signal) {
  const response = await fetch("/api/v1/auth/web/csrf/", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok || !csrfCookie()) {
    throw new ApiRequestError("Não foi possível iniciar a sessão segura.", response.status);
  }
  return csrfCookie();
}

export async function fetchApi(input, options = {}) {
  const request = input instanceof Request ? input : null;
  const method = (options.method || request?.method || "GET").toUpperCase();
  const url = rotaDaApi(String(request?.url || input), method);
  const headers = new Headers(request?.headers || undefined);
  new Headers(options.headers).forEach((value, key) => headers.set(key, value));
  headers.set("Accept", "application/json");

  const unsafeMethod = !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method);
  if (unsafeMethod) {
    let token = csrfCookie();
    if (!token) token = await obterTokenCsrf(options.signal);
    headers.set("X-CSRFToken", token);
  }

  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
    : AbortSignal.timeout(15_000);
  return fetch(url, {
    ...options,
    method,
    headers,
    credentials: "same-origin",
    cache: options.cache || "no-store",
    signal,
  });
}

export async function requisitarJson(url, options = {}) {
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
    : AbortSignal.timeout(15_000);
  let response;
  try {
    response = await fetchApi(url, { ...options, signal });
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ApiRequestError("A ligação demorou demasiado. Tenta novamente.", 0);
    }
    throw new ApiRequestError(
      "Não foi possível ligar à plataforma. Confirma a ligação e tenta novamente.",
      0,
    );
  }

  const body =
    response.status === 204
      ? null
      : await response.text().then((text) => {
          if (!text) return null;
          try {
            return JSON.parse(text);
          } catch {
            return text;
          }
        });
  if (!response.ok) {
    throw new ApiRequestError(
      obterMensagemApi(body, response.status) ??
        "Não foi possível concluir o pedido. Confirma os dados e tenta novamente.",
      response.status,
    );
  }
  return body;
}
