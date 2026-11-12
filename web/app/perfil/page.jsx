"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useRouter } from "@/lib/navigation";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";
const tiposDocumento = [
    { value: "IDENTITY", label: "Documento de identificação" },
    { value: "BUSINESS_REGISTRATION", label: "Registo comercial" },
    { value: "PROFESSIONAL_CERTIFICATE", label: "Certificação profissional" },
    { value: "OTHER", label: "Outro comprovativo" },
];
function extrairErros(dadosRecebidos) {
    if (!dadosRecebidos || typeof dadosRecebidos !== "object") {
        return { detail: ["Não foi possível concluir o pedido."] };
    }
    return Object.fromEntries(Object.entries(dadosRecebidos).map(([chave, valor]) => [
        chave,
        Array.isArray(valor) ? valor.map(String) : [String(valor)],
    ]));
}
function primeiroErro(erros) {
    return Object.values(erros)[0]?.[0] ?? "Não foi possível concluir o pedido.";
}
async function lerRecurso(endereco) {
    const respostaHttp = await fetchApi(endereco, { cache: "no-store" });
    if (respostaHttp.status === 404)
        return null;
    if (respostaHttp.status === 401)
        throw new Error("UNAUTHENTICATED");
    const dadosRecebidos = await respostaHttp.json();
    if (!respostaHttp.ok) {
        throw new Error(typeof dadosRecebidos?.detail === "string"
            ? dadosRecebidos.detail
            : "Não foi possível carregar os dados do perfil.");
    }
    return dadosRecebidos;
}
export default function PaginaPerfil() {
    const navegador = useRouter();
    const [perfilAtual, definirPerfilAtual] = useState(null);
    const [prestador, definirPrestador] = useState(null);
    const [estaCarregando, definirCarregamento] = useState(true);
    const [erro, definirErro] = useState("");
    const [erroPerfil, definirErroPerfil] = useState("");
    const [erroPrestador, definirErroPrestador] = useState("");
    const [documentos, definirDocumentos] = useState([]);
    const [erroDocumentos, definirErroDocumentos] = useState("");
    const [tipoDocumento, definirTipoDocumento] = useState("IDENTITY");
    const [aEnviarDocumento, definirEnvioDocumento] = useState(false);
    const [aSubmeterVerificacao, definirEnvioVerificacao] = useState(false);
    const [idDocumentoRemovido, definirIdDocumentoRemovido] = useState(null);
    const [aGuardarPerfil, definirGravacaoPerfil] = useState(false);
    const [aGuardarPrestador, definirGravacaoPrestador] = useState(false);
    const [nomeCompleto, definirNomeCompleto] = useState("");
    const [biografia, definirBiografia] = useState("");
    const [dataNascimento, definirDataNascimento] = useState("");
    const [nomeComercial, definirNomeComercial] = useState("");
    const [descricao, definirDescricao] = useState("");
    const [telefoneEmpresa, definirTelefoneEmpresa] = useState("");
    const [emailEmpresa, definirEmailEmpresa] = useState("");
    useEffect(() => {
        let ativo = true;
        Promise.all([
            lerRecurso("/api/auth/profiles/me/"),
            lerRecurso("/api/auth/providers/me/"),
        ])
            .then(async ([perfilAtual, prestadorAtual]) => {
            if (!ativo)
                return;
            definirPerfilAtual(perfilAtual);
            definirPrestador(prestadorAtual);
            if (perfilAtual) {
                definirNomeCompleto(perfilAtual.full_name);
                definirBiografia(perfilAtual.biography);
                definirDataNascimento(perfilAtual.birth_date ?? "");
            }
            if (prestadorAtual) {
                definirNomeComercial(prestadorAtual.commercial_name);
                definirDescricao(prestadorAtual.description);
                definirTelefoneEmpresa(prestadorAtual.business_phone);
                definirEmailEmpresa(prestadorAtual.business_email);
                try {
                    const respostaDocumentos = await fetchApi("/api/auth/provider-verification-documents/", { cache: "no-store" });
                    if (!ativo)
                        return;
                    if (respostaDocumentos.status === 401) {
                        navegador.replace("/entrar?next=%2Fperfil");
                        return;
                    }
                    if (!respostaDocumentos.ok) {
                        const dados = await respostaDocumentos.json();
                        definirErroDocumentos(primeiroErro(extrairErros(dados)));
                    }
                    else {
                        const paginaDocumentos = (await respostaDocumentos.json());
                        definirDocumentos(paginaDocumentos.results);
                    }
                }
                catch {
                    if (ativo) {
                        definirErroDocumentos("Não foi possível carregar os documentos de verificação.");
                    }
                }
            }
        })
            .catch((motivo) => {
            if (!ativo)
                return;
            if (motivo instanceof Error && motivo.message === "UNAUTHENTICATED") {
                navegador.replace("/entrar?next=%2Fperfil");
            }
            else {
                definirErro(motivo instanceof Error
                    ? motivo.message
                    : "Não foi possível carregar os perfis.");
            }
        })
            .finally(() => {
            if (ativo)
                definirCarregamento(false);
        });
        return () => {
            ativo = false;
        };
    }, [navegador]);
    async function guardarPerfil(evento) {
        evento.preventDefault();
        definirGravacaoPerfil(true);
        definirErroPerfil("");
        try {
            const respostaHttp = await fetchApi(perfilAtual ? "/api/auth/profiles/me/" : "/api/auth/profiles/", {
                method: perfilAtual ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    full_name: nomeCompleto,
                    biography: biografia,
                    birth_date: dataNascimento || null,
                }),
            });
            const dadosRecebidos = await respostaHttp.json();
            if (!respostaHttp.ok) {
                definirErroPerfil(primeiroErro(extrairErros(dadosRecebidos)));
                return;
            }
            definirPerfilAtual(dadosRecebidos);
        }
        catch {
            definirErroPerfil("Não foi possível contactar o serviço.");
        }
        finally {
            definirGravacaoPerfil(false);
        }
    }
    async function guardarPrestador(evento) {
        evento.preventDefault();
        definirGravacaoPrestador(true);
        definirErroPrestador("");
        try {
            const respostaHttp = await fetchApi(prestador ? "/api/auth/providers/me/" : "/api/auth/providers/", {
                method: prestador ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    commercial_name: nomeComercial,
                    description: descricao,
                    business_phone: telefoneEmpresa,
                    business_email: emailEmpresa,
                }),
            });
            const dadosRecebidos = await respostaHttp.json();
            if (!respostaHttp.ok) {
                definirErroPrestador(primeiroErro(extrairErros(dadosRecebidos)));
                return;
            }
            definirPrestador(dadosRecebidos);
        }
        catch {
            definirErroPrestador("Não foi possível contactar o serviço.");
        }
        finally {
            definirGravacaoPrestador(false);
        }
    }
    async function enviarDocumento(evento) {
        evento.preventDefault();
        const formulario = evento.currentTarget;
        const dadosFormulario = new FormData(formulario);
        definirErroDocumentos("");
        definirEnvioDocumento(true);
        try {
            const respostaHttp = await fetchApi("/api/auth/provider-verification-documents/", { method: "POST", body: dadosFormulario });
            const dadosRecebidos = await respostaHttp.json();
            if (respostaHttp.status === 401) {
                navegador.replace("/entrar?next=%2Fperfil");
                return;
            }
            if (!respostaHttp.ok) {
                definirErroDocumentos(primeiroErro(extrairErros(dadosRecebidos)));
                return;
            }
            definirDocumentos((atuais) => [...atuais, dadosRecebidos]);
            formulario.reset();
            definirTipoDocumento("IDENTITY");
        }
        catch {
            definirErroDocumentos("Não foi possível contactar o serviço.");
        }
        finally {
            definirEnvioDocumento(false);
        }
    }
    async function removerDocumento(documento) {
        definirErroDocumentos("");
        definirIdDocumentoRemovido(documento.id);
        try {
            const respostaHttp = await fetchApi(`/api/auth/provider-verification-documents/${documento.id}/`, { method: "DELETE" });
            if (respostaHttp.status === 401) {
                navegador.replace("/entrar?next=%2Fperfil");
                return;
            }
            if (!respostaHttp.ok) {
                const dadosRecebidos = await respostaHttp.json();
                definirErroDocumentos(primeiroErro(extrairErros(dadosRecebidos)));
                return;
            }
            definirDocumentos((atuais) => atuais.filter((item) => item.id !== documento.id));
        }
        catch {
            definirErroDocumentos("Não foi possível contactar o serviço.");
        }
        finally {
            definirIdDocumentoRemovido(null);
        }
    }
    async function submeterVerificacao() {
        definirErroDocumentos("");
        definirEnvioVerificacao(true);
        try {
            const respostaHttp = await fetchApi("/api/auth/providers/me/submit-verification/", { method: "POST" });
            const dadosRecebidos = await respostaHttp.json();
            if (respostaHttp.status === 401) {
                navegador.replace("/entrar?next=%2Fperfil");
                return;
            }
            if (!respostaHttp.ok) {
                definirErroDocumentos(primeiroErro(extrairErros(dadosRecebidos)));
                return;
            }
            definirPrestador(dadosRecebidos);
        }
        catch {
            definirErroDocumentos("Não foi possível contactar o serviço.");
        }
        finally {
            definirEnvioVerificacao(false);
        }
    }
    function textoEstadoVerificacao(provider) {
        if (provider.verification_status === "VERIFIED")
            return "Verificado";
        if (provider.verification_status === "REJECTED")
            return "Precisa de ajustes";
        if (provider.verification_status === "SUSPENDED")
            return "Suspenso";
        return provider.verification_submitted_at ? "Em análise" : "Rascunho";
    }
    const podeEnviarDocumentos = prestador?.verification_status === "PENDING" ||
        prestador?.verification_status === "REJECTED";
    const podeSubmeterVerificacao = Boolean(podeEnviarDocumentos) &&
        (prestador?.verification_status === "REJECTED" ||
            !prestador?.verification_submitted_at) &&
        documentos.length > 0;
    return (_jsxs(EstruturaAutenticacao, { account: true, area: prestador ? "provider" : "client", profileName: prestador?.commercial_name ?? perfilAtual?.full_name, children: [_jsx("p", { className: styles.eyebrow, children: "Personaliza\u00E7\u00E3o" }), _jsx("h1", { children: "Os teus perfis" }), _jsx("p", { className: styles.intro, children: "Cria o teu perfil pessoal, o teu perfil profissional, ou ambos. Podes atualizar estes dados mais tarde." }), estaCarregando ? (_jsx("p", { className: styles.intro, "aria-live": "polite", children: "A carregar os teus perfis\u2026" })) : erro ? (_jsx("p", { className: styles.notice, role: "alert", children: erro })) : (_jsxs("div", { className: styles.profileSections, id: "profile-settings", children: [_jsxs("section", { className: styles.profileSection, children: [_jsxs("div", { className: styles.profileHeading, children: [_jsx("h2", { children: "Perfil pessoal" }), perfilAtual && _jsx("span", { className: styles.profileBadge, children: "Criado" })] }), _jsxs("form", { className: styles.form, onSubmit: guardarPerfil, children: [_jsxs("label", { className: styles.field, children: ["Nome completo", _jsx("input", { name: "full_name", autoComplete: "name", required: true, maxLength: 160, value: nomeCompleto, onChange: (evento) => definirNomeCompleto(evento.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Sobre ti ", _jsx("span", { children: "(opcional)" }), _jsx("textarea", { name: "biography", maxLength: 2000, rows: 3, value: biografia, onChange: (evento) => definirBiografia(evento.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Data de nascimento ", _jsx("span", { children: "(opcional)" }), _jsx("input", { type: "date", name: "birth_date", value: dataNascimento, onChange: (evento) => definirDataNascimento(evento.target.value) })] }), erroPerfil && (_jsx("p", { className: styles.notice, role: "alert", children: erroPerfil })), _jsx("button", { className: styles.submit, type: "submit", disabled: aGuardarPerfil, children: aGuardarPerfil
                                            ? "A guardar…"
                                            : perfilAtual
                                                ? "Guardar perfil pessoal"
                                                : "Criar perfil pessoal" })] })] }), _jsxs("section", { className: styles.profileSection, children: [_jsxs("div", { className: styles.profileHeading, children: [_jsx("h2", { children: "Perfil profissional" }), prestador && (_jsx("span", { className: styles.profileBadge, children: textoEstadoVerificacao(prestador) }))] }), _jsx("p", { className: styles.profileHint, children: "Para apresentar os teus servi\u00E7os como profissional ou empresa." }), _jsxs("form", { className: styles.form, onSubmit: guardarPrestador, children: [_jsxs("label", { className: styles.field, children: ["Nome profissional ou comercial", _jsx("input", { name: "commercial_name", required: true, maxLength: 160, value: nomeComercial, onChange: (evento) => definirNomeComercial(evento.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Descri\u00E7\u00E3o ", _jsx("span", { children: "(opcional)" }), _jsx("textarea", { name: "description", maxLength: 5000, rows: 3, value: descricao, onChange: (evento) => definirDescricao(evento.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Telefone profissional ", _jsx("span", { children: "(opcional)" }), _jsx("input", { type: "tel", name: "business_phone", maxLength: 32, value: telefoneEmpresa, onChange: (evento) => definirTelefoneEmpresa(evento.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Email profissional ", _jsx("span", { children: "(opcional)" }), _jsx("input", { type: "email", name: "business_email", value: emailEmpresa, onChange: (evento) => definirEmailEmpresa(evento.target.value) })] }), erroPrestador && (_jsx("p", { className: styles.notice, role: "alert", children: erroPrestador })), _jsx("button", { className: styles.submit, type: "submit", disabled: aGuardarPrestador, children: aGuardarPrestador
                                            ? "A guardar…"
                                            : prestador
                                                ? "Guardar perfil profissional"
                                                : "Criar perfil profissional" })] }), prestador && (_jsxs("div", { className: styles.verificationPanel, children: [_jsxs("div", { children: [_jsx("h3", { children: "Verifica\u00E7\u00E3o profissional" }), _jsx("p", { children: "Envia comprovativos em PDF, JPEG ou PNG (m\u00E1ximo 10 MB por ficheiro). Os documentos ficam privados e s\u00F3 podem ser consultados por administradores durante a revis\u00E3o." })] }), prestador.verification_feedback && (_jsx("p", { className: styles.verificationFeedback, role: "status", children: prestador.verification_feedback })), documentos.length > 0 && (_jsx("ul", { className: styles.verificationDocumentList, children: documentos.map((documento) => (_jsxs("li", { children: [_jsxs("span", { children: [tiposDocumento.find((tipo) => tipo.value === documento.document_type)?.label ?? "Comprovativo", _jsxs("small", { children: ["Enviado em", " ", new Date(documento.uploaded_at).toLocaleDateString("pt-AO")] })] }), podeEnviarDocumentos &&
                                                    (prestador.verification_status === "REJECTED" ||
                                                        !prestador.verification_submitted_at) && (_jsx("button", { className: styles.documentRemove, type: "button", disabled: idDocumentoRemovido === documento.id, onClick: () => void removerDocumento(documento), children: idDocumentoRemovido === documento.id
                                                        ? "A remover…"
                                                        : "Remover" }))] }, documento.id))) })), podeEnviarDocumentos &&
                                        (prestador.verification_status === "REJECTED" ||
                                            !prestador.verification_submitted_at) && (_jsxs(_Fragment, { children: [_jsxs("form", { className: styles.verificationUploadForm, onSubmit: enviarDocumento, children: [_jsxs("label", { className: styles.field, children: ["Tipo de documento", _jsx("select", { name: "document_type", value: tipoDocumento, onChange: (evento) => definirTipoDocumento(evento.target.value), children: tiposDocumento.map((tipo) => (_jsx("option", { value: tipo.value, children: tipo.label }, tipo.value))) })] }), _jsxs("label", { className: styles.field, children: ["Ficheiro", _jsx("input", { name: "file", type: "file", accept: ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png", required: true })] }), _jsx("button", { className: styles.secondary, type: "submit", disabled: aEnviarDocumento, children: aEnviarDocumento ? "A enviar…" : "Adicionar documento" })] }), _jsx("button", { className: styles.submit, type: "button", disabled: !podeSubmeterVerificacao || aSubmeterVerificacao, onClick: () => void submeterVerificacao(), children: aSubmeterVerificacao
                                                    ? "A submeter…"
                                                    : prestador.verification_status === "REJECTED"
                                                        ? "Submeter novamente para revisão"
                                                        : "Enviar candidatura para revisão" })] })), prestador.verification_status === "PENDING" &&
                                        prestador.verification_submitted_at && (_jsxs("p", { className: styles.profileHint, children: ["Candidatura enviada em", " ", new Date(prestador.verification_submitted_at).toLocaleDateString("pt-AO"), ". Aguarda a revis\u00E3o administrativa."] })), erroDocumentos && (_jsx("p", { className: styles.notice, role: "alert", children: erroDocumentos }))] }))] })] })), _jsxs("div", { className: styles.accountActions, children: [_jsx("a", { className: styles.secondary, href: "/prestador/servicos", children: "Gerir os meus servi\u00E7os" }), _jsx("a", { className: styles.secondary, href: "/prestador/pedidos", children: "Ver pedidos dispon\u00EDveis" }), _jsx("a", { className: styles.secondary, href: "/contratacoes", children: "Ver contrata\u00E7\u00F5es" }), _jsx("a", { className: styles.secondary, href: "/conta", children: "Voltar \u00E0 \u00E1rea pessoal" })] })] }));
}
