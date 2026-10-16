export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function obterMensagemApi(dados: unknown, status: number): string | null {
  if (typeof dados === "string" && dados.trim()) return dados;
  if (Array.isArray(dados)) {
    for (const valor of dados) {
      const mensagem = obterMensagemApi(valor, status);
      if (mensagem) return mensagem;
    }
  }
  if (dados && typeof dados === "object") {
    const registo = dados as Record<string, unknown>;
    if (typeof registo.detail === "string") return registo.detail;
    for (const valor of Object.values(registo)) {
      const mensagem = obterMensagemApi(valor, status);
      if (mensagem) return mensagem;
    }
  }
  if (status === 401) return "A tua sessão terminou. Entra novamente para continuar.";
  if (status >= 500) return "O serviço está temporariamente indisponível. Tenta novamente.";
  return null;
}

export async function requisitarJson<T>(
  url: string,
  opcoes: RequestInit = {},
): Promise<T> {
  const cabecalhos = new Headers(opcoes.headers);
  cabecalhos.set("Accept", "application/json");
  const sinal = opcoes.signal
    ? AbortSignal.any([opcoes.signal, AbortSignal.timeout(15_000)])
    : AbortSignal.timeout(15_000);

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      cache: "no-store",
      ...opcoes,
      headers: cabecalhos,
      signal: sinal,
    });
  } catch (erro) {
    if (erro instanceof Error && (erro.name === "TimeoutError" || erro.name === "AbortError")) {
      throw new ApiRequestError("A ligação demorou demasiado. Tenta novamente.", 0);
    }
    throw new ApiRequestError(
      "Não foi possível ligar à plataforma. Confirma a ligação e tenta novamente.",
      0,
    );
  }

  const dados: unknown =
    resposta.status === 204 ? null : await resposta.text().then((texto) => {
      if (!texto) return null;
      try {
        return JSON.parse(texto) as unknown;
      } catch {
        return texto;
      }
    });
  if (!resposta.ok) {
    throw new ApiRequestError(
      obterMensagemApi(dados, resposta.status) ?? "Não foi possível concluir o pedido. Confirma os dados e tenta novamente.",
      resposta.status,
    );
  }
  return dados as T;
}
