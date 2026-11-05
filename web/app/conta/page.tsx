"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ClipboardList, Heart, MessageCircle } from "lucide-react";
import EstruturaAutenticacao from "../auth-shell";
import BusinessLogo from "../components/business-logo";
import styles from "../auth.module.css";

type Profile = { full_name: string };
type DashboardSummary = { favorites: number | null; orders: number | null; messages: number | null; notifications: number | null };
type Dashboard = {
  client: {
    orders_by_status: Record<string, number>;
    proposals_received_by_status: Record<string, number>;
    bookings_by_status: Record<string, number>;
  };
};
type Atividade = { id: string; titulo: string; detalhe: string; estado: string; data: string; href: string };
type ApiPage<T> = { results: T[]; next: string | null };
type CountPage = { count?: number; results?: unknown[] };
type Order = { id: number; title: string; status: string; created_at: string };
type Proposal = { id: number; order_id: number; order_title: string; provider_name: string; status: string; created_at: string };
type Booking = { id: number; order_id: number; provider_name: string; status: string; created_at: string };
type RecommendedProvider = {
  id: number;
  commercial_name: string;
  description: string;
  verification_status: string;
  business_profile?: { logo: string | null } | null;
  active_service_count: number;
  average_rating: string | null;
  review_count: number;
};

const nomesEstado: Record<string, string> = {
  OPEN: "Aberto", NEGOTIATING: "A receber propostas", AWARDED: "Contratado", COMPLETED: "Concluído", CANCELLED: "Cancelado",
  PENDING: "Pendente", ACCEPTED: "Aceite", REJECTED: "Recusada", WITHDRAWN: "Retirada",
  SCHEDULED: "Por agendar", CONFIRMED: "Confirmado", IN_PROGRESS: "Em execução",
};

function formatarData(valor: string) {
  return new Date(valor).toLocaleDateString("pt-AO", { day: "numeric", month: "short" });
}

function contarItens(pagina: CountPage) {
  return typeof pagina.count === "number" ? pagina.count : pagina.results?.length ?? 0;
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
  const [erroMetricas, definirErroMetricas] = useState("");
  const [erroPrestadores, definirErroPrestadores] = useState("");
  const [nome, setNome] = useState("");
  const [resumo, setResumo] = useState<DashboardSummary | null>(null);
  const [feed, setFeed] = useState<Atividade[]>([]);
  const [paginaApiFeed, definirPaginaApiFeed] = useState(1);
  const [limiteFeed, definirLimiteFeed] = useState(8);
  const [temMaisFeed, definirTemMaisFeed] = useState(false);
  const [aCarregarFeed, definirCarregamentoFeed] = useState(false);
  const [erroFeed, definirErroFeed] = useState("");
  const [prestadoresEmDestaque, definirPrestadoresEmDestaque] = useState<RecommendedProvider[]>([]);

  useEffect(() => {
    let ativo = true;
    fetch("/api/public/providers/discover/?ordering=-rating&page=1", { cache: "no-store" })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error("Não foi possível carregar os prestadores em destaque.");
        const pagina = await resposta.json() as { results: RecommendedProvider[] };
        if (ativo) definirPrestadoresEmDestaque(pagina.results.slice(0, 3));
      })
      .catch((motivo: unknown) => {
        if (ativo) {
          definirErroPrestadores(motivo instanceof Error
            ? motivo.message
            : "Não foi possível carregar os prestadores em destaque.");
        }
      });
    return () => { ativo = false; };
  }, []);

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
        const [
          pedidosHttp,
          propostasHttp,
          contratacoesHttp,
          favoritosPrestadoresHttp,
          favoritosServicosHttp,
          conversasHttp,
          notificacoesHttp,
        ] = await Promise.all([
          fetch("/api/auth/orders/", { cache: "no-store" }),
          fetch("/api/auth/proposals/", { cache: "no-store" }),
          fetch("/api/auth/bookings/", { cache: "no-store" }),
          fetch("/api/auth/favorites/providers/", { cache: "no-store" }),
          fetch("/api/auth/favorites/services/", { cache: "no-store" }),
          fetch("/api/auth/conversations/", { cache: "no-store" }),
          fetch("/api/auth/notifications/unread-count/", { cache: "no-store" }),
        ]);
        if ([pedidosHttp, propostasHttp, contratacoesHttp, favoritosPrestadoresHttp, favoritosServicosHttp, conversasHttp, notificacoesHttp].some((response) => response.status === 401)) {
          navegador.replace("/entrar?next=%2Fconta");
          return;
        }
        const [
          pedidos,
          propostas,
          contratacoes,
          favoritosPrestadores,
          favoritosServicos,
          conversas,
          notificacoes,
        ] = await Promise.all([
          pedidosHttp.ok ? pedidosHttp.json() as Promise<ApiPage<Order>> : Promise.resolve({ results: [], next: null }),
          propostasHttp.ok ? propostasHttp.json() as Promise<ApiPage<Proposal>> : Promise.resolve({ results: [], next: null }),
          contratacoesHttp.ok ? contratacoesHttp.json() as Promise<ApiPage<Booking>> : Promise.resolve({ results: [], next: null }),
          favoritosPrestadoresHttp.ok ? favoritosPrestadoresHttp.json() as Promise<CountPage> : Promise.resolve(null),
          favoritosServicosHttp.ok ? favoritosServicosHttp.json() as Promise<CountPage> : Promise.resolve(null),
          conversasHttp.ok ? conversasHttp.json() as Promise<CountPage> : Promise.resolve(null),
          notificacoesHttp.ok ? notificacoesHttp.json() as Promise<{ unread_count?: number }> : Promise.resolve(null),
        ]);
        if ([favoritosPrestadoresHttp, favoritosServicosHttp, conversasHttp, notificacoesHttp].some((response) => !response.ok)) {
          definirErroMetricas("Alguns indicadores não estão disponíveis neste momento.");
        }
        const atividades = criarAtividades(pedidos.results, propostas.results, contratacoes.results);
        if (ativo) {
          setFeed(atividades);
          definirTemMaisFeed(Boolean(pedidos.next || propostas.next || contratacoes.next));
        }
        const estadosPedidos = dashboard?.client?.orders_by_status ?? {};
        setResumo({
          favorites: favoritosPrestadores && favoritosServicos
            ? contarItens(favoritosPrestadores) + contarItens(favoritosServicos)
            : null,
          orders: dashboard?.client
            ? Object.values(estadosPedidos).reduce((soma, count) => soma + count, 0)
            : null,
          messages: conversas ? contarItens(conversas) : null,
          notifications: typeof notificacoes?.unread_count === "number" ? notificacoes.unread_count : null,
        });
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

  return (
    <EstruturaAutenticacao account profileName={nome}>
      <p className={styles.eyebrow}>Feed da comunidade</p>
      <h1>{nome ? `Olá, ${nome.split(" ")[0]}` : "O teu feed"}</h1>
      {estaCarregando ? (
        <p className={styles.intro} aria-live="polite">
          A validar a sessão…
        </p>
      ) : account ? (
        <>
          <p className={styles.intro}>
            Acompanha os teus pedidos e encontra profissionais para o que precisares.
          </p>
          <div className={styles.dashboardStats} aria-label="Resumo da atividade">
            <div className={styles.metricCard}><span className={styles.metricIcon} data-tone="rose"><Heart size={19} aria-hidden="true" /></span><strong>{resumo?.favorites ?? "—"}</strong><span>Favoritos</span></div>
            <div className={styles.metricCard}><span className={styles.metricIcon} data-tone="blue"><ClipboardList size={19} aria-hidden="true" /></span><strong>{resumo?.orders ?? "—"}</strong><span>Pedidos</span></div>
            <div className={styles.metricCard}><span className={styles.metricIcon} data-tone="violet"><MessageCircle size={19} aria-hidden="true" /></span><strong>{resumo?.messages ?? "—"}</strong><span>Mensagens</span></div>
            <div className={styles.metricCard}><span className={styles.metricIcon} data-tone="amber"><Bell size={19} aria-hidden="true" /></span><strong>{resumo?.notifications ?? "—"}</strong><span>Notificações</span></div>
          </div>
          {erroMetricas && <p className={styles.profileHint} role="status">{erroMetricas}</p>}
          <section className={styles.dashboardSection} id="destaques" aria-labelledby="prestadores-destaque">
            <div className={styles.feedHeading}>
              <div><p className={styles.eyebrow}>Descobre na comunidade</p><h2 id="prestadores-destaque">Prestadores em destaque</h2></div>
              <Link href="/explorar">Ver todos</Link>
            </div>
            {prestadoresEmDestaque.length ? <div className={styles.featuredProviders}>
              {prestadoresEmDestaque.map((prestador) => <article className={styles.featuredProvider} key={prestador.id}>
                <BusinessLogo
                  className={styles.featuredImage}
                  companyName={prestador.commercial_name}
                  logoUrl={prestador.business_profile?.logo}
                  width={72}
                  height={72}
                />
                <div>
                  <strong>{prestador.commercial_name}</strong>
                  <small>{prestador.description || "Prestador de serviços em Angola."}</small>
                  <span className={styles.featuredMeta}>{prestador.average_rating ? `★ ${prestador.average_rating} · ${prestador.review_count} avaliações` : "Novo prestador"} · {prestador.active_service_count} serviços</span>
                  <span className={styles.featuredCategory}>{prestador.verification_status === "VERIFIED" ? "Prestador verificado" : "Serviços em destaque"}</span>
                </div>
                <Link href={`/prestadores/${prestador.id}`}>Ver perfil</Link>
              </article>)}
            </div> : <p className={styles.profileHint} role={erroPrestadores ? "alert" : undefined}>
              {erroPrestadores || "Os profissionais disponíveis aparecerão aqui."}
            </p>}
          </section>
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
