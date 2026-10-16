import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_ACESSO,
  URL_BASE_API,
  autenticacaoIndisponivel,
  limparCookiesSessao,
  COOKIE_ATUALIZACAO,
  encaminharRespostaApi,
  definirCookiesSessao,
} from "@/lib/auth-server";

type TokenResponse = { access?: unknown; refresh?: unknown };

export async function encaminharPedidoAutenticado(
  requisicao: Request,
  endpoint: string,
) {
  const metodo = requisicao.method.toUpperCase();
  if (!["GET", "POST", "PATCH", "DELETE"].includes(metodo)) {
    return NextResponse.json(
      { detail: "Método não permitido." },
      { status: 405, headers: { Allow: "GET, POST, PATCH, DELETE" } },
    );
  }

  if (metodo !== "GET") {
    const origem = requisicao.headers.get("origin");
    if (origem && origem !== new URL(requisicao.url).origin) {
      return NextResponse.json(
        { detail: "Origem do pedido não permitida." },
        { status: 403 },
      );
    }
  }

  const armazenamentoCookies = await cookies();
  let tokenAcesso = armazenamentoCookies.get(COOKIE_ACESSO)?.value;
  let tokenAtualizacao = armazenamentoCookies.get(COOKIE_ATUALIZACAO)?.value;
  if (!tokenAcesso && !tokenAtualizacao) {
    return NextResponse.json(
      { detail: "Sessão não iniciada." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const corpoRequisicao =
    metodo === "GET" || metodo === "DELETE"
      ? undefined
      : await requisicao.arrayBuffer();
  const tipoConteudo = requisicao.headers.get("content-type");
  const consulta = metodo === "GET" ? new URL(requisicao.url).search : "";
  const encaminharPedido = (token: string) =>
    fetch(`${URL_BASE_API}${endpoint}${consulta}`, {
      method: metodo,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(tipoConteudo ? { "Content-Type": tipoConteudo } : {}),
      },
      ...(corpoRequisicao !== undefined ? { body: corpoRequisicao } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

  try {
    let respostaExterna = tokenAcesso ? await encaminharPedido(tokenAcesso) : null;
    let tokensAtualizados: { access: string; refresh: string } | null = null;

    if ((!respostaExterna || respostaExterna.status === 401) && tokenAtualizacao) {
      const respostaAtualizacao = await fetch(`${URL_BASE_API}/auth/token/refresh/`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: tokenAtualizacao }),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });

      if (!respostaAtualizacao.ok) {
        const respostaHttp = await encaminharRespostaApi(respostaAtualizacao);
        limparCookiesSessao(respostaHttp);
        return respostaHttp;
      }

      const tokens = (await respostaAtualizacao.json()) as TokenResponse;
      if (
        typeof tokens.access !== "string" ||
        typeof tokens.refresh !== "string"
      ) {
        console.error("A API devolveu tokens de renovação inválidos.");
        const respostaHttp = autenticacaoIndisponivel();
        limparCookiesSessao(respostaHttp);
        return respostaHttp;
      }

      tokenAcesso = tokens.access;
      tokenAtualizacao = tokens.refresh;
      tokensAtualizados = { access: tokenAcesso, refresh: tokenAtualizacao };
      respostaExterna = await encaminharPedido(tokenAcesso);
    }

    if (!respostaExterna) {
      return NextResponse.json(
        { detail: "Não foi possível validar a sessão." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const respostaHttp = await encaminharRespostaApi(respostaExterna);
    if (respostaExterna.status === 401) {
      limparCookiesSessao(respostaHttp);
    } else if (tokensAtualizados) {
      definirCookiesSessao(respostaHttp, tokensAtualizados.access, tokensAtualizados.refresh);
    }
    return respostaHttp;
  } catch (erro) {
    console.error(`Falha ao encaminhar pedido autenticado para ${endpoint}.`, erro);
    return autenticacaoIndisponivel();
  }
}
