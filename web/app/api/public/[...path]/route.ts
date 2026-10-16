import { NextResponse, type NextRequest } from "next/server";

import { URL_BASE_API } from "@/lib/auth-server";

const endpointsPermitidos = new Set([
  "categories",
  "municipalities",
  "providers/discover",
  "services",
  "reviews",
  "availability",
]);
const endpointsDeAutenticacao = new Set([
  "auth/verify-email",
  "auth/verify-email/resend",
  "auth/password-reset",
  "auth/password-reset/confirm",
]);

export async function GET(
  requisicao: NextRequest,
  contexto: { params: Promise<{ path: string[] }> },
) {
  const { path } = await contexto.params;
  const endpoint = path.join("/");
  const consulta = requisicao.nextUrl.searchParams;
  const endpointDePrestador = /^providers\/\d+$/.test(endpoint);
  const endpointDeServico = /^services\/\d+$/.test(endpoint);
  if (!endpointsPermitidos.has(endpoint) && !endpointDePrestador && !endpointDeServico) {
    return NextResponse.json({ detail: "Recurso não encontrado." }, { status: 404 });
  }
  if (
    (endpoint === "reviews" && !/^\d+$/.test(consulta.get("provider_id") ?? "")) ||
    (endpoint === "availability" && !/^\d+$/.test(consulta.get("provider") ?? ""))
  ) {
    return NextResponse.json({ detail: "Indica um prestador válido." }, { status: 400 });
  }

  const consultaApi = requisicao.nextUrl.search;
  try {
    const respostaApi = await fetch(
      `${URL_BASE_API}/${endpoint}/${consultaApi}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
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
          ? "O serviço demorou demasiado a responder. Tenta novamente."
          : "Não foi possível contactar o serviço. Confirma se a API está disponível.",
      },
      { status: expirou ? 504 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(
  requisicao: NextRequest,
  contexto: { params: Promise<{ path: string[] }> },
) {
  const { path } = await contexto.params;
  const endpoint = path.join("/");
  if (!endpointsDeAutenticacao.has(endpoint)) {
    return NextResponse.json({ detail: "Recurso não encontrado." }, { status: 404 });
  }
  try {
    const respostaApi = await fetch(`${URL_BASE_API}/${endpoint}/`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: await requisicao.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    return NextResponse.json(await respostaApi.json().catch(() => ({})), {
      status: respostaApi.status,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return NextResponse.json(
      { detail: "Não foi possível contactar o serviço. Tenta novamente." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
