import { NextResponse } from "next/server";
import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

const acoesPost = new Set([
  "schedule",
  "confirm",
  "start",
  "complete",
  "cancel",
]);

export async function GET(
  requisicao: Request,
  contexto: { params: Promise<{ bookingId: string; action: string }> },
) {
  const { bookingId, action: acao } = await contexto.params;
  if (!/^[1-9]\d*$/.test(bookingId) || acao !== "available-slots") {
    return NextResponse.json(
      { detail: "Ação de contratação inválida." },
      { status: 404 },
    );
  }
  return encaminharPedidoAutenticado(
    requisicao,
    `/bookings/${bookingId}/available-slots/`,
  );
}

export async function POST(
  requisicao: Request,
  contexto: { params: Promise<{ bookingId: string; action: string }> },
) {
  const { bookingId, action: acao } = await contexto.params;
  if (!/^[1-9]\d*$/.test(bookingId) || !acoesPost.has(acao)) {
    return NextResponse.json(
      { detail: "Ação de contratação inválida." },
      { status: 404 },
    );
  }
  return encaminharPedidoAutenticado(
    requisicao,
    `/bookings/${bookingId}/${acao}/`,
  );
}
