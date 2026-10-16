"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readActiveArea, rememberActiveArea } from "@/lib/active-area";
import PaginaInicialPublica from "./landing-page";

export default function HomeGate() {
  const router = useRouter();
  useEffect(() => {
    let ativo = true;
    async function abrirAreaPessoal() {
      try {
        const sessao = await fetch("/api/auth/me/", { cache: "no-store" });
        if (!ativo || !sessao.ok) return;

        const areaGuardada = readActiveArea();
        const perfilProfissional = await fetch("/api/auth/providers/me/", {
          cache: "no-store",
        });
        if (!ativo) return;

        let area = areaGuardada;
        if (area === "provider" && perfilProfissional.status === 404) {
          area = "client";
        }
        if (!area) area = perfilProfissional.ok ? "provider" : "client";
        rememberActiveArea(area);
        router.replace(area === "provider" ? "/prestador" : "/conta");
      } catch {
        // A página pública continua disponível se a API estiver temporariamente indisponível.
      }
    }

    void abrirAreaPessoal();
    return () => { ativo = false; };
  }, [router]);

  return <PaginaInicialPublica />;
}
