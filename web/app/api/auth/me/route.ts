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

async function obterConta(tokenAcesso: string) {
  return fetch(`${URL_BASE_API}/auth/me/`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${tokenAcesso}` },
    cache: "no-store",
  });
}

export async function GET() {
  const armazenamentoCookies = await cookies();
  let tokenAcesso = armazenamentoCookies.get(COOKIE_ACESSO)?.value;
  let tokenAtualizacao = armazenamentoCookies.get(COOKIE_ATUALIZACAO)?.value;

  if (!tokenAcesso && !tokenAtualizacao) {
    return NextResponse.json({ detail: "Sessão não iniciada." }, { status: 401 });
  }

  try {
    let respostaConta = tokenAcesso ? await obterConta(tokenAcesso) : null;
    let tokenAtualizacaoRotacionado: string | undefined;

    if ((!respostaConta || respostaConta.status === 401) && tokenAtualizacao) {
      const respostaAtualizacao = await fetch(`${URL_BASE_API}/auth/token/refresh/`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: tokenAtualizacao }),
        cache: "no-store",
      });

      if (respostaAtualizacao.ok) {
        const tokens = (await respostaAtualizacao.json()) as TokenResponse;
        if (
          typeof tokens.access === "string" &&
          typeof tokens.refresh === "string"
        ) {
          tokenAcesso = tokens.access;
          tokenAtualizacao = tokens.refresh;
          tokenAtualizacaoRotacionado = tokens.refresh;
        } else {
          console.error("A API devolveu tokens de renovação inválidos.");
          const respostaHttp = autenticacaoIndisponivel();
          limparCookiesSessao(respostaHttp);
          return respostaHttp;
        }
      } else {
        const respostaHttp = NextResponse.json(
          { detail: "A sessão expirou. Inicia sessão novamente." },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        );
        limparCookiesSessao(respostaHttp);
        return respostaHttp;
      }

      if (tokenAcesso) respostaConta = await obterConta(tokenAcesso);
    }

    if (!respostaConta) {
      return NextResponse.json(
        { detail: "Não foi possível validar a sessão." },
        { status: 401 },
      );
    }

    if (respostaConta.status === 401) {
      const respostaHttp = await encaminharRespostaApi(respostaConta);
      limparCookiesSessao(respostaHttp);
      return respostaHttp;
    }

    const respostaHttp = await encaminharRespostaApi(respostaConta);
    if (tokenAtualizacaoRotacionado && tokenAcesso && tokenAtualizacao) {
      definirCookiesSessao(respostaHttp, tokenAcesso, tokenAtualizacao);
    }
    return respostaHttp;
  } catch (erro) {
    console.error("Falha ao consultar a conta autenticada.", erro);
    return autenticacaoIndisponivel();
  }
}
