import { NextResponse } from "next/server";
import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

export async function PATCH(
  requisicao: Request,
  contexto: { params: Promise<{ serviceId: string }> },
) {
  const { serviceId } = await contexto.params;
  if (!/^\d+$/.test(serviceId) || Number(serviceId) < 1) {
    return NextResponse.json(
      { detail: "Indica um identificador de serviço válido." },
      { status: 400 },
    );
  }
  return encaminharPedidoAutenticado(
    requisicao,
    `/services/${serviceId}/`,
  );
}
