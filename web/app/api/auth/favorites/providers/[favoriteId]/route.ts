import { NextResponse } from "next/server";
import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

type RouteContext = { params: Promise<{ favoriteId: string }> };

export async function DELETE(requisicao: Request, { params }: RouteContext) {
  const { favoriteId } = await params;
  if (!/^\d+$/.test(favoriteId)) {
    return NextResponse.json({ detail: "Indica um favorito válido." }, { status: 400 });
  }
  return encaminharPedidoAutenticado(requisicao, `/favorites/providers/${favoriteId}/`);
}
