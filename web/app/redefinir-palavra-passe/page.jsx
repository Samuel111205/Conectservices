"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useState } from "react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";
export default function RedefinirPalavraPassePage() {
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        setError("");
        try {
            const params = new URLSearchParams(window.location.search);
            const uid = params.get("uid") ?? "";
            const token = params.get("token") ?? "";
            const response = await fetchApi("/api/public/auth/password-reset/confirm/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid, token, password }) });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.password?.[0] ?? data.token?.[0] ?? data.detail ?? "Não foi possível alterar a palavra-passe.");
            setMessage(data.detail);
            setPassword("");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "A ligação expirou ou é inválida.");
        }
        finally {
            setBusy(false);
        }
    }
    return _jsxs(EstruturaAutenticacao, { children: [_jsx("p", { className: styles.eyebrow, children: "Seguran\u00E7a da conta" }), _jsx("h1", { children: "Escolhe uma nova palavra-passe" }), _jsxs("form", { className: styles.form, onSubmit: submit, children: [_jsxs("label", { className: styles.field, children: ["Nova palavra-passe", _jsx("input", { type: "password", autoComplete: "new-password", required: true, minLength: 8, value: password, onChange: (event) => setPassword(event.target.value) })] }), error && _jsx("p", { className: styles.notice, role: "alert", children: error }), message && _jsxs("p", { className: `${styles.notice} ${styles.success}`, role: "status", children: [message, " ", _jsx(Link, { href: "/entrar", children: "Iniciar sess\u00E3o" })] }), _jsx("button", { className: styles.submit, disabled: busy, children: busy ? "A guardar…" : "Guardar palavra-passe" })] })] });
}
