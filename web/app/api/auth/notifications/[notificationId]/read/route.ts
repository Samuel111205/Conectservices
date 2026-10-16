import { NextResponse } from "next/server";
import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

export async function POST(
  requisicao: Request,
  contexto: { params: Promise<{ notificationId: string }> },
) {
  const { notificationId } = await contexto.params;
  if (!/^\d+$/.test(notificationId)) {
    return NextResponse.json({ detail: "Notificação inválida." }, { status: 400 });
  }
  return encaminharPedidoAutenticado(
    requisicao,
    `/notifications/${notificationId}/read/`,
  );
}
