import { NextResponse } from "next/server";
import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

const acoesPermitidas = new Set(["accept", "reject", "cancel"]);

export async function POST(
  requisicao: Request,
  contexto: { params: Promise<{ proposalId: string; action: string }> },
) {
  const { proposalId, action: acao } = await contexto.params;
  if (!/^[1-9]\d*$/.test(proposalId) || !acoesPermitidas.has(acao)) {
    return NextResponse.json(
      { detail: "Ação de proposta inválida." },
      { status: 404 },
    );
  }

  return encaminharPedidoAutenticado(
    requisicao,
    `/proposals/${proposalId}/${acao}/`,
  );
}
