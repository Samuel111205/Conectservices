import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_ACESSO,
  COOKIE_ATUALIZACAO,
  URL_BASE_API,
} from "@/lib/auth-server";
import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

export async function POST(requisicao: Request) {
  const sessao = await cookies();
  if (sessao.has(COOKIE_ACESSO) || sessao.has(COOKIE_ATUALIZACAO)) {
    return encaminharPedidoAutenticado(requisicao, "/dashboard/analytics/views/");
  }

  try {
    const respostaApi = await fetch(`${URL_BASE_API}/dashboard/analytics/views/`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: await requisicao.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const corpo = await respostaApi.text();
    return new NextResponse(corpo || null, {
      status: respostaApi.status,
      headers: {
        "Content-Type": respostaApi.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (erro) {
    const expirou = erro instanceof Error && erro.name === "TimeoutError";
    return NextResponse.json(
      {
        detail: expirou
          ? "O serviço demorou demasiado a responder."
          : "Não foi possível contactar o serviço.",
      },
      { status: expirou ? 504 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
