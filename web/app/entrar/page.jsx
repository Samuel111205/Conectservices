"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";
function obterMensagemErro(dadosRecebidos) {
    if (typeof dadosRecebidos === "string" && dadosRecebidos.trim())
        return dadosRecebidos;
    if (Array.isArray(dadosRecebidos)) {
        for (const valor of dadosRecebidos) {
            const mensagem = obterMensagemErro(valor);
            if (mensagem)
                return mensagem;
        }
    }
    if (dadosRecebidos && typeof dadosRecebidos === "object") {
        const registo = dadosRecebidos;
        if (typeof registo.detail === "string")
            return registo.detail;
        for (const valor of Object.values(registo)) {
            const mensagem = obterMensagemErro(valor);
            if (mensagem)
                return mensagem;
        }
    }
    return null;
}
export default function PaginaEntrar() {
    const navegador = useRouter();
    const [correioEletronico, definirCorreioEletronico] = useState("");
    const [palavraPasse, definirPalavraPasse] = useState("");
    const [mostrarPalavraPasse, definirMostrarPalavraPasse] = useState(false);
    const [erro, definirErro] = useState("");
    const [estaAEnviar, definirEnvio] = useState(false);
    async function enviarFormulario(evento) {
        evento.preventDefault();
        definirEnvio(true);
        definirErro("");
        try {
            const respostaHttp = await fetchApi("/api/auth/token/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: correioEletronico.trim().toLocaleLowerCase("pt-AO"), password: palavraPasse }),
            });
            const dadosRecebidos = await respostaHttp.json().catch(() => null);
            if (!respostaHttp.ok) {
                definirErro(obterMensagemErro(dadosRecebidos) ?? "Não foi possível iniciar sessão. Confirma os teus dados e tenta novamente.");
                return;
            }
            const destinoSeguinte = new URLSearchParams(window.location.search).get("next");
            let destino = "/";
            if (destinoSeguinte) {
                try {
                    const destinoInterno = new URL(destinoSeguinte, window.location.origin);
                    const rotasAutenticacao = ["/entrar", "/registar", "/recuperar-acesso", "/redefinir-palavra-passe"];
                    if (destinoInterno.origin === window.location.origin &&
                        !rotasAutenticacao.includes(destinoInterno.pathname)) {
                        destino = `${destinoInterno.pathname}${destinoInterno.search}${destinoInterno.hash}`;
                    }
                }
                catch {
                    destino = "/";
                }
            }
            navegador.replace(destino);
        }
        catch {
            definirErro("Não foi possível contactar o serviço. Tenta novamente.");
        }
        finally {
            definirEnvio(false);
        }
    }
    return (_jsx(EstruturaAutenticacao, { children: _jsxs("div", { className: styles.loginCard, children: [_jsxs("div", { className: styles.loginHeader, children: [_jsxs("div", { className: styles.authTabs, "aria-label": "Acesso \u00E0 conta", children: [_jsx(Link, { className: styles.authTabActive, href: "/entrar", "aria-current": "page", children: "Entrar" }), _jsx(Link, { className: styles.authTab, href: "/registar", children: "Criar conta" })] }), _jsxs("span", { className: styles.loginSecure, children: [_jsx(ShieldCheck, { size: 15, "aria-hidden": "true" }), " Acesso seguro"] })] }), _jsxs("p", { className: styles.loginEyebrow, children: [_jsx(Sparkles, { size: 15, "aria-hidden": "true" }), " A tua comunidade come\u00E7a aqui"] }), _jsx("h1", { children: "Bem-vindo de volta!" }), _jsx("p", { className: styles.loginIntro, children: "Entra na tua conta e continua a conectar-te \u00E0s oportunidades certas." }), _jsxs("form", { className: `${styles.form} ${styles.loginForm}`, onSubmit: enviarFormulario, children: [_jsxs("label", { className: `${styles.field} ${styles.loginField}`, children: ["Email", _jsxs("span", { className: styles.loginInputWrap, children: [_jsx(Mail, { size: 18, "aria-hidden": "true" }), _jsx("input", { type: "email", name: "email", autoComplete: "email", autoCapitalize: "none", placeholder: "nome@exemplo.com", required: true, "aria-invalid": Boolean(erro), "aria-describedby": erro ? "login-error" : undefined, spellCheck: false, value: correioEletronico, onChange: (evento) => {
                                                definirCorreioEletronico(evento.target.value);
                                                if (erro)
                                                    definirErro("");
                                            } })] })] }), _jsxs("label", { className: `${styles.field} ${styles.loginField}`, children: ["Palavra-passe", _jsxs("span", { className: `${styles.passwordField} ${styles.loginInputWrap}`, children: [_jsx(LockKeyhole, { size: 18, "aria-hidden": "true" }), _jsx("input", { type: mostrarPalavraPasse ? "text" : "password", name: "password", autoComplete: "current-password", placeholder: "Introduz a tua palavra-passe", required: true, "aria-invalid": Boolean(erro), "aria-describedby": erro ? "login-error" : undefined, spellCheck: false, value: palavraPasse, onChange: (evento) => {
                                                definirPalavraPasse(evento.target.value);
                                                if (erro)
                                                    definirErro("");
                                            } }), _jsx("button", { className: styles.passwordToggle, type: "button", "aria-label": mostrarPalavraPasse ? "Ocultar palavra-passe" : "Mostrar palavra-passe", "aria-pressed": mostrarPalavraPasse, onClick: () => definirMostrarPalavraPasse((visivel) => !visivel), children: mostrarPalavraPasse ? _jsx(EyeOff, { size: 18, "aria-hidden": "true" }) : _jsx(Eye, { size: 18, "aria-hidden": "true" }) })] })] }), erro && (_jsx("p", { className: styles.notice, id: "login-error", role: "alert", children: erro })), _jsx("button", { className: `${styles.submit} ${styles.loginSubmit}`, type: "submit", disabled: estaAEnviar, "aria-busy": estaAEnviar, children: estaAEnviar ? "A entrar…" : _jsxs(_Fragment, { children: ["Entrar na minha conta ", _jsx(ArrowRight, { size: 17, "aria-hidden": "true" })] }) })] }), _jsxs("div", { className: styles.loginFooter, children: [_jsx(Link, { href: "/recuperar-acesso", children: "Esqueceste-te da palavra-passe?" }), _jsxs("span", { children: ["Ainda n\u00E3o tens conta? ", _jsx(Link, { href: "/registar", children: "Regista-te gratuitamente" })] })] })] }) }));
}
