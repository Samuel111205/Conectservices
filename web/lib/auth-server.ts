import { NextResponse } from "next/server";

export const COOKIE_ACESSO = "conect_access";
export const COOKIE_ATUALIZACAO = "conect_refresh";
export const IDADE_MAXIMA_TOKEN_ACESSO = 15 * 60;
export const IDADE_MAXIMA_TOKEN_ATUALIZACAO = 7 * 24 * 60 * 60;

export const URL_BASE_API =
  process.env.API_BASE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000/api/v1";

const opcoesCookie = (idadeMaxima: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: idadeMaxima,
});

export function definirCookiesSessao(
  respostaHttp: NextResponse,
  tokenAcesso: string,
  tokenAtualizacao: string,
) {
  respostaHttp.cookies.set(COOKIE_ACESSO, tokenAcesso, opcoesCookie(IDADE_MAXIMA_TOKEN_ACESSO));
  respostaHttp.cookies.set(
    COOKIE_ATUALIZACAO,
    tokenAtualizacao,
    opcoesCookie(IDADE_MAXIMA_TOKEN_ATUALIZACAO),
  );
}

export function limparCookiesSessao(respostaHttp: NextResponse) {
  respostaHttp.cookies.set(COOKIE_ACESSO, "", { ...opcoesCookie(0), maxAge: 0 });
  respostaHttp.cookies.set(COOKIE_ATUALIZACAO, "", { ...opcoesCookie(0), maxAge: 0 });
}

export async function encaminharRespostaApi(respostaHttp: Response) {
  const corpoRequisicao = await respostaHttp.text();
  return new NextResponse(corpoRequisicao || null, {
    status: respostaHttp.status,
    headers: {
      "Content-Type":
        respostaHttp.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function autenticacaoIndisponivel() {
  return NextResponse.json(
    { detail: "O serviço de autenticação está temporariamente indisponível." },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}

export function eMesmaOrigem(requisicao: Request) {
  const origem = requisicao.headers.get("origin");
  if (!origem) return true;
  return origem === new URL(requisicao.url).origin;
}
