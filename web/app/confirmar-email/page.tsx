"use client";

import Link from "next/link";
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
    void fetch("/api/public/auth/verify-email/", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "A ligação expirou ou é inválida.");
      setMessage(body.detail);
    }).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Não foi possível confirmar o email.");
      setFailed(true);
    });
  }, []);
  async function resend() {
    const response = await fetch("/api/public/auth/verify-email/resend/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const body = await response.json();
    setResendMessage(body.detail ?? "Se a conta precisar de confirmação, enviaremos uma nova ligação.");
  }
  return <EstruturaAutenticacao><p className={styles.eyebrow}>Conect Services</p><h1>Confirmação de email</h1><p className={failed ? styles.notice : `${styles.notice} ${styles.success}`} role="status">{message}</p>{failed && <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void resend(); }}><label className={styles.field}>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className={styles.submit}>Enviar nova ligação</button>{resendMessage && <p className={styles.notice} role="status">{resendMessage}</p>}</form>}{!failed && <Link href="/entrar">Iniciar sessão</Link>}</EstruturaAutenticacao>;
}
