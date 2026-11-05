"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, ClipboardList, MessageCircle, Star } from "lucide-react";
import AvailabilityWidget from "../availability-widget";
import AnalyticsPanel from "@/app/components/analytics-panel";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";

type Provider = {
  commercial_name: string;
  verification_status: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";
  verification_feedback: string;
};
type Summary = { opportunities: number; proposals: number; services: number; bookings: number; rating: string | null; reviews: number };
type Atividade = { id: string; titulo: string; detalhe: string; estado: string; data: string; href: string };
type Proposal = { id: number; order_id: number; order_title: string; status: string; created_at: string };
type Booking = { id: number; order_id: number; status: string; created_at: string };
type ProductOrder = { id: number; is_provider: boolean; status: string; created_at: string };
type OpportunityPage = { count: number; results: Array<{ id: number; title: string; created_at: string }> };
type Dashboard = {
  provider: {
    services: { active: number; inactive: number };
    proposals_by_status: Record<string, number>;
    bookings_by_status?: Record<string, number>;
    reviews?: { average_rating: string | null; count: number };
  } | null;
};

const estados: Record<Provider["verification_status"], string> = {
  PENDING: "Em análise",
  VERIFIED: "Verificado",
  REJECTED: "Precisa de correções",
  SUSPENDED: "Suspenso",
};
const nomesEstado: Record<string, string> = {
  PENDING: "Pendente", ACCEPTED: "Aceite", REJECTED: "Recusada", CANCELLED: "Cancelada",
  SCHEDULED: "Por agendar", CONFIRMED: "Confirmado", IN_PROGRESS: "Em execução", COMPLETED: "Concluído",
};

function formatarData(valor: string) {
  return new Date(valor).toLocaleDateString("pt-AO", { day: "numeric", month: "short" });
}

export default function PainelPrestador() {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [feed, setFeed] = useState<Atividade[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const dashboardResponse = await fetch("/api/auth/dashboard/", { cache: "no-store" });
      if (dashboardResponse.status === 401) {
        router.replace("/entrar?next=%2Fprestador");
        return;
      }
      if (!dashboardResponse.ok) throw new Error("Não foi possível carregar as métricas da atividade.");
      const dashboard = await dashboardResponse.json() as Dashboard;
      const providerResponse = await fetch("/api/auth/providers/me/", { cache: "no-store" });
      if (providerResponse.status === 401) {
        router.replace("/entrar?next=%2Fprestador");
        return;
      }
      const providerData = providerResponse.ok ? await providerResponse.json() as Provider : null;
      let opportunities = 0;
      let opportunitiesPage: OpportunityPage | null = null;
      if (providerData?.verification_status === "VERIFIED") {
        const opportunitiesResponse = await fetch("/api/auth/orders/opportunities/", { cache: "no-store" });
        if (opportunitiesResponse.status === 401) {
          router.replace("/entrar?next=%2Fprestador");
          return;
        }
        if (opportunitiesResponse.ok) {
          opportunitiesPage = await opportunitiesResponse.json() as OpportunityPage;
          opportunities = opportunitiesPage?.count ?? 0;
        }
      }
      const [proposalsResponse, bookingsResponse, productOrdersResponse] = await Promise.all([
        fetch("/api/auth/proposals/", { cache: "no-store" }),
        fetch("/api/auth/bookings/", { cache: "no-store" }),
        fetch("/api/auth/product-orders", { cache: "no-store" }),
      ]);
      if ([proposalsResponse, bookingsResponse, productOrdersResponse].some((response) => response.status === 401)) {
        router.replace("/entrar?next=%2Fprestador");
        return;
      }
      const [proposals, bookings, productOrders] = await Promise.all([
        proposalsResponse.ok ? proposalsResponse.json() as Promise<{ results: Proposal[] }> : Promise.resolve({ results: [] }),
        bookingsResponse.ok ? bookingsResponse.json() as Promise<{ results: Booking[] }> : Promise.resolve({ results: [] }),
        productOrdersResponse.ok ? productOrdersResponse.json() as Promise<{ results: ProductOrder[] }> : Promise.resolve({ results: [] }),
      ]);
      if (!active) return;
      setProvider(providerData);
      const business = dashboard.provider;
      setSummary({
        opportunities,
        proposals: business ? Object.entries(business.proposals_by_status)
          .filter(([status]) => status !== "CANCELLED")
          .reduce((sum, [, count]) => sum + count, 0) : 0,
        services: business?.services.active ?? 0,
        bookings: business?.bookings_by_status ? Object.values(business.bookings_by_status).reduce((sum, count) => sum + count, 0) : 0,
        rating: business?.reviews?.average_rating ?? null,
        reviews: business?.reviews?.count ?? 0,
      });
      setFeed(providerData ? [
        ...proposals.results.map((proposal) => ({
          id: `proposta-${proposal.id}`, titulo: `Proposta no pedido: ${proposal.order_title}`,
          detalhe: "A tua proposta", estado: nomesEstado[proposal.status] ?? proposal.status,
          data: proposal.created_at, href: "/prestador/pedidos",
        })),
        ...bookings.results.map((booking) => ({
          id: `contratacao-${booking.id}`, titulo: `Contratação #${booking.id}`,
          detalhe: `Pedido #${booking.order_id}`, estado: nomesEstado[booking.status] ?? booking.status,
          data: booking.created_at, href: "/contratacoes",
        })),
        ...productOrders.results.filter((order) => order.is_provider).map((order) => ({
          id: `encomenda-produto-${order.id}`, titulo: `Encomenda de produtos #${order.id}`,
          detalhe: "Compra recebida", estado: nomesEstado[order.status] ?? order.status,
          data: order.created_at, href: "/empresa/encomendas",
        })),
        ...(opportunitiesPage?.results ?? []).map((opportunity) => ({
          id: `oportunidade-${opportunity.id}`, titulo: opportunity.title,
          detalhe: "Novo pedido compatível", estado: "Oportunidade",
          data: opportunity.created_at, href: "/prestador/pedidos",
        })),
      ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 8) : []);
      if (!providerResponse.ok && providerResponse.status !== 404) {
        setError("O estado do perfil profissional não está disponível neste momento.");
      }
    })()
      .catch(() => {
        if (active) setError("Não foi possível contactar a plataforma. Tenta atualizar o painel.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [router]);

  return (
    <EstruturaAutenticacao account area="provider" profileName={provider?.commercial_name}>
      <p className={styles.eyebrow}>Área profissional</p>
      <h1>{provider?.commercial_name ? `Olá, ${provider.commercial_name}` : "Painel do prestador"}</h1>
      <p className={styles.intro}>Acompanha o teu desempenho e gere os serviços que apresentas aos clientes.</p>
      {loading ? <p className={styles.intro} aria-live="polite">A carregar o teu painel…</p> : (
        <>
          {error && <p className={styles.notice} role="status">{error}</p>}
          <section className={styles.providerWelcome}>
            <span className={styles.providerWelcomeAvatar}>{provider?.commercial_name?.slice(0, 1).toLocaleUpperCase("pt-AO") ?? "P"}</span>
            <div><span>Perfil profissional</span><strong>{provider?.commercial_name ?? "Completa o teu perfil"}</strong><small>Angola · Serviços e oportunidades</small></div>
            {provider && <span className={styles.providerWelcomeStatus} data-status={provider.verification_status}>{estados[provider.verification_status]}</span>}
            <Link href="/perfil">Editar perfil</Link>
          </section>
          {summary && <div className={styles.dashboardStats} aria-label="Resumo da atividade">
            <div className={styles.metricCard}><span className={styles.metricIcon} data-tone="blue"><BriefcaseBusiness size={19} aria-hidden="true" /></span><strong>{summary.services}</strong><span>Serviços publicados</span></div>
            <div className={styles.metricCard}><span className={styles.metricIcon} data-tone="violet"><ClipboardList size={19} aria-hidden="true" /></span><strong>{summary.opportunities}</strong><span>Pedidos disponíveis</span></div>
            <div className={styles.metricCard}><span className={styles.metricIcon} data-tone="blue"><MessageCircle size={19} aria-hidden="true" /></span><strong>{summary.proposals}</strong><span>Propostas enviadas</span></div>
            <div className={styles.metricCard}><span className={styles.metricIcon} data-tone="amber"><Star size={19} aria-hidden="true" /></span><strong>{summary.rating ?? "—"}</strong><span>Avaliação média · {summary.reviews} avaliações</span></div>
          </div>}
          {provider && <div className={styles.providerStatus}>
            <span>Estado do perfil profissional</span>
            <strong data-status={provider.verification_status}>{estados[provider.verification_status]}</strong>
            {provider.verification_status === "REJECTED" && provider.verification_feedback && <p>{provider.verification_feedback}</p>}
          </div>}
          {provider && <AnalyticsPanel />}
          {provider && <AvailabilityWidget />}
          <section className={styles.feedSection} aria-labelledby="atividade-prestador">
            <div className={styles.feedHeading}>
              <div><p className={styles.eyebrow}>A tua rede</p><h2 id="atividade-prestador">Atividade recente</h2></div>
              <Link href="/prestador/pedidos">Ver oportunidades</Link>
            </div>
            {feed.length ? <ol className={styles.activityFeed}>
              {feed.map((item) => <li key={item.id}>
                <span className={styles.feedMarker} aria-hidden="true" />
                <Link href={item.href} className={styles.activityCard}>
                  <span className={styles.activityMeta}><span>{item.detalhe}</span><time dateTime={item.data}>{formatarData(item.data)}</time></span>
                  <strong>{item.titulo}</strong>
                  <span className={styles.activityState}>{item.estado}</span>
                </Link>
              </li>)}
            </ol> : <div className={styles.feedEmpty}>
              <strong>O teu feed profissional está pronto</strong>
              <p>As oportunidades e atualizações da tua atividade vão aparecer aqui.</p>
              <Link href="/perfil">Completar perfil profissional</Link>
            </div>}
          </section>
          <section className={styles.dashboardSection} aria-labelledby="prestador-acoes">
            <h2 id="prestador-acoes">Gerir a tua atividade</h2>
            <div className={styles.dashboardLinks}>
              <Link href="/prestador/pedidos"><strong>Encontrar pedidos</strong><span>Consulta oportunidades e envia propostas.</span></Link>
              <Link href="/prestador/servicos"><strong>Gerir serviços</strong><span>Atualiza o catálogo que os clientes encontram.</span></Link>
              <Link href="/empresa/produtos"><strong>Gerir produtos</strong><span>Publica artigos com preço e stock.</span></Link>
              <Link href="/empresa/encomendas"><strong>Encomendas recebidas</strong><span>Responde aos pedidos dos clientes.</span></Link>
              <Link href="/perfil"><strong>Perfil e verificação</strong><span>Completa os dados e acompanha os documentos.</span></Link>
              <Link href="/mensagens"><strong>Mensagens</strong><span>Responde a clientes e acompanha conversas.</span></Link>
              <Link href="/contratacoes"><strong>Contratações</strong><span>Gere marcações e serviços em curso.</span></Link>
            </div>
          </section>
          {!provider && <p className={styles.success}>Cria o teu perfil profissional para começares a apresentar os teus serviços.</p>}
        </>
      )}
    </EstruturaAutenticacao>
  );
}
