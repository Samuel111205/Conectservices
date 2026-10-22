"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";

type Profile = { full_name: string };
type DashboardSummary = { orders: number; activeOrders: number; bookings: number };
type Dashboard = {
  client: {
    orders_by_status: Record<string, number>;
    bookings_by_status: Record<string, number>;
  };
};
type Atividade = { id: string; titulo: string; detalhe: string; estado: string; data: string; href: string };
type ApiPage<T> = { results: T[]; next: string | null };
type Order = { id: number; title: string; status: string; created_at: string };
type Proposal = { id: number; order_id: number; order_title: string; provider_name: string; status: string; created_at: string };
type Booking = { id: number; order_id: number; provider_name: string; status: string; created_at: string };

const nomesEstado: Record<string, string> = {
  OPEN: "Aberto", NEGOTIATING: "A receber propostas", AWARDED: "Contratado", COMPLETED: "Concluído", CANCELLED: "Cancelado",
  PENDING: "Pendente", ACCEPTED: "Aceite", REJECTED: "Recusada", WITHDRAWN: "Retirada",
  SCHEDULED: "Por agendar", CONFIRMED: "Confirmado", IN_PROGRESS: "Em execução",
};

function formatarData(valor: string) {
  return new Date(valor).toLocaleDateString("pt-AO", { day: "numeric", month: "short" });
}

function criarAtividades(pedidos: Order[], propostas: Proposal[], contratacoes: Booking[]) {
  return [
    ...pedidos.map((pedido) => ({
      id: `pedido-${pedido.id}`, titulo: pedido.title,
      detalhe: "Pedido publicado", estado: nomesEstado[pedido.status] ?? pedido.status,
      data: pedido.created_at, href: "/pedidos",
    })),
    ...propostas.map((proposta) => ({
      id: `proposta-${proposta.id}`, titulo: `Proposta de ${proposta.provider_name}`,
      detalhe: proposta.order_title, estado: nomesEstado[proposta.status] ?? proposta.status,
      data: proposta.created_at, href: "/pedidos",
    })),
    ...contratacoes.map((contratacao) => ({
      id: `contratacao-${contratacao.id}`, titulo: `Serviço com ${contratacao.provider_name}`,
      detalhe: `Contratação do pedido #${contratacao.order_id}`, estado: nomesEstado[contratacao.status] ?? contratacao.status,
      data: contratacao.created_at, href: "/contratacoes",
    })),
  ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

export default function PaginaConta() {
  const navegador = useRouter();
  const [account, setAccount] = useState(false);
  const [erro, definirErro] = useState("");
  const [estaCarregando, definirCarregamento] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [nome, setNome] = useState("");
  const [resumo, setResumo] = useState<DashboardSummary | null>(null);
  const [feed, setFeed] = useState<Atividade[]>([]);
  const [paginaApiFeed, definirPaginaApiFeed] = useState(1);
  const [limiteFeed, definirLimiteFeed] = useState(8);
  const [temMaisFeed, definirTemMaisFeed] = useState(false);
  const [aCarregarFeed, definirCarregamentoFeed] = useState(false);
  const [erroFeed, definirErroFeed] = useState("");

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
        setAccount(true);
        const [perfilHttp, dashboardHttp] = await Promise.all([
          fetch("/api/auth/profiles/me/", { cache: "no-store" }),
          fetch("/api/auth/dashboard/", { cache: "no-store" }),
        ]);
        if ([perfilHttp, dashboardHttp].some((response) => response.status === 401)) {
          navegador.replace("/entrar?next=%2Fconta");
          return;
        }
        const [perfil, dashboard] = await Promise.all([
          perfilHttp.ok ? perfilHttp.json() as Promise<Profile> : Promise.resolve(null),
          dashboardHttp.ok ? dashboardHttp.json() as Promise<Dashboard> : Promise.resolve(null),
        ]);
        if (!ativo) return;
        setNome(perfil?.full_name ?? "");
        const [pedidosHttp, propostasHttp, contratacoesHttp] = await Promise.all([
          fetch("/api/auth/orders/", { cache: "no-store" }),
          fetch("/api/auth/proposals/", { cache: "no-store" }),
          fetch("/api/auth/bookings/", { cache: "no-store" }),
        ]);
        if ([pedidosHttp, propostasHttp, contratacoesHttp].some((response) => response.status === 401)) {
          navegador.replace("/entrar?next=%2Fconta");
          return;
        }
        const [pedidos, propostas, contratacoes] = await Promise.all([
          pedidosHttp.ok ? pedidosHttp.json() as Promise<ApiPage<Order>> : Promise.resolve({ results: [], next: null }),
          propostasHttp.ok ? propostasHttp.json() as Promise<ApiPage<Proposal>> : Promise.resolve({ results: [], next: null }),
          contratacoesHttp.ok ? contratacoesHttp.json() as Promise<ApiPage<Booking>> : Promise.resolve({ results: [], next: null }),
        ]);
        const atividades = criarAtividades(pedidos.results, propostas.results, contratacoes.results);
        if (ativo) {
          setFeed(atividades);
          definirTemMaisFeed(Boolean(pedidos.next || propostas.next || contratacoes.next));
        }
        if (dashboard?.client) {
          const pedidos = dashboard.client.orders_by_status;
          const contratacoes = dashboard.client.bookings_by_status;
          setResumo({
            orders: Object.values(pedidos).reduce((soma, count) => soma + count, 0),
            activeOrders: (pedidos.OPEN ?? 0) + (pedidos.NEGOTIATING ?? 0),
            bookings: (contratacoes.SCHEDULED ?? 0) + (contratacoes.CONFIRMED ?? 0) + (contratacoes.IN_PROGRESS ?? 0),
          });
        }
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

  async function carregarMaisFeed() {
    definirErroFeed("");
    if (feed.length > limiteFeed) {
      definirLimiteFeed((atual) => atual + 8);
      return;
    }
    if (!temMaisFeed || aCarregarFeed) return;

    definirCarregamentoFeed(true);
    const proximaPagina = paginaApiFeed + 1;
    const consulta = `?page=${proximaPagina}`;
    try {
      const respostas = await Promise.all([
        fetch(`/api/auth/orders/${consulta}`, { cache: "no-store" }),
        fetch(`/api/auth/proposals/${consulta}`, { cache: "no-store" }),
        fetch(`/api/auth/bookings/${consulta}`, { cache: "no-store" }),
      ]);
      if (respostas.some((resposta) => resposta.status === 401)) {
        navegador.replace("/entrar?next=%2Fconta");
        return;
      }
      if (respostas.some((resposta) => !resposta.ok)) {
        throw new Error("Não foi possível carregar mais atividade.");
      }
      const paginas = await Promise.all(
        respostas.map((resposta) => resposta.json() as Promise<ApiPage<Order | Proposal | Booking>>),
      );
      const [pedidos, propostas, contratacoes] = paginas;
      const novasAtividades = criarAtividades(
        pedidos.results as Order[],
        propostas.results as Proposal[],
        contratacoes.results as Booking[],
      );
      setFeed((atuais) => {
        const unicas = new Map([...atuais, ...novasAtividades].map((item) => [item.id, item]));
        return [...unicas.values()].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      });
      definirPaginaApiFeed(proximaPagina);
      definirTemMaisFeed(Boolean(pedidos.next || propostas.next || contratacoes.next));
    } catch {
      definirErroFeed("Não foi possível carregar mais atividade.");
    } finally {
      definirCarregamentoFeed(false);
    }
  }

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
      <p className={styles.eyebrow}>Feed da comunidade</p>
      <h1>{nome ? `Olá, ${nome.split(" ")[0]}` : "O teu feed"}</h1>
      {estaCarregando ? (
        <p className={styles.intro} aria-live="polite">
          A validar a sessão…
        </p>
      ) : account ? (
        <>
          <p className={styles.intro}>
            Acompanha as atualizações dos teus pedidos, propostas e serviços.
          </p>
          <section className={styles.feedSection} aria-labelledby="atividade-recente">
            <div className={styles.feedHeading}>
              <div><p className={styles.eyebrow}>A tua rede</p><h2 id="atividade-recente">Atividade recente</h2></div>
              <Link href="/pedidos">Ver pedidos</Link>
            </div>
            {feed.length ? <ol className={styles.activityFeed}>
              {feed.slice(0, limiteFeed).map((item) => <li key={item.id}>
                <span className={styles.feedMarker} aria-hidden="true" />
                <Link href={item.href} className={styles.activityCard}>
                  <span className={styles.activityMeta}><span>{item.detalhe}</span><time dateTime={item.data}>{formatarData(item.data)}</time></span>
                  <strong>{item.titulo}</strong>
                  <span className={styles.activityState}>{item.estado}</span>
                </Link>
              </li>)}
            </ol> : <div className={styles.feedEmpty}>
              <strong>A tua atividade começa aqui</strong>
              <p>Cria um pedido para receber propostas de profissionais da comunidade.</p>
              <Link href="/pedidos/novo">Publicar o primeiro pedido</Link>
            </div>}
            {(feed.length > limiteFeed || temMaisFeed) && (
              <div className={styles.feedLoadMore}>
                {erroFeed && <p className={styles.notice} role="alert">{erroFeed}</p>}
                <button
                  type="button"
                  disabled={aCarregarFeed}
                  onClick={() => void carregarMaisFeed()}
                >
                  {aCarregarFeed ? "A carregar…" : erroFeed ? "Tentar novamente" : "Ver mais atividade"}
                </button>
              </div>
            )}
          </section>
          {resumo && (
            <div className={styles.dashboardStats} aria-label="Resumo da atividade">
              <div><strong>{resumo.orders}</strong><span>Pedidos criados</span></div>
              <div><strong>{resumo.activeOrders}</strong><span>A receber propostas</span></div>
              <div><strong>{resumo.bookings}</strong><span>Contratações em curso</span></div>
            </div>
          )}
          <section className={styles.dashboardSection} aria-labelledby="cliente-acoes">
            <h2 id="cliente-acoes">O que queres fazer?</h2>
            <div className={styles.dashboardLinks}>
              <Link href="/pedidos/novo"><strong>Criar pedido</strong><span>Descreve o trabalho e recebe propostas.</span></Link>
              <Link href="/pedidos"><strong>Acompanhar pedidos</strong><span>Consulta respostas e fala com prestadores.</span></Link>
              <Link href="/contratacoes"><strong>Ver contratações</strong><span>Gere horários e acompanha serviços.</span></Link>
              <Link href="/mensagens"><strong>Mensagens</strong><span>Continua as conversas da plataforma.</span></Link>
              <Link href="/produtos"><strong>Comprar produtos</strong><span>Encomenda a empresas e lojas da comunidade.</span></Link>
            </div>
          </section>
          <div className={styles.accountActions}>
            <Link className={styles.secondary} href="/perfil">
              Gerir perfis
            </Link>
            <Link className={styles.secondary} href="/explorar">
              Explorar serviços
            </Link>
            <Link className={styles.secondary} href="/mensagens">Mensagens</Link>
            <Link className={styles.secondary} href="/compras">As minhas encomendas</Link>
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
