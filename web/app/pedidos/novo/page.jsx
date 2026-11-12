"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import { requisitarJson, fetchApi } from "@/lib/api-client";
import EstruturaAutenticacao from "../../auth-shell";
import styles from "../../auth.module.css";
function obterMensagemErro(dadosRecebidos) {
    if (dadosRecebidos && typeof dadosRecebidos === "object") {
        const valores = Object.values(dadosRecebidos).flatMap((valor) => Array.isArray(valor) ? valor : [valor]);
        const mensagem = valores.find((valor) => typeof valor === "string");
        if (typeof mensagem === "string")
            return mensagem;
    }
    return "Não foi possível enviar o pedido. Confirma os dados e tenta novamente.";
}
export default function PaginaNovoPedido() {
    const navegador = useRouter();
    const [categorias, definirCategorias] = useState([]);
    const [municipios, definirMunicipios] = useState([]);
    const [categoria, setCategory] = useState("");
    const [title, setTitle] = useState("");
    const [descricao, definirDescricao] = useState("");
    const [municipality, setMunicipality] = useState("");
    const [neighborhood, setNeighborhood] = useState("");
    const [address, setAddress] = useState("");
    const [minimumBudget, setMinimumBudget] = useState("");
    const [maximumBudget, setMaximumBudget] = useState("");
    const [duration, setDuration] = useState("");
    const [requestedAt, setRequestedAt] = useState("");
    const [prestadorDeOrigem, definirPrestadorDeOrigem] = useState("");
    const [erro, definirErro] = useState("");
    const [estaCarregando, definirCarregamento] = useState(true);
    const [estaAEnviar, definirEnvio] = useState(false);
    useEffect(() => {
        let ativo = true;
        Promise.all([
            requisitarJson("/api/public/categories/?parent=null"),
            requisitarJson("/api/public/municipalities/"),
        ])
            .then(([paginaCategorias, paginaMunicipios]) => {
            if (ativo) {
                definirCategorias(paginaCategorias.results);
                definirMunicipios(paginaMunicipios.results);
                const parametros = new URLSearchParams(window.location.search);
                const categoriaPreSelecionada = parametros.get("category");
                if (categoriaPreSelecionada &&
                    paginaCategorias.results.some((item) => String(item.id) === categoriaPreSelecionada)) {
                    setCategory(categoriaPreSelecionada);
                }
                setTitle(parametros.get("title")?.slice(0, 160) ?? "");
                definirDescricao(parametros.get("description")?.slice(0, 5000) ?? "");
                definirPrestadorDeOrigem(parametros.get("source_provider")?.slice(0, 160) ?? "");
                const minimo = parametros.get("minimum_budget") ?? "";
                const maximo = parametros.get("maximum_budget") ?? "";
                const duracao = parametros.get("duration") ?? "";
                if (/^\d+(\.\d{1,2})?$/.test(minimo))
                    setMinimumBudget(minimo);
                if (/^\d+(\.\d{1,2})?$/.test(maximo))
                    setMaximumBudget(maximo);
                if (/^\d{1,4}$/.test(duracao) && Number(duracao) <= 1440) {
                    setDuration(duracao);
                }
            }
        })
            .catch((motivo) => {
            if (ativo) {
                definirErro(motivo instanceof Error
                    ? motivo.message
                    : "Não foi possível carregar os dados do formulário.");
            }
        })
            .finally(() => {
            if (ativo)
                definirCarregamento(false);
        });
        return () => {
            ativo = false;
        };
    }, []);
    async function enviarFormulario(evento) {
        evento.preventDefault();
        definirErro("");
        definirEnvio(true);
        try {
            const respostaHttp = await fetchApi("/api/auth/orders/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category: Number(categoria),
                    title,
                    description: descricao,
                    municipality: Number(municipality),
                    neighborhood,
                    address,
                    minimum_budget: minimumBudget || null,
                    maximum_budget: maximumBudget || null,
                    requested_duration_minutes: duration ? Number(duration) : null,
                    requested_at: requestedAt ? new Date(requestedAt).toISOString() : null,
                }),
            });
            const dadosRecebidos = await respostaHttp.json();
            if (respostaHttp.status === 401) {
                const next = `${window.location.pathname}${window.location.search}`;
                navegador.replace(`/entrar?next=${encodeURIComponent(next)}`);
                return;
            }
            if (!respostaHttp.ok) {
                definirErro(obterMensagemErro(dadosRecebidos));
                return;
            }
            navegador.replace("/pedidos");
        }
        catch {
            definirErro("Não foi possível contactar o serviço. Tenta novamente.");
        }
        finally {
            definirEnvio(false);
        }
    }
    return (_jsxs(EstruturaAutenticacao, { account: true, children: [_jsx("p", { className: styles.eyebrow, children: "Pedir um servi\u00E7o" }), _jsx("h1", { children: "O que precisas?" }), _jsx("p", { className: styles.intro, children: "Descreve o trabalho e a zona. O teu pedido ficar\u00E1 vis\u00EDvel a prestadores eleg\u00EDveis para que possam enviar propostas." }), prestadorDeOrigem && (_jsxs("aside", { className: styles.requestContext, children: [_jsxs("strong", { children: ["Pedido iniciado a partir de ", prestadorDeOrigem] }), _jsx("span", { children: "Os dados do servi\u00E7o foram pr\u00E9-preenchidos. Ao enviar, o pedido ser\u00E1 partilhado com prestadores eleg\u00EDveis na categoria e localiza\u00E7\u00E3o escolhidas, n\u00E3o apenas com este prestador." })] })), estaCarregando ? (_jsx("p", { className: styles.intro, "aria-live": "polite", children: "A carregar categorias e munic\u00EDpios\u2026" })) : (_jsxs("form", { className: styles.form, onSubmit: enviarFormulario, children: [_jsxs("label", { className: styles.field, children: ["Categoria", _jsxs("select", { required: true, value: categoria, onChange: (evento) => setCategory(evento.target.value), children: [_jsx("option", { value: "", children: "Seleciona uma categoria" }), categorias.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] })] }), _jsxs("label", { className: styles.field, children: ["T\u00EDtulo do pedido", _jsx("input", { required: true, maxLength: 160, value: title, onChange: (evento) => setTitle(evento.target.value), placeholder: "Ex.: Instalar ilumina\u00E7\u00E3o numa sala" })] }), _jsxs("label", { className: styles.field, children: ["Descreve o que precisas", _jsx("textarea", { required: true, maxLength: 5000, rows: 5, value: descricao, onChange: (evento) => definirDescricao(evento.target.value), placeholder: "Inclui detalhes que ajudem o profissional a preparar uma proposta." })] }), _jsxs("label", { className: styles.field, children: ["Munic\u00EDpio", _jsxs("select", { required: true, value: municipality, onChange: (evento) => setMunicipality(evento.target.value), children: [_jsx("option", { value: "", children: "Seleciona um munic\u00EDpio" }), municipios.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] })] }), _jsxs("label", { className: styles.field, children: ["Bairro ", _jsx("span", { children: "(opcional)" }), _jsx("input", { maxLength: 120, value: neighborhood, onChange: (evento) => setNeighborhood(evento.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Morada ", _jsx("span", { children: "(opcional; vis\u00EDvel apenas nas etapas apropriadas)" }), _jsx("input", { maxLength: 250, value: address, onChange: (evento) => setAddress(evento.target.value) })] }), _jsxs("div", { className: styles.formRow, children: [_jsxs("label", { className: styles.field, children: ["Or\u00E7amento m\u00EDnimo (AOA) ", _jsx("span", { children: "(opcional)" }), _jsx("input", { type: "number", min: "0", step: "0.01", value: minimumBudget, onChange: (evento) => setMinimumBudget(evento.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Or\u00E7amento m\u00E1ximo (AOA) ", _jsx("span", { children: "(opcional)" }), _jsx("input", { type: "number", min: "0", step: "0.01", value: maximumBudget, onChange: (evento) => setMaximumBudget(evento.target.value) })] })] }), _jsxs("div", { className: styles.formRow, children: [_jsxs("label", { className: styles.field, children: ["Dura\u00E7\u00E3o estimada (minutos) ", _jsx("span", { children: "(opcional)" }), _jsx("input", { type: "number", min: "1", max: "1440", value: duration, onChange: (evento) => setDuration(evento.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Data pretendida ", _jsx("span", { children: "(opcional)" }), _jsx("input", { type: "datetime-local", value: requestedAt, onChange: (evento) => setRequestedAt(evento.target.value) })] })] }), erro && (_jsx("p", { className: styles.notice, role: "alert", children: erro })), _jsx("button", { className: styles.submit, type: "submit", disabled: estaAEnviar || !categorias.length || !municipios.length, children: estaAEnviar ? "A enviar pedido…" : "Enviar pedido" })] })), _jsx("div", { className: styles.accountActions, children: _jsx(Link, { className: styles.secondary, href: "/pedidos", children: "Ver os meus pedidos" }) })] }));
}
