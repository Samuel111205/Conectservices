import { NextResponse } from "next/server";
import {
  URL_BASE_API,
  autenticacaoIndisponivel,
  eMesmaOrigem,
  encaminharRespostaApi,
} from "@/lib/auth-server";

export async function POST(requisicao: Request) {
  if (!eMesmaOrigem(requisicao)) {
    return NextResponse.json({ detail: "Origem do pedido não permitida." }, { status: 403 });
  }

  let dadosRecebidos: unknown;
  try {
    dadosRecebidos = await requisicao.json();
  } catch {
    return NextResponse.json(
      { detail: "O pedido não contém JSON válido." },
      { status: 400 },
    );
  }

  try {
    const respostaExterna = await fetch(`${URL_BASE_API}/auth/register/`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(dadosRecebidos),
      cache: "no-store",
    });
    return encaminharRespostaApi(respostaExterna);
  } catch (erro) {
    console.error("Falha ao contactar a API para criar a conta.", erro);
    return autenticacaoIndisponivel();
  }
}
