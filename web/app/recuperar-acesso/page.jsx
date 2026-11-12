"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useState } from "react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";
export default function RecuperarAcessoPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        setError("");
        try {
            const response = await fetchApi("/api/public/auth/password-reset/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.detail ?? "Não foi possível processar o pedido.");
            setMessage(data.detail);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Tenta novamente mais tarde.");
        }
        finally {
            setBusy(false);
        }
    }
    return _jsxs(EstruturaAutenticacao, { children: [_jsx("p", { className: styles.eyebrow, children: "Recupera\u00E7\u00E3o de acesso" }), _jsx("h1", { children: "Redefine a palavra-passe" }), _jsx("p", { className: styles.intro, children: "Enviaremos uma liga\u00E7\u00E3o se existir uma conta associada a este email." }), _jsxs("form", { className: styles.form, onSubmit: submit, children: [_jsxs("label", { className: styles.field, children: ["Email", _jsx("input", { type: "email", autoComplete: "email", required: true, value: email, onChange: (event) => setEmail(event.target.value) })] }), error && _jsx("p", { className: styles.notice, role: "alert", children: error }), message && _jsx("p", { className: `${styles.notice} ${styles.success}`, role: "status", children: message }), _jsx("button", { className: styles.submit, disabled: busy, children: busy ? "A enviar…" : "Enviar ligação" })] }), _jsx("p", { className: styles.switch, children: _jsx(Link, { href: "/entrar", children: "Voltar a entrar" }) })] });
}
