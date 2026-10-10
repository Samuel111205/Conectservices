import { NextResponse } from "next/server";
import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

export async function DELETE(
  requisicao: Request,
  contexto: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await contexto.params;
  if (!/^\d+$/.test(documentId) || Number(documentId) < 1) {
    return NextResponse.json(
      { detail: "Indica um identificador de documento válido." },
      { status: 400 },
    );
  }
  return encaminharPedidoAutenticado(
    requisicao,
    `/providers/me/verification-documents/${documentId}/`,
  );
}
