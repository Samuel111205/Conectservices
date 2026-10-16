"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
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
      <p className={styles.eyebrow}>Bem-vindo de volta</p>
      <h1>Entrar na tua conta</h1>
      <p className={styles.intro}>
        Acede à tua conta para continuares a usar a Conect Services.
      </p>
      <form className={styles.form} onSubmit={enviarFormulario}>
        <label className={styles.field}>
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(erro)}
            value={correioEletronico}
            onChange={(evento) => definirCorreioEletronico(evento.target.value)}
          />
        </label>
        <label className={styles.field}>
          Palavra-passe
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={palavraPasse}
            onChange={(evento) => definirPalavraPasse(evento.target.value)}
          />
        </label>
        {erro && (
          <p className={styles.notice} role="alert">
            {erro}
          </p>
        )}
        <button className={styles.submit} type="submit" disabled={estaAEnviar}>
          {estaAEnviar ? "A entrar…" : "Entrar"}
        </button>
      </form>
      <p className={styles.switch}>
        <Link href="/recuperar-acesso">Esqueceste-te da palavra-passe?</Link>
      </p>
      <p className={styles.switch}>
        Ainda não tens conta? <Link href="/registar">Criar conta</Link>
      </p>
    </EstruturaAutenticacao>
  );
}
