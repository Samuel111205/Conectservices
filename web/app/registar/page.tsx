"use client";

import Link from "next/link";
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
  return "Não foi possível criar a conta. Confirma os dados e tenta novamente.";
}

export default function PaginaRegistar() {
  const [correioEletronico, definirCorreioEletronico] = useState("");
  const [phone, setPhone] = useState("");
  const [palavraPasse, definirPalavraPasse] = useState("");
  const [confirmacao, setConfirmation] = useState("");
  const [erro, definirErro] = useState("");
  const [success, setSuccess] = useState("");
  const [estaAEnviar, definirEnvio] = useState(false);

  async function enviarFormulario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirErro("");
    setSuccess("");

    if (palavraPasse !== confirmacao) {
      definirErro("As palavras-passe não coincidem.");
      return;
    }

    definirEnvio(true);
    try {
      const respostaHttp = await fetch("/api/auth/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: correioEletronico,
          phone: phone.trim() || null,
          password: palavraPasse,
        }),
      });
      const dadosRecebidos: unknown = await respostaHttp.json();

      if (!respostaHttp.ok) {
        definirErro(obterMensagemErro(dadosRecebidos));
        return;
      }

      const detalhe =
        dadosRecebidos && typeof dadosRecebidos === "object" && "detail" in dadosRecebidos
          ? dadosRecebidos.detail
          : "Conta criada. Já podes iniciar sessão.";
      setSuccess(
        typeof detalhe === "string"
          ? `${detalhe} Confirma o email antes de iniciar sessão.`
          : "Se os dados forem válidos, enviámos instruções para confirmar o email.",
      );
      definirPalavraPasse("");
      setConfirmation("");
    } catch {
      definirErro("Não foi possível contactar o serviço. Tenta novamente.");
    } finally {
      definirEnvio(false);
    }
  }

  return (
    <EstruturaAutenticacao>
      <p className={styles.eyebrow}>Junta-te à comunidade</p>
      <h1>Cria a tua conta</h1>
      <p className={styles.intro}>
        Regista-te para encontrar serviços e, mais tarde, criar o teu perfil
        profissional.
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
          Telefone <span>(opcional)</span>
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            maxLength={32}
            value={phone}
            onChange={(evento) => setPhone(evento.target.value)}
          />
        </label>
        <label className={styles.field}>
          Palavra-passe
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            value={palavraPasse}
            onChange={(evento) => definirPalavraPasse(evento.target.value)}
          />
        </label>
        <label className={styles.field}>
          Confirmar palavra-passe
          <input
            type="password"
            name="password-confirmation"
            autoComplete="new-password"
            required
            value={confirmacao}
            onChange={(evento) => setConfirmation(evento.target.value)}
          />
        </label>
        {erro && (
          <p className={styles.notice} role="alert">
            {erro}
          </p>
        )}
        {success && (
          <p className={`${styles.notice} ${styles.success}`} role="status">
            {success} <Link href="/entrar">Iniciar sessão</Link>
          </p>
        )}
        <button className={styles.submit} type="submit" disabled={estaAEnviar}>
          {estaAEnviar ? "A criar conta…" : "Criar conta"}
        </button>
      </form>
      <p className={styles.switch}>
        Já tens conta? <Link href="/entrar">Entrar</Link>
      </p>
    </EstruturaAutenticacao>
  );
}
