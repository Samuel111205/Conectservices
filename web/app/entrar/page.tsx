"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";

function obterMensagemErro(dadosRecebidos: unknown): string | null {
  if (typeof dadosRecebidos === "string" && dadosRecebidos.trim()) return dadosRecebidos;
  if (Array.isArray(dadosRecebidos)) {
    for (const valor of dadosRecebidos) {
      const mensagem = obterMensagemErro(valor);
      if (mensagem) return mensagem;
    }
  }
  if (dadosRecebidos && typeof dadosRecebidos === "object") {
    const registo = dadosRecebidos as Record<string, unknown>;
    if (typeof registo.detail === "string") return registo.detail;
    for (const valor of Object.values(registo)) {
      const mensagem = obterMensagemErro(valor);
      if (mensagem) return mensagem;
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

  async function enviarFormulario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnvio(true);
    definirErro("");

    try {
      const respostaHttp = await fetch("/api/auth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: correioEletronico.trim().toLocaleLowerCase("pt-AO"), password: palavraPasse }),
      });
      const dadosRecebidos: unknown = await respostaHttp.json().catch(() => null);

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
          if (
            destinoInterno.origin === window.location.origin &&
            !rotasAutenticacao.includes(destinoInterno.pathname)
          ) {
            destino = `${destinoInterno.pathname}${destinoInterno.search}${destinoInterno.hash}`;
          }
        } catch {
          destino = "/";
        }
      }
      navegador.replace(destino);
    } catch {
      definirErro("Não foi possível contactar o serviço. Tenta novamente.");
    } finally {
      definirEnvio(false);
    }
  }

  return (
    <EstruturaAutenticacao>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <div className={styles.authTabs} aria-label="Acesso à conta">
            <Link className={styles.authTabActive} href="/entrar" aria-current="page">Entrar</Link>
            <Link className={styles.authTab} href="/registar">Criar conta</Link>
          </div>
          <span className={styles.loginSecure}><ShieldCheck size={15} aria-hidden="true" /> Acesso seguro</span>
        </div>
        <p className={styles.loginEyebrow}><Sparkles size={15} aria-hidden="true" /> A tua comunidade começa aqui</p>
        <h1>Bem-vindo de volta!</h1>
        <p className={styles.loginIntro}>
          Entra na tua conta e continua a conectar-te às oportunidades certas.
        </p>
        <form className={`${styles.form} ${styles.loginForm}`} onSubmit={enviarFormulario}>
          <label className={`${styles.field} ${styles.loginField}`}>
            Email
            <span className={styles.loginInputWrap}>
              <Mail size={18} aria-hidden="true" />
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="nome@exemplo.com"
                required
                aria-invalid={Boolean(erro)}
                value={correioEletronico}
                onChange={(evento) => definirCorreioEletronico(evento.target.value)}
              />
            </span>
          </label>
          <label className={`${styles.field} ${styles.loginField}`}>
            Palavra-passe
            <span className={`${styles.passwordField} ${styles.loginInputWrap}`}>
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                type={mostrarPalavraPasse ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder="Introduz a tua palavra-passe"
                required
                value={palavraPasse}
                onChange={(evento) => definirPalavraPasse(evento.target.value)}
              />
              <button
                className={styles.passwordToggle}
                type="button"
                aria-label={mostrarPalavraPasse ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                aria-pressed={mostrarPalavraPasse}
                onClick={() => definirMostrarPalavraPasse((visivel) => !visivel)}
              >
                {mostrarPalavraPasse ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </span>
          </label>
          {erro && (
            <p className={styles.notice} role="alert">
              {erro}
            </p>
          )}
          <button className={`${styles.submit} ${styles.loginSubmit}`} type="submit" disabled={estaAEnviar}>
            {estaAEnviar ? "A entrar…" : <>Entrar na minha conta <ArrowRight size={17} aria-hidden="true" /></>}
          </button>
        </form>
        <div className={styles.loginFooter}>
          <Link href="/recuperar-acesso">Esqueceste-te da palavra-passe?</Link>
          <span>Ainda não tens conta? <Link href="/registar">Regista-te gratuitamente</Link></span>
        </div>
      </div>
    </EstruturaAutenticacao>
  );
}
