import { NextResponse } from "next/server";
import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

const acoesPermitidas = new Set(["accept", "reject", "complete", "cancel"]);

export async function POST(
  requisicao: Request,
  contexto: { params: Promise<{ orderId: string; action: string }> },
) {
  const { orderId, action } = await contexto.params;
  if (!/^[1-9]\d*$/.test(orderId) || !acoesPermitidas.has(action)) {
    return NextResponse.json({ detail: "Ação de encomenda inválida." }, { status: 404 });
  }
  return encaminharPedidoAutenticado(requisicao, `/product-orders/${orderId}/${action}/`);
}
