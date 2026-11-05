import { NextResponse, type NextRequest } from "next/server";
import { URL_BASE_API } from "@/lib/auth-server";

const caminhosAdminPermitidos = new Set([
  "accounts/user",
  "businesses/businessprofile",
  "providers/provider",
  "providers/providerverificationauditevent",
  "providers/providerverificationdocument",
  "catalog/category",
  "catalog/service",
  "orders/serviceorder",
  "proposals/proposal",
  "bookings/booking",
  "reviews/review",
]);

export async function GET(
  requisicao: NextRequest,
  contexto: { params: Promise<{ path: string[] }> },
) {
  const { path } = await contexto.params;
  const caminho = path.join("/").toLocaleLowerCase("en-US");
  const detalhePrestador = /^providers\/provider\/\d+\/change$/.test(caminho);
  if (!caminhosAdminPermitidos.has(caminho) && !detalhePrestador) {
    return NextResponse.json({ detail: "Área administrativa não encontrada." }, { status: 404 });
  }

  const origemApi = new URL(URL_BASE_API);
  origemApi.pathname = `${origemApi.pathname.replace(/\/api\/v1\/?$/, "")}/admin/${path.join("/") ? `${path.join("/")}/` : ""}`;
  origemApi.search = requisicao.nextUrl.search;
  return NextResponse.redirect(origemApi, 307);
}
