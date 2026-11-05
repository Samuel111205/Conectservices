import { NextResponse } from "next/server";
import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

type RouteContext = { params: Promise<{ availabilityId: string }> };

async function obterEndpoint({ params }: RouteContext) {
  const { availabilityId } = await params;
  if (!/^\d+$/.test(availabilityId)) return null;
  return `/availability/${availabilityId}/`;
}

export async function PATCH(requisicao: Request, contexto: RouteContext) {
  const endpoint = await obterEndpoint(contexto);
  if (!endpoint) return NextResponse.json({ detail: "Indica um horário válido." }, { status: 400 });
  return encaminharPedidoAutenticado(requisicao, endpoint);
}

export async function DELETE(requisicao: Request, contexto: RouteContext) {
  const endpoint = await obterEndpoint(contexto);
  if (!endpoint) return NextResponse.json({ detail: "Indica um horário válido." }, { status: 400 });
  return encaminharPedidoAutenticado(requisicao, endpoint);
}
