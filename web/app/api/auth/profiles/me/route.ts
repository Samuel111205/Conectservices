import { encaminharPedidoAutenticado } from "@/lib/authenticated-api";

export function GET(requisicao: Request) {
  return encaminharPedidoAutenticado(requisicao, "/profiles/me/");
}

export function PATCH(requisicao: Request) {
  return encaminharPedidoAutenticado(requisicao, "/profiles/me/");
}
