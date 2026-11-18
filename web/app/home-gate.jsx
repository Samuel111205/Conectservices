"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useRouter } from "@/lib/navigation";
import { useEffect } from "react";
import { readActiveArea, rememberActiveArea } from "@/lib/active-area";
import PaginaInicialPublica from "./landing-page";
export default function HomeGate() {
    const router = useRouter();
    useEffect(() => {
        let ativo = true;
        async function abrirAreaPessoal() {
            try {
                const sessao = await fetchApi("/api/auth/me/", { cache: "no-store" });
                if (!ativo || !sessao.ok)
                    return;
                const acessoAdministrativo = await fetchApi(
                    "/api/auth/admin/dashboard?period=30",
                    { cache: "no-store" },
                );
                if (!ativo)
                    return;
                if (acessoAdministrativo.ok) {
                    const painel = await acessoAdministrativo.json();
                    router.replace("/admin", { state: { adminDashboard: painel } });
                    return;
                }
                const areaGuardada = readActiveArea();
                const perfilProfissional = await fetchApi("/api/auth/providers/me/", {
                    cache: "no-store",
                });
                if (!ativo)
                    return;
                let area = areaGuardada;
                if (area === "provider" && perfilProfissional.status === 404) {
                    area = "client";
                }
                if (area === "company") {
                    const perfilEmpresa = await fetchApi("/api/auth/businesses/me/", {
                        cache: "no-store",
                    });
                    if (!ativo)
                        return;
                    if (perfilEmpresa.status === 404)
                        area = "provider";
                }
                if (!area)
                    area = perfilProfissional.ok ? "provider" : "client";
                rememberActiveArea(area);
                router.replace(
                    area === "company"
                        ? "/empresa"
                        : area === "provider"
                            ? "/prestador"
                            : "/conta",
                );
            }
            catch {
                // A página pública continua disponível se a API estiver temporariamente indisponível.
            }
        }
        void abrirAreaPessoal();
        return () => { ativo = false; };
    }, [router]);
    return _jsx(PaginaInicialPublica, {});
}
