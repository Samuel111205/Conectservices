import { NextResponse } from "next/server";
import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

export async function PATCH(
  requisicao: Request,
  contexto: { params: Promise<{ productId: string }> },
) {
  const { productId } = await contexto.params;
  if (!/^[1-9]\d*$/.test(productId)) {
    return NextResponse.json({ detail: "Produto inválido." }, { status: 400 });
  }
  return encaminharPedidoAutenticado(requisicao, `/products/${productId}/`);
}

export async function DELETE(
  requisicao: Request,
  contexto: { params: Promise<{ productId: string }> },
) {
  const { productId } = await contexto.params;
  if (!/^[1-9]\d*$/.test(productId)) {
    return NextResponse.json({ detail: "Produto inválido." }, { status: 400 });
  }
  return encaminharPedidoAutenticado(requisicao, `/products/${productId}/`);
}
