"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useEffect, useState } from "react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";
export default function ConfirmarEmailPage() {
    const [message, setMessage] = useState("A confirmar o email…");
    const [failed, setFailed] = useState(false);
    const [email, setEmail] = useState("");
    const [resendMessage, setResendMessage] = useState("");
    useEffect(() => {
        const token = new URLSearchParams(window.location.search).get("token");
        if (!token) {
            void Promise.resolve().then(() => {
                setMessage("A ligação de confirmação é inválida.");
                setFailed(true);
            });
            return;
        }
        void fetchApi("/api/public/auth/verify-email/", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
        }).then(async (response) => {
            const body = await response.json();
            if (!response.ok)
                throw new Error(body.detail ?? "A ligação expirou ou é inválida.");
            setMessage(body.detail);
        }).catch((error) => {
            setMessage(error instanceof Error ? error.message : "Não foi possível confirmar o email.");
            setFailed(true);
        });
    }, []);
    async function resend() {
        const response = await fetchApi("/api/public/auth/verify-email/resend/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        const body = await response.json();
        setResendMessage(body.detail ?? "Se a conta precisar de confirmação, enviaremos uma nova ligação.");
    }
    return _jsxs(EstruturaAutenticacao, { children: [_jsx("p", { className: styles.eyebrow, children: "Conect Services" }), _jsx("h1", { children: "Confirma\u00E7\u00E3o de email" }), _jsx("p", { className: failed ? styles.notice : `${styles.notice} ${styles.success}`, role: "status", children: message }), failed && _jsxs("form", { className: styles.form, onSubmit: (event) => { event.preventDefault(); void resend(); }, children: [_jsxs("label", { className: styles.field, children: ["Email", _jsx("input", { type: "email", required: true, value: email, onChange: (event) => setEmail(event.target.value) })] }), _jsx("button", { className: styles.submit, children: "Enviar nova liga\u00E7\u00E3o" }), resendMessage && _jsx("p", { className: styles.notice, role: "status", children: resendMessage })] }), !failed && _jsx(Link, { href: "/entrar", children: "Iniciar sess\u00E3o" })] });
}
