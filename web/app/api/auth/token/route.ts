import { NextResponse } from "next/server";
import {
  URL_BASE_API,
  autenticacaoIndisponivel,
  eMesmaOrigem,
  encaminharRespostaApi,
  definirCookiesSessao,
} from "@/lib/auth-server";

export async function POST(requisicao: Request) {
  if (!eMesmaOrigem(requisicao)) {
    return NextResponse.json(
      { detail: "Origem do pedido não permitida." },
      { status: 403 },
    );
  }

  let dadosRecebidos: unknown;
  try {
    dadosRecebidos = await requisicao.json();
  } catch {
    return NextResponse.json(
      { detail: "O pedido não contém JSON válido." },
      { status: 400 },
    );
  }

  let respostaExterna: Response;
  try {
    respostaExterna = await fetch(`${URL_BASE_API}/auth/token/`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(dadosRecebidos),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch (erro) {
    console.error("Falha ao contactar a API para iniciar sessão.", erro);
    return autenticacaoIndisponivel();
  }

  if (!respostaExterna.ok) return encaminharRespostaApi(respostaExterna);

  let tokens: { access?: unknown; refresh?: unknown };
  try {
    tokens = await respostaExterna.json();
  } catch {
    console.error("A API devolveu uma resposta de autenticação inválida.");
    return autenticacaoIndisponivel();
  }

  if (typeof tokens.access !== "string" || typeof tokens.refresh !== "string") {
    console.error("A resposta da API não contém os tokens esperados.");
    return autenticacaoIndisponivel();
  }

  const respostaHttp = NextResponse.json(
    { detail: "Sessão iniciada." },
    { headers: { "Cache-Control": "no-store" } },
  );
  definirCookiesSessao(respostaHttp, tokens.access, tokens.refresh);
  return respostaHttp;
}
