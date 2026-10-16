import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESSAO } from "@/lib/auth-server";
import HomeGate from "./home-gate";

export default async function PaginaInicial() {
  const sessao = await cookies();
  if (sessao.has(COOKIE_SESSAO)) redirect("/conta");
  return <HomeGate />;
}
