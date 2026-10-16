"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";

export default function RedefinirPalavraPassePage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      const params = new URLSearchParams(window.location.search);
      const uid = params.get("uid") ?? "";
      const token = params.get("token") ?? "";
      const response = await fetch("/api/public/auth/password-reset/confirm/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid, token, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.password?.[0] ?? data.token?.[0] ?? data.detail ?? "Não foi possível alterar a palavra-passe.");
      setMessage(data.detail); setPassword("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "A ligação expirou ou é inválida."); }
    finally { setBusy(false); }
  }
  return <EstruturaAutenticacao><p className={styles.eyebrow}>Segurança da conta</p><h1>Escolhe uma nova palavra-passe</h1><form className={styles.form} onSubmit={submit}><label className={styles.field}>Nova palavra-passe<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className={styles.notice} role="alert">{error}</p>}{message && <p className={`${styles.notice} ${styles.success}`} role="status">{message} <Link href="/entrar">Iniciar sessão</Link></p>}<button className={styles.submit} disabled={busy}>{busy ? "A guardar…" : "Guardar palavra-passe"}</button></form></EstruturaAutenticacao>;
}
