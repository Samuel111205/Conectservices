import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_ACESSO,
  URL_BASE_API,
  autenticacaoIndisponivel,
  limparCookiesSessao,
  eMesmaOrigem,
  COOKIE_ATUALIZACAO,
} from "@/lib/auth-server";

export async function POST(requisicao: Request) {
  if (!eMesmaOrigem(requisicao)) {
    return NextResponse.json({ detail: "Origem do pedido não permitida." }, { status: 403 });
  }

  const armazenamentoCookies = await cookies();
  const tokenAcesso = armazenamentoCookies.get(COOKIE_ACESSO)?.value;
  const tokenAtualizacao = armazenamentoCookies.get(COOKIE_ATUALIZACAO)?.value;
  let respostaHttp: NextResponse;

  if (tokenAcesso && tokenAtualizacao) {
    try {
      const respostaExterna = await fetch(`${URL_BASE_API}/auth/logout/`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${tokenAcesso}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh: tokenAtualizacao }),
        cache: "no-store",
      });
      respostaHttp = new NextResponse(null, {
        status: respostaExterna.status,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (erro) {
      console.error("Falha ao invalidar os tokens na API.", erro);
      respostaHttp = autenticacaoIndisponivel();
    }
  } else {
    respostaHttp = new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  }

  limparCookiesSessao(respostaHttp);
  return respostaHttp;
}
