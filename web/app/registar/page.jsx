"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useState } from "react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";
function obterMensagemErro(dadosRecebidos) {
    if (dadosRecebidos && typeof dadosRecebidos === "object") {
        const campos = Object.values(dadosRecebidos).flatMap((valor) => Array.isArray(valor) ? valor : [valor]);
        const mensagem = campos.find((valor) => typeof valor === "string");
        if (typeof mensagem === "string")
            return mensagem;
    }
    return "Não foi possível criar a conta. Confirma os dados e tenta novamente.";
}
export default function PaginaRegistar() {
    const [tipoConta, definirTipoConta] = useState("client");
    const [correioEletronico, definirCorreioEletronico] = useState("");
    const [phone, setPhone] = useState("");
    const [palavraPasse, definirPalavraPasse] = useState("");
    const [confirmacao, setConfirmation] = useState("");
    const [mostrarPalavraPasse, definirMostrarPalavraPasse] = useState(false);
    const [mostrarConfirmacao, definirMostrarConfirmacao] = useState(false);
    const [erro, definirErro] = useState("");
    const [success, setSuccess] = useState("");
    const [signInHref, setSignInHref] = useState("/entrar");
    const [estaAEnviar, definirEnvio] = useState(false);
    async function enviarFormulario(evento) {
        evento.preventDefault();
        definirErro("");
        setSuccess("");
        if (palavraPasse !== confirmacao) {
            definirErro("As palavras-passe não coincidem.");
            return;
        }
        definirEnvio(true);
        try {
            const respostaHttp = await fetchApi("/api/auth/register/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: correioEletronico,
                    phone: phone.trim() || null,
                    password: palavraPasse,
                }),
            });
            const dadosRecebidos = await respostaHttp.json();
            if (!respostaHttp.ok) {
                definirErro(obterMensagemErro(dadosRecebidos));
                return;
            }
            const detalhe = dadosRecebidos && typeof dadosRecebidos === "object" && "detail" in dadosRecebidos
                ? dadosRecebidos.detail
                : "Conta criada. Já podes iniciar sessão.";
            setSuccess(typeof detalhe === "string"
                ? `${detalhe} Confirma o email antes de iniciar sessão.`
                : "Se os dados forem válidos, enviámos instruções para confirmar o email.");
            const destinoSeguinte = new URLSearchParams(window.location.search).get("next");
            const destinoPorTipo = {
                client: "/conta",
                business: "/empresa",
                provider: "/perfil",
            }[tipoConta];
            const destino = destinoSeguinte || destinoPorTipo;
            setSignInHref(`/entrar?next=${encodeURIComponent(destino)}`);
            definirPalavraPasse("");
            setConfirmation("");
        }
        catch {
            definirErro("Não foi possível contactar o serviço. Tenta novamente.");
        }
        finally {
            definirEnvio(false);
        }
    }
    return (_jsxs(EstruturaAutenticacao, { children: [_jsx("p", { className: styles.eyebrow, children: "Junta-te \u00E0 comunidade" }), _jsx("h1", { children: "Cria a tua conta" }), _jsx("p", { className: styles.intro, children: "Escolhe como vais usar a plataforma. Depois de confirmares o email, podes completar o perfil." }), _jsxs("form", { className: styles.form, onSubmit: enviarFormulario, children: [_jsxs("fieldset", { className: styles.accountTypeFieldset, children: [_jsx("legend", { children: "Que tipo de conta queres criar?" }), _jsx("div", { className: styles.accountTypeGrid, role: "radiogroup", "aria-label": "Tipo de conta", children: [
                                    { value: "client", title: "Cliente", description: "Quero encontrar serviços." },
                                    { value: "business", title: "Empresa ou PME", description: "Quero divulgar a minha empresa." },
                                    { value: "provider", title: "Prestador", description: "Quero oferecer os meus serviços." },
                                ].map((option) => (_jsxs("button", { className: tipoConta === option.value ? styles.accountTypeSelected : styles.accountTypeOption, type: "button", role: "radio", "aria-checked": tipoConta === option.value, onClick: () => definirTipoConta(option.value), children: [_jsx("strong", { children: option.title }), _jsx("span", { children: option.description })] }, option.value))) }), _jsx("p", { className: styles.accountTypeHint, children: "O registo come\u00E7a com os teus dados de acesso; os dados do perfil s\u00E3o pedidos na \u00E1rea correspondente." })] }), _jsxs("label", { className: styles.field, children: ["Email", _jsx("input", { type: "email", name: "email", autoComplete: "email", required: true, value: correioEletronico, onChange: (evento) => definirCorreioEletronico(evento.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Telefone ", _jsx("span", { children: "(opcional)" }), _jsx("input", { type: "tel", name: "phone", autoComplete: "tel", maxLength: 32, value: phone, onChange: (evento) => setPhone(evento.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Palavra-passe", _jsxs("span", { className: styles.passwordField, children: [_jsx("input", { type: mostrarPalavraPasse ? "text" : "password", name: "password", autoComplete: "new-password", required: true, value: palavraPasse, onChange: (evento) => definirPalavraPasse(evento.target.value) }), _jsx("button", { className: styles.passwordToggle, type: "button", "aria-label": mostrarPalavraPasse ? "Ocultar palavra-passe" : "Mostrar palavra-passe", "aria-pressed": mostrarPalavraPasse, onClick: () => definirMostrarPalavraPasse((visivel) => !visivel), children: mostrarPalavraPasse ? "Ocultar" : "Mostrar" })] })] }), _jsxs("label", { className: styles.field, children: ["Confirmar palavra-passe", _jsxs("span", { className: styles.passwordField, children: [_jsx("input", { type: mostrarConfirmacao ? "text" : "password", name: "password-confirmation", autoComplete: "new-password", required: true, value: confirmacao, onChange: (evento) => setConfirmation(evento.target.value) }), _jsx("button", { className: styles.passwordToggle, type: "button", "aria-label": mostrarConfirmacao ? "Ocultar confirmação" : "Mostrar confirmação", "aria-pressed": mostrarConfirmacao, onClick: () => definirMostrarConfirmacao((visivel) => !visivel), children: mostrarConfirmacao ? "Ocultar" : "Mostrar" })] })] }), erro && (_jsx("p", { className: styles.notice, role: "alert", children: erro })), success && (_jsxs("p", { className: `${styles.notice} ${styles.success}`, role: "status", children: [success, " ", _jsx(Link, { href: signInHref, children: "Iniciar sess\u00E3o" })] })), _jsx("button", { className: styles.submit, type: "submit", disabled: estaAEnviar, children: estaAEnviar ? "A criar conta…" : "Criar conta" })] }), _jsxs("p", { className: styles.switch, children: ["J\u00E1 tens conta? ", _jsx(Link, { href: "/entrar", children: "Entrar" })] })] }));
}
