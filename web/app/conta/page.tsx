"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";

type Account = { id: number; email: string; phone: string | null };

export default function PaginaConta() {
  const navegador = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [erro, definirErro] = useState("");
  const [estaCarregando, definirCarregamento] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let ativo = true;

    fetch("/api/auth/me/", { cache: "no-store" })
      .then(async (respostaHttp) => {
        const dadosRecebidos = await respostaHttp.json();
        if (!ativo) return;
        if (respostaHttp.status === 401) {
          navegador.replace("/entrar?next=%2Fconta");
          return;
        }
        if (!respostaHttp.ok) {
          definirErro(
            typeof dadosRecebidos?.detail === "string"
              ? dadosRecebidos.detail
              : "Não foi possível carregar a conta.",
          );
          return;
        }
        setAccount(dadosRecebidos as Account);
      })
      .catch(() => {
        if (ativo) definirErro("Não foi possível contactar o serviço.");
      })
      .finally(() => {
        if (ativo) definirCarregamento(false);
      });

    return () => {
      ativo = false;
    };
  }, [navegador]);

  async function terminarSessao() {
    setIsLoggingOut(true);
    definirErro("");
    try {
      const respostaHttp = await fetch("/api/auth/logout/", { method: "POST" });
      if (!respostaHttp.ok) {
        const dadosRecebidos = await respostaHttp.json().catch(() => null);
        definirErro(
          typeof dadosRecebidos?.detail === "string"
            ? `${dadosRecebidos.detail} A sessão local foi terminada.`
            : "A sessão local foi terminada, mas a API não confirmou a invalidação.",
        );
      }
      navegador.replace("/");
    } catch {
      definirErro("Não foi possível contactar o serviço para terminar a sessão.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <EstruturaAutenticacao account>
      <p className={styles.eyebrow}>A tua conta</p>
      <h1>Área pessoal</h1>
      {estaCarregando ? (
        <p className={styles.intro} aria-live="polite">
          A validar a sessão…
        </p>
      ) : account ? (
        <>
          <p className={styles.intro}>
            A tua sessão está ativa. Completa os teus dados pessoais ou prepara
            o perfil do teu negócio para apresentar os teus serviços.
          </p>
          <div className={styles.accountInfo}>
            <span>Email da conta</span>
            <strong>{account.email}</strong>
          </div>
          {account.phone && (
            <div className={styles.accountInfo}>
              <span>Telefone</span>
              <strong>{account.phone}</strong>
            </div>
          )}
          <div className={styles.accountActions}>
            <Link className={styles.secondary} href="/perfil">
              Gerir perfis
            </Link>
            <Link className={styles.secondary} href="/">
              Explorar serviços
            </Link>
            <Link className={styles.secondary} href="/contratacoes">
              Contratações
            </Link>
            <button
              className={styles.secondary}
              type="button"
              disabled={isLoggingOut}
              onClick={terminarSessao}
            >
              {isLoggingOut ? "A terminar…" : "Terminar sessão"}
            </button>
          </div>
        </>
      ) : (
        <p className={styles.notice} role="alert">
          {erro || "Não foi possível validar a sessão."}
        </p>
      )}
      {erro && account && (
        <p className={styles.notice} role="alert">
          {erro}
        </p>
      )}
    </EstruturaAutenticacao>
  );
}
