import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

export function GET(requisicao: Request) {
  return encaminharPedidoAutenticado(
    requisicao,
    "/providers/me/verification-documents/",
  );
}

export function POST(requisicao: Request) {
  return encaminharPedidoAutenticado(
    requisicao,
    "/providers/me/verification-documents/",
  );
}
