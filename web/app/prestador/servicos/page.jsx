"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import { requisitarJson, fetchApi } from "@/lib/api-client";
import EstruturaAutenticacao from "../../auth-shell";
import styles from "../../auth.module.css";
const tiposPreco = [
    { value: "FIXED", label: "Preço fixo" },
    { value: "STARTING_AT", label: "A partir de" },
    { value: "RANGE", label: "Faixa de preço" },
    { value: "ON_REQUEST", label: "Sob consulta" },
];
function obterMensagemErro(dados) {
    if (dados && typeof dados === "object") {
        const mensagens = Object.values(dados).flatMap((valor) => Array.isArray(valor) ? valor : [valor]);
        const mensagem = mensagens.find((valor) => typeof valor === "string");
        if (typeof mensagem === "string")
            return mensagem;
    }
    return "Não foi possível concluir a operação. Confirma os dados e tenta novamente.";
}
function formatarPreco(servico) {
    if (servico.price_type === "ON_REQUEST" || servico.minimum_price === null) {
        return "Preço sob consulta";
    }
    const minimo = Number(servico.minimum_price).toLocaleString("pt-AO");
    if (servico.price_type === "RANGE" && servico.maximum_price !== null) {
        return `${minimo}–${Number(servico.maximum_price).toLocaleString("pt-AO")} ${servico.currency}`;
    }
    if (servico.price_type === "STARTING_AT") {
        return `Desde ${minimo} ${servico.currency}`;
    }
    return `${minimo} ${servico.currency}`;
}
export default function PaginaServicosPrestador() {
    const navegador = useRouter();
    const [categorias, definirCategorias] = useState([]);
    const [servicos, definirServicos] = useState([]);
    const [prestador, definirPrestador] = useState(null);
    const [estaCarregando, definirCarregamento] = useState(true);
    const [erro, definirErro] = useState("");
    const [aGuardar, definirGravacao] = useState(false);
    const [idEmAtualizacao, definirIdEmAtualizacao] = useState(null);
    const [idEmAlteracao, definirIdEmAlteracao] = useState(null);
    const [erroFormulario, definirErroFormulario] = useState("");
    const [categoria, definirCategoria] = useState("");
    const [nome, definirNome] = useState("");
    const [descricao, definirDescricao] = useState("");
    const [tipoPreco, definirTipoPreco] = useState("FIXED");
    const [precoMinimo, definirPrecoMinimo] = useState("");
    const [precoMaximo, definirPrecoMaximo] = useState("");
    const [duracao, definirDuracao] = useState("");
    const [ativo, definirAtivo] = useState(true);
    const prestadorVerificado = prestador?.verification_status === "VERIFIED";
    useEffect(() => {
        let mounted = true;
        Promise.all([
            fetchApi("/api/auth/services/", { cache: "no-store" }),
            fetchApi("/api/auth/providers/me/", { cache: "no-store" }),
            requisitarJson("/api/public/categories/?parent=null"),
        ])
            .then(async ([respostaServicos, respostaPrestador, paginaCategorias]) => {
            if (respostaServicos.status === 401 || respostaPrestador.status === 401) {
                navegador.replace("/entrar?next=%2Fprestador%2Fservicos");
                return;
            }
            if (!respostaServicos.ok ||
                (!respostaPrestador.ok && respostaPrestador.status !== 404)) {
                throw new Error("Não foi possível carregar os serviços e categorias.");
            }
            const [paginaServicos, dadosPrestador] = (await Promise.all([
                respostaServicos.json(),
                respostaPrestador.status === 404
                    ? Promise.resolve(null)
                    : respostaPrestador.json(),
            ]));
            if (!mounted)
                return;
            definirServicos(paginaServicos.results);
            definirPrestador(dadosPrestador);
            definirCategorias(paginaCategorias.results);
            definirCategoria(paginaCategorias.results[0]
                ? String(paginaCategorias.results[0].id)
                : "");
        })
            .catch((motivo) => {
            if (mounted) {
                definirErro(motivo instanceof Error
                    ? motivo.message
                    : "Não foi possível carregar os serviços.");
            }
        })
            .finally(() => {
            if (mounted)
                definirCarregamento(false);
        });
        return () => {
            mounted = false;
        };
    }, [navegador]);
    function prepararEdicao(servico) {
        definirIdEmAtualizacao(servico.id);
        definirErroFormulario("");
        definirCategoria(String(servico.category));
        definirNome(servico.name);
        definirDescricao(servico.description);
        definirTipoPreco(servico.price_type);
        definirPrecoMinimo(servico.minimum_price ?? "");
        definirPrecoMaximo(servico.maximum_price ?? "");
        definirDuracao(servico.duration_minutes ? String(servico.duration_minutes) : "");
        definirAtivo(servico.is_active);
        document.getElementById("formulario-servico")?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
        });
    }
    function limparFormulario() {
        definirIdEmAtualizacao(null);
        definirErroFormulario("");
        definirNome("");
        definirDescricao("");
        definirTipoPreco("FIXED");
        definirPrecoMinimo("");
        definirPrecoMaximo("");
        definirDuracao("");
        definirAtivo(prestadorVerificado);
    }
    async function guardarServico(evento) {
        evento.preventDefault();
        definirErroFormulario("");
        definirGravacao(true);
        const payload = {
            category: Number(categoria),
            name: nome,
            description: descricao,
            minimum_price: tipoPreco === "ON_REQUEST" || !precoMinimo ? null : precoMinimo,
            maximum_price: tipoPreco === "FIXED"
                ? precoMinimo || null
                : tipoPreco === "RANGE" && precoMaximo
                    ? precoMaximo
                    : null,
            currency: "AOA",
            price_type: tipoPreco,
            duration_minutes: duracao ? Number(duracao) : null,
            is_active: ativo,
        };
        try {
            const resposta = await fetchApi(idEmAtualizacao
                ? `/api/auth/services/${idEmAtualizacao}/`
                : "/api/auth/services/", {
                method: idEmAtualizacao ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const dados = await resposta.json();
            if (resposta.status === 401) {
                navegador.replace("/entrar?next=%2Fprestador%2Fservicos");
                return;
            }
            if (!resposta.ok) {
                definirErroFormulario(obterMensagemErro(dados));
                return;
            }
            const servicoGuardado = dados;
            definirServicos((atuais) => {
                const semServicoGuardado = atuais.filter((servico) => servico.id !== servicoGuardado.id);
                return [...semServicoGuardado, servicoGuardado].sort((a, b) => a.name.localeCompare(b.name, "pt"));
            });
            limparFormulario();
        }
        catch {
            definirErroFormulario("Não foi possível contactar o serviço.");
        }
        finally {
            definirGravacao(false);
        }
    }
    async function alternarEstado(servico) {
        definirIdEmAlteracao(servico.id);
        definirErro("");
        try {
            const resposta = await fetchApi(`/api/auth/services/${servico.id}/`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_active: !servico.is_active }),
            });
            const dados = await resposta.json();
            if (resposta.status === 401) {
                navegador.replace("/entrar?next=%2Fprestador%2Fservicos");
                return;
            }
            if (!resposta.ok) {
                definirErro(obterMensagemErro(dados));
                return;
            }
            const atualizado = dados;
            definirServicos((atuais) => atuais.map((item) => (item.id === atualizado.id ? atualizado : item)));
        }
        catch {
            definirErro("Não foi possível contactar o serviço.");
        }
        finally {
            definirIdEmAlteracao(null);
        }
    }
    return (_jsxs(EstruturaAutenticacao, { account: true, children: [_jsx("p", { className: styles.eyebrow, children: "\u00C1rea do prestador" }), _jsx("h1", { children: "Os meus servi\u00E7os" }), _jsx("p", { className: styles.intro, children: "Publica e mant\u00E9m atualizada a lista de servi\u00E7os que os clientes podem encontrar no cat\u00E1logo." }), _jsxs("div", { className: styles.accountActions, children: [_jsx(Link, { className: styles.secondary, href: "/perfil", children: "Gerir perfil profissional" }), _jsx(Link, { className: styles.secondary, href: "/prestador/pedidos", children: "Ver pedidos dispon\u00EDveis" })] }), estaCarregando ? (_jsx("p", { className: styles.intro, "aria-live": "polite", children: "A carregar servi\u00E7os\u2026" })) : erro ? (_jsx("p", { className: styles.notice, role: "alert", children: erro })) : !prestador ? (_jsxs("section", { className: styles.profileSection, children: [_jsx("h2", { children: "Cria primeiro o teu perfil profissional" }), _jsx("p", { className: styles.profileHint, children: "O perfil profissional \u00E9 necess\u00E1rio para poderes gerir servi\u00E7os." }), _jsx(Link, { className: styles.submit, href: "/perfil", children: "Criar perfil profissional" })] })) : (_jsxs(_Fragment, { children: [!prestadorVerificado && (_jsx("p", { className: styles.notice, role: "status", children: "O teu perfil ainda n\u00E3o est\u00E1 verificado. Podes guardar servi\u00E7os como rascunho, mas s\u00F3 os perfis verificados podem public\u00E1-los." })), _jsxs("section", { className: styles.profileSection, children: [_jsxs("div", { className: styles.profileHeading, children: [_jsx("h2", { children: "Servi\u00E7os publicados e rascunhos" }), _jsxs("span", { className: styles.profileBadge, children: [servicos.length, " no total"] })] }), servicos.length ? (_jsx("div", { className: styles.managedServiceList, children: servicos.map((servico) => (_jsxs("article", { className: styles.managedService, children: [_jsxs("div", { children: [_jsxs("div", { className: styles.profileHeading, children: [_jsx("h3", { children: servico.name }), _jsx("span", { className: styles.profileBadge, children: servico.is_active ? "Publicado" : "Rascunho" })] }), _jsx("p", { children: servico.description || "Sem descrição." }), _jsxs("small", { children: [categorias.find((item) => item.id === servico.category)?.name ?? "Categoria", " \u00B7", " ", formatarPreco(servico), servico.duration_minutes
                                                            ? ` · ${servico.duration_minutes} min`
                                                            : ""] })] }), _jsxs("div", { className: styles.managedServiceActions, children: [_jsx("button", { className: styles.secondary, type: "button", onClick: () => prepararEdicao(servico), children: "Editar" }), _jsx("button", { className: styles.secondary, type: "button", disabled: idEmAlteracao === servico.id, onClick: () => void alternarEstado(servico), children: idEmAlteracao === servico.id
                                                        ? "A atualizar…"
                                                        : servico.is_active
                                                            ? "Despublicar"
                                                            : "Publicar" })] })] }, servico.id))) })) : (_jsx("p", { className: styles.profileHint, children: "Ainda n\u00E3o tens servi\u00E7os. Usa o formul\u00E1rio abaixo para criar o primeiro." }))] }), _jsxs("section", { className: styles.profileSection, id: "formulario-servico", children: [_jsxs("div", { className: styles.profileHeading, children: [_jsx("h2", { children: idEmAtualizacao ? "Editar serviço" : "Adicionar serviço" }), idEmAtualizacao && (_jsx("button", { className: styles.secondary, type: "button", onClick: limparFormulario, children: "Cancelar edi\u00E7\u00E3o" }))] }), _jsxs("form", { className: styles.form, onSubmit: guardarServico, children: [_jsxs("label", { className: styles.field, children: ["Categoria", _jsx("select", { required: true, value: categoria, onChange: (evento) => definirCategoria(evento.target.value), children: categorias.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id))) })] }), _jsxs("label", { className: styles.field, children: ["Nome do servi\u00E7o", _jsx("input", { required: true, maxLength: 160, value: nome, onChange: (evento) => definirNome(evento.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Descri\u00E7\u00E3o ", _jsx("span", { children: "(opcional)" }), _jsx("textarea", { maxLength: 5000, rows: 4, value: descricao, onChange: (evento) => definirDescricao(evento.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Tipo de pre\u00E7o", _jsx("select", { value: tipoPreco, onChange: (evento) => definirTipoPreco(evento.target.value), children: tiposPreco.map((tipo) => (_jsx("option", { value: tipo.value, children: tipo.label }, tipo.value))) })] }), tipoPreco !== "ON_REQUEST" && (_jsxs("div", { className: styles.formRow, children: [_jsxs("label", { className: styles.field, children: [tipoPreco === "STARTING_AT" ? "Preço inicial (AOA)" : "Preço mínimo (AOA)", _jsx("input", { required: true, type: "number", min: "0", step: "0.01", value: precoMinimo, onChange: (evento) => definirPrecoMinimo(evento.target.value) })] }), tipoPreco === "RANGE" && (_jsxs("label", { className: styles.field, children: ["Pre\u00E7o m\u00E1ximo (AOA)", _jsx("input", { required: true, type: "number", min: "0", step: "0.01", value: precoMaximo, onChange: (evento) => definirPrecoMaximo(evento.target.value) })] }))] })), _jsxs("label", { className: styles.field, children: ["Dura\u00E7\u00E3o estimada em minutos ", _jsx("span", { children: "(opcional)" }), _jsx("input", { type: "number", min: "1", max: "1440", value: duracao, onChange: (evento) => definirDuracao(evento.target.value) })] }), _jsxs("label", { className: styles.checkboxField, children: [_jsx("input", { type: "checkbox", checked: ativo, disabled: !prestadorVerificado, onChange: (evento) => definirAtivo(evento.target.checked) }), "Publicar este servi\u00E7o no cat\u00E1logo"] }), erroFormulario && _jsx("p", { className: styles.notice, role: "alert", children: erroFormulario }), _jsx("button", { className: styles.submit, type: "submit", disabled: aGuardar || !categorias.length, children: aGuardar ? "A guardar…" : idEmAtualizacao ? "Guardar alterações" : "Criar serviço" })] })] })] }))] }));
}
