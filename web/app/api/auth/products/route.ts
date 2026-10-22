import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

export function GET(requisicao: Request) {
  return encaminharPedidoAutenticado(requisicao, "/products/mine/");
}

export function POST(requisicao: Request) {
  return encaminharPedidoAutenticado(requisicao, "/products/");
}
