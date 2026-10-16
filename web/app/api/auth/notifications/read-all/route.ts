import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

export function POST(requisicao: Request) {
  return encaminharPedidoAutenticado(requisicao, "/notifications/read_all/");
}
