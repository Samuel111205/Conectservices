"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";

export default function RecuperarAcessoPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/public/auth/password-reset/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Não foi possível processar o pedido.");
      setMessage(data.detail);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Tenta novamente mais tarde."); }
    finally { setBusy(false); }
  }
  return <EstruturaAutenticacao><p className={styles.eyebrow}>Recuperação de acesso</p><h1>Redefine a palavra-passe</h1><p className={styles.intro}>Enviaremos uma ligação se existir uma conta associada a este email.</p><form className={styles.form} onSubmit={submit}><label className={styles.field}>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>{error && <p className={styles.notice} role="alert">{error}</p>}{message && <p className={`${styles.notice} ${styles.success}`} role="status">{message}</p>}<button className={styles.submit} disabled={busy}>{busy ? "A enviar…" : "Enviar ligação"}</button></form><p className={styles.switch}><Link href="/entrar">Voltar a entrar</Link></p></EstruturaAutenticacao>;
}
