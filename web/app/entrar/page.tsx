"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";

function obterMensagemErro(dadosRecebidos: unknown) {
  if (dadosRecebidos && typeof dadosRecebidos === "object") {
    const campos = Object.values(dadosRecebidos).flatMap((valor) =>
      Array.isArray(valor) ? valor : [valor],
    );
    const mensagem = campos.find((valor) => typeof valor === "string");
    if (typeof mensagem === "string") return mensagem;
  }
  return "Não foi possível iniciar sessão. Confirma os teus dados e tenta novamente.";
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
        body: JSON.stringify({ email: correioEletronico, password: palavraPasse }),
      });
      const dadosRecebidos: unknown = await respostaHttp.json();

      if (!respostaHttp.ok) {
        definirErro(obterMensagemErro(dadosRecebidos));
        return;
      }

      const destinoSeguinte = new URLSearchParams(window.location.search).get("next");
      let destino = "/conta";
      if (destinoSeguinte) {
        try {
          const destinoInterno = new URL(destinoSeguinte, window.location.origin);
          if (destinoInterno.origin === window.location.origin) {
            destino = `${destinoInterno.pathname}${destinoInterno.search}${destinoInterno.hash}`;
          }
        } catch {
          destino = "/conta";
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
        Ainda não tens conta? <Link href="/registar">Criar conta</Link>
      </p>
    </EstruturaAutenticacao>
  );
}
