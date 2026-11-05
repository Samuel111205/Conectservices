import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

export function GET(requisicao: Request) {
  return encaminharPedidoAutenticado(requisicao, "/availability/");
}

export function POST(requisicao: Request) {
  return encaminharPedidoAutenticado(requisicao, "/availability/");
}
