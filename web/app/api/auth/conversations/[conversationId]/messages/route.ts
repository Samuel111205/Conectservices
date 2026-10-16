import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

type ContextoRota = { params: Promise<{ conversationId: string }> };

async function encaminharMensagens(
  requisicao: Request,
  contexto: ContextoRota,
) {
  const { conversationId } = await contexto.params;
  if (!/^\d+$/.test(conversationId)) {
    return Response.json({ detail: "Conversa não encontrada." }, { status: 404 });
  }
  return encaminharPedidoAutenticado(
    requisicao,
    `/conversations/${conversationId}/messages/`,
  );
}

export function GET(requisicao: Request, contexto: ContextoRota) {
  return encaminharMensagens(requisicao, contexto);
}

export function POST(requisicao: Request, contexto: ContextoRota) {
  return encaminharMensagens(requisicao, contexto);
}
