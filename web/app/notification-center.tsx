"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./auth.module.css";

type Notification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  conversation_id: number | null;
  product_order_id: number | null;
  href: string | null;
  created_at: string;
  read_at: string | null;
};
type NotificationPage = { results: Notification[] };
type UnreadResponse = { unread_count: number };

function formatarData(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-AO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

export default function NotificationCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const [aberto, definirAberto] = useState(false);
  const [notificacoes, definirNotificacoes] = useState<Notification[]>([]);
  const [porLer, definirPorLer] = useState(0);
  const [aCarregar, definirCarregamento] = useState(false);
  const [aMarcarTodas, definirMarcarTodas] = useState(false);
  const [erro, definirErro] = useState("");

  useEffect(() => {
    let ativo = true;
    async function atualizarContagem(atualizarFeed = false) {
      try {
        const resposta = await fetch("/api/auth/notifications/unread-count/", {
          cache: "no-store",
        });
        if (resposta.status === 401) {
          router.replace(`/entrar?next=${encodeURIComponent(pathname)}`);
          return;
        }
        if (!resposta.ok) return;
        const dados = (await resposta.json()) as UnreadResponse;
        if (ativo && Number.isFinite(dados.unread_count)) {
          definirPorLer(Math.max(0, dados.unread_count));
        }
        if (ativo && aberto && atualizarFeed) {
          const respostaFeed = await fetch("/api/auth/notifications/?page=1", {
            cache: "no-store",
          });
          if (respostaFeed.ok) {
            const notificacoesAtuais = (await respostaFeed.json()) as NotificationPage;
            if (ativo) definirNotificacoes(notificacoesAtuais.results ?? []);
          }
        }
      } catch {
        // O feed continua utilizável se a contagem estiver temporariamente indisponível.
      }
    }

    void atualizarContagem();
    const temporizador = window.setInterval(
      () => void atualizarContagem(true),
      45_000,
    );
    return () => {
      ativo = false;
      window.clearInterval(temporizador);
    };
  }, [aberto, pathname, router]);

  async function carregarNotificacoes() {
    definirCarregamento(true);
    definirErro("");
    try {
      const resposta = await fetch("/api/auth/notifications/?page=1", { cache: "no-store" });
      if (resposta.status === 401) {
        router.replace(`/entrar?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (!resposta.ok) throw new Error("Não foi possível carregar as notificações.");
      const dados = (await resposta.json()) as NotificationPage;
      definirNotificacoes(dados.results ?? []);
    } catch {
      definirErro("Não foi possível carregar as notificações. Tenta novamente.");
    } finally {
      definirCarregamento(false);
    }
  }

  async function marcarTodasComoLidas() {
    definirMarcarTodas(true);
    definirErro("");
    try {
      const resposta = await fetch("/api/auth/notifications/read-all/", {
        method: "POST",
      });
      if (!resposta.ok) throw new Error("Não foi possível atualizar as notificações.");
      const agora = new Date().toISOString();
      definirNotificacoes((atuais) => atuais.map((notificacao) => ({
        ...notificacao,
        read_at: notificacao.read_at ?? agora,
      })));
      definirPorLer(0);
    } catch {
      definirErro("Não foi possível marcar as notificações como lidas.");
    } finally {
      definirMarcarTodas(false);
    }
  }

  async function abrirNotificacao(notificacao: Notification) {
    if (!notificacao.read_at) {
      try {
        const resposta = await fetch(
          `/api/auth/notifications/${notificacao.id}/read/`,
          { method: "POST" },
        );
        if (resposta.ok) {
          const agora = new Date().toISOString();
          definirNotificacoes((atuais) => atuais.map((item) =>
            item.id === notificacao.id ? { ...item, read_at: agora } : item,
          ));
          definirPorLer((atual) => Math.max(0, atual - 1));
        }
      } catch {
        // A pessoa ainda pode abrir a caixa de mensagens se a marcação falhar.
      }
    }
    definirAberto(false);
    const destino = notificacao.href ?? (
      notificacao.conversation_id
        ? `/mensagens?conversa=${notificacao.conversation_id}`
        : "/compras"
    );
    if (destino.split("?")[0] === pathname) {
      window.location.assign(destino);
      return;
    }
    router.push(destino);
  }

  return (
    <div
      className={styles.notificationCenter}
      onKeyDown={(evento) => {
        if (evento.key === "Escape") definirAberto(false);
      }}
    >
      <button
        type="button"
        className={styles.notificationToggle}
        aria-label={porLer ? `Notificações, ${porLer} por ler` : "Notificações"}
        aria-expanded={aberto}
        aria-controls="notification-panel"
        onClick={() => {
          if (aberto) definirAberto(false);
          else {
            definirAberto(true);
            void carregarNotificacoes();
          }
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        <span className={styles.notificationToggleLabel}>Notificações</span>
        {porLer > 0 && <span className={styles.notificationBadge}>{porLer > 9 ? "9+" : porLer}</span>}
      </button>
      {aberto && (
        <section
          className={styles.notificationPanel}
          id="notification-panel"
          aria-label="Notificações recentes"
        >
          <header className={styles.notificationHeader}>
            <div>
              <strong>Notificações</strong>
              <span>{porLer ? `${porLer} por ler` : "Estás em dia"}</span>
            </div>
            {porLer > 0 && (
              <button
                type="button"
                disabled={aMarcarTodas}
                onClick={() => void marcarTodasComoLidas()}
              >
                {aMarcarTodas ? "A atualizar…" : "Marcar todas como lidas"}
              </button>
            )}
          </header>
          {erro && <p className={styles.notificationError} role="alert">{erro}</p>}
          {aCarregar ? (
            <p className={styles.notificationEmpty} aria-live="polite">A carregar notificações…</p>
          ) : notificacoes.length ? (
            <ul className={styles.notificationList}>
              {notificacoes.map((notificacao) => (
                <li key={notificacao.id}>
                  <button
                    type="button"
                    className={`${styles.notificationItem} ${notificacao.read_at ? "" : styles.notificationUnread}`}
                    onClick={() => void abrirNotificacao(notificacao)}
                  >
                    <span className={styles.notificationItemTop}>
                      <strong>{notificacao.title}</strong>
                      <time dateTime={notificacao.created_at}>{formatarData(notificacao.created_at)}</time>
                    </span>
                    <span>{notificacao.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !erro && <p className={styles.notificationEmpty}>Ainda não tens notificações.</p>
          )}
          <button
            type="button"
            className={styles.notificationMessagesLink}
            onClick={() => {
              definirAberto(false);
              router.push("/mensagens");
            }}
          >
            Abrir mensagens
          </button>
        </section>
      )}
    </div>
  );
}
