"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Building2,
  ClipboardList,
  FileCheck2,
  Eye,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  ShoppingBag,
  Star,
  Tags,
  Users,
  UserRound,
} from "lucide-react";
import { ApiRequestError, requisitarJson } from "@/lib/api-client";
import styles from "./admin.module.css";

type AdminDashboard = {
  summary: {
    users_total: number;
    businesses_total: number;
    providers_total: number;
    services_total: number;
    products_total: number;
    service_orders_total: number;
    product_orders_total: number;
    conversations_total: number;
    views_total: number;
    verifications_pending: number;
  };
  analytics: {
    period_days: number;
    summary: Record<AdminAnalyticsMetric, number>;
    series: Array<Record<AdminAnalyticsMetric, number> & { date: string }>;
  };
  user_growth: Array<{ month: string; users: number }>;
  services_by_category: Array<{ id: number; name: string; total: number; percentage: number }>;
  recent_users: Array<{ id: number; email: string; created_at: string; active: boolean; staff: boolean }>;
  pending_verifications: Array<{ id: number; name: string; submitted_at: string }>;
  recent_activity: Array<{
    id: number;
    provider_name: string;
    previous_status: string;
    new_status: string;
    actor: string | null;
    created_at: string;
  }>;
  reports_available: boolean;
};

type AdminAnalyticsMetric =
  | "registrations"
  | "publications"
  | "service_orders"
  | "product_orders"
  | "conversations"
  | "views";

const navegacao = [
  { label: "Dashboard", href: "#dashboard", icon: LayoutDashboard },
  { label: "Utilizadores", href: "/api/admin/accounts/user", icon: Users },
  { label: "Empresas", href: "/api/admin/businesses/businessprofile", icon: Building2 },
  { label: "Prestadores", href: "/api/admin/providers/provider", icon: UserRound },
  { label: "Categorias", href: "/api/admin/catalog/category", icon: Tags },
  { label: "Serviços publicados", href: "/api/admin/catalog/service", icon: ClipboardList },
  { label: "Pedidos", href: "/api/admin/orders/serviceorder", icon: ShoppingBag },
  { label: "Avaliações", href: "/api/admin/reviews/review", icon: Star },
  { label: "Verificações", href: "/api/admin/providers/provider", icon: FileCheck2 },
  { label: "Registos de actividade", href: "/api/admin/providers/providerverificationauditevent", icon: Activity },
];

const metricasAnalise: Array<{ key: AdminAnalyticsMetric; label: string }> = [
  { key: "registrations", label: "Novos registos" },
  { key: "publications", label: "Publicações" },
  { key: "service_orders", label: "Pedidos de serviço" },
  { key: "product_orders", label: "Encomendas" },
  { key: "conversations", label: "Conversas" },
  { key: "views", label: "Visualizações" },
];

function formatarData(valor: string) {
  return new Date(valor).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" });
}

function formatarDataRelativa(valor: string) {
  return new Date(valor).toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" });
}

function formatarDataCurta(valor: string) {
  return new Date(`${valor}T12:00:00`).toLocaleDateString("pt-AO", {
    day: "2-digit",
    month: "short",
  });
}

function rotuloEstado(valor: string) {
  const estados: Record<string, string> = {
    PENDING: "Pendente",
    VERIFIED: "Verificado",
    REJECTED: "Rejeitado",
    SUSPENDED: "Suspenso",
  };
  return estados[valor] ?? valor;
}

export default function AdministracaoPage() {
  const router = useRouter();
  const [dados, definirDados] = useState<AdminDashboard | null>(null);
  const [erro, definirErro] = useState("");
  const [semPermissao, definirSemPermissao] = useState(false);
  const [aCarregar, definirCarregamento] = useState(true);
  const [tentativas, definirTentativas] = useState(0);
  const [aTerminarSessao, definirTerminoSessao] = useState(false);
  const [erroSessao, definirErroSessao] = useState("");
  const [periodo, definirPeriodo] = useState<7 | 30 | 90>(30);
  const [metrica, definirMetrica] = useState<AdminAnalyticsMetric>("registrations");

  useEffect(() => {
    let ativo = true;
    requisitarJson<AdminDashboard>(`/api/auth/admin/dashboard?period=${periodo}`)
      .then((resultado) => {
        if (ativo) {
          definirDados(resultado);
          definirErro("");
          definirSemPermissao(false);
        }
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        if (falha instanceof ApiRequestError && falha.status === 401) {
          router.replace("/entrar?next=%2Fadmin");
          return;
        }
        if (falha instanceof ApiRequestError && falha.status === 403) {
          definirSemPermissao(true);
          return;
        }
        definirErro(falha instanceof Error ? falha.message : "Não foi possível carregar os dados do painel.");
      })
      .finally(() => {
        if (ativo) definirCarregamento(false);
      });

    return () => { ativo = false; };
  }, [router, tentativas, periodo]);

  const valoresGrafico = dados?.analytics.series ?? [];
  const maximoGrafico = Math.max(1, ...valoresGrafico.map((item) => item[metrica]));
  const pontosGrafico = valoresGrafico.map((item, index, lista) => {
    const x = lista.length > 1 ? 30 + (index / (lista.length - 1)) * 580 : 320;
    const y = 184 - (item[metrica] / maximoGrafico) * 150;
    return { ...item, x, y };
  });

  async function terminarSessao() {
    definirTerminoSessao(true);
    definirErroSessao("");
    try {
      const resposta = await fetch("/api/auth/logout/", { method: "POST" });
      if (!resposta.ok) {
        definirErroSessao("Não foi possível terminar a sessão. Tenta novamente.");
        return;
      }
      router.replace("/");
    } catch {
      definirErroSessao("Não foi possível contactar o serviço para terminar a sessão.");
    } finally {
      definirTerminoSessao(false);
    }
  }

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar} aria-label="Menu administrativo">
        <Link className={styles.brandBlock} href="/" aria-label="Conect Services — página inicial">
          <div className={styles.brandMark} aria-hidden="true">C</div>
          <div>
            <p className={styles.brandName}>Conect</p>
            <small>Administração da plataforma</small>
          </div>
        </Link>
        <div className={styles.adminProfile}>
          <span><ShieldCheck size={18} aria-hidden="true" /></span>
          <div><strong>Administração</strong><small>Conta autorizada</small></div>
        </div>
        <nav className={styles.nav}>
          {navegacao.map((item, index) => {
            const Icon = item.icon;
            return (
            <Link
              key={item.label}
              href={item.href}
              className={index === 0 ? styles.navItemActive : styles.navItem}
              aria-current={index === 0 ? "page" : undefined}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
            );
          })}
        </nav>
        <Link className={styles.backendLink} href="/api/admin/providers/provider">
          Abrir área de gestão
          <span>Django Admin</span>
        </Link>
        <div className={styles.sidebarLogout}>
          {erroSessao && <p role="alert">{erroSessao}</p>}
          <button type="button" onClick={() => void terminarSessao()} disabled={aTerminarSessao}>
            <LogOut size={17} aria-hidden="true" />
            {aTerminarSessao ? "A terminar sessão…" : "Sair"}
          </button>
        </div>
      </aside>

      <div className={styles.mainPanel} id="dashboard">
        <header className={styles.topbar}>
          <div>
            <p className={styles.eyebrow}>Área restrita · Administração da plataforma</p>
            <h1>Dashboard geral</h1>
          </div>
          {dados && <span className={styles.adminStatus}>Sessão de administrador autorizada</span>}
        </header>

        {aCarregar ? (
          <p className={styles.feedback} role="status">A carregar dados do painel…</p>
        ) : semPermissao ? (
          <section className={styles.feedback} role="alert">
            <h2>Acesso restrito</h2>
            <p>Esta área está disponível apenas para contas com permissões administrativas.</p>
            <Link href="/">Voltar à página inicial</Link>
          </section>
        ) : erro ? (
          <section className={styles.feedback} role="alert">
            <h2>Não foi possível carregar o painel</h2>
            <p>{erro}</p>
            <button type="button" className={styles.primaryButton} onClick={() => {
              definirCarregamento(true);
              definirTentativas((atual) => atual + 1);
            }}>Tentar novamente</button>
          </section>
        ) : dados ? (
          <>
            <section className={styles.summaryGrid} aria-label="Indicadores reais da plataforma">
              {[
                { label: "Total de utilizadores", value: dados.summary.users_total, tone: "blue", icon: Users },
                { label: "Empresas", value: dados.summary.businesses_total, tone: "purple", icon: Building2 },
                { label: "Prestadores registados", value: dados.summary.providers_total, tone: "green", icon: UserRound },
                { label: "Serviços publicados", value: dados.summary.services_total, tone: "amber", icon: ClipboardList },
                { label: "Produtos publicados", value: dados.summary.products_total, tone: "cyan", icon: ShoppingBag },
                { label: "Pedidos de serviço", value: dados.summary.service_orders_total, tone: "blue", icon: ClipboardList },
                { label: "Encomendas", value: dados.summary.product_orders_total, tone: "purple", icon: ShoppingBag },
                { label: "Conversas", value: dados.summary.conversations_total, tone: "green", icon: Activity },
                { label: "Visualizações", value: dados.summary.views_total, tone: "cyan", icon: Eye },
                { label: "Verificações pendentes", value: dados.summary.verifications_pending, tone: "red", icon: FileCheck2 },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.label} className={`${styles.summaryCard} ${styles[card.tone]}`}>
                    <span className={styles.summaryIcon}><Icon size={18} aria-hidden="true" /></span>
                    <span>{card.label}</span>
                    <strong>{card.value.toLocaleString("pt-AO")}</strong>
                    <em>Dados da plataforma</em>
                  </article>
                );
              })}
            </section>

            <section className={styles.graphGrid}>
              <article className={styles.chartCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.cardKicker}>
                      Últimos {periodo} dias · {dados.analytics.summary[metrica].toLocaleString("pt-AO")} no período
                    </p>
                    <h2>{metricasAnalise.find((item) => item.key === metrica)?.label}</h2>
                  </div>
                  <div className={styles.chartControls}>
                    <label>
                      <span className={styles.visuallyHidden}>Métrica do gráfico</span>
                      <select value={metrica} onChange={(event) => definirMetrica(event.target.value as AdminAnalyticsMetric)}>
                        {metricasAnalise.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className={styles.visuallyHidden}>Período da análise</span>
                      <select value={periodo} onChange={(event) => definirPeriodo(Number(event.target.value) as 7 | 30 | 90)}>
                        <option value={7}>7 dias</option>
                        <option value={30}>30 dias</option>
                        <option value={90}>90 dias</option>
                      </select>
                    </label>
                  </div>
                </div>
                {pontosGrafico.length ? (
                  <>
                    <svg className={styles.lineChart} viewBox="0 0 640 210" role="img" aria-label={`${metricasAnalise.find((item) => item.key === metrica)?.label} por dia`}>
                      {[40, 90, 140, 190].map((y) => <line key={y} x1="20" x2="620" y1={y} y2={y} className={styles.chartGridLine} />)}
                      <polyline
                        points={pontosGrafico.map((ponto) => `${ponto.x},${ponto.y}`).join(" ")}
                        className={styles.chartLine}
                      />
                      {pontosGrafico.map((ponto) => (
                        <circle
                          key={ponto.date}
                          cx={ponto.x}
                          cy={ponto.y}
                          r="4"
                          className={styles.chartPoint}
                        >
                          <title>{`${formatarDataCurta(ponto.date)}: ${ponto[metrica]}`}</title>
                        </circle>
                      ))}
                    </svg>
                    <div className={styles.chartLabels}>
                      <small>{formatarDataCurta(pontosGrafico[0].date)}</small>
                      <small>{formatarDataCurta(pontosGrafico[Math.floor(pontosGrafico.length / 2)].date)}</small>
                      <small>{formatarDataCurta(pontosGrafico[pontosGrafico.length - 1].date)}</small>
                    </div>
                  </>
                ) : <p className={styles.emptyState}>Ainda não há dados de análise para este período.</p>}
              </article>

              <article className={styles.chartCard} id="services">
                <div className={styles.cardHeader}>
                  <div><p className={styles.cardKicker}>Serviços activos</p><h2>Distribuição por categoria</h2></div>
                </div>
                {dados.services_by_category.length ? (
                  <div className={styles.categoryChart}>
                    {dados.services_by_category.map((item, index) => (
                      <div key={item.id} className={styles.categoryRow}>
                        <div className={styles.labelRow}><span className={`${styles.dot} ${styles[`categoryDot${index % 5}`]}`} /><span>{item.name}</span></div>
                        <div className={styles.track}><span className={`${styles.categoryBar} ${styles[`categoryBar${index % 5}`]}`} style={{ width: `${item.percentage}%` }} /></div>
                        <strong>{item.total}</strong>
                      </div>
                    ))}
                  </div>
                ) : <p className={styles.emptyState}>Não existem serviços publicados nesta categoria.</p>}
              </article>
            </section>

            <section className={styles.dataGrid}>
              <article className={styles.tableCard} id="users">
                <div className={styles.cardHeader}>
                  <div><p className={styles.cardKicker}>Contas recentes</p><h2>Utilizadores recentes</h2></div>
                  <Link className={styles.textButton} href="/api/admin/accounts/user">Ver utilizadores</Link>
                </div>
                {dados.recent_users.length ? (
                  <div className={styles.tableScroll}><table>
                    <thead><tr><th>Email</th><th>Registo</th><th>Estado</th><th>Tipo</th></tr></thead>
                    <tbody>{dados.recent_users.map((person) => (
                      <tr key={person.id}>
                        <td>{person.email}</td><td>{formatarData(person.created_at)}</td>
                        <td><span className={person.active ? styles.statusPill : styles.statusPillWarning}>{person.active ? "Activo" : "Inactivo"}</span></td>
                        <td>{person.staff ? "Administrador" : "Utilizador"}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                ) : <p className={styles.emptyState}>Ainda não existem utilizadores registados.</p>}
              </article>

              <article className={styles.tableCard} id="verifications">
                <div className={styles.cardHeader}>
                  <div><p className={styles.cardKicker}>Revisão necessária</p><h2>Verificações de prestadores</h2></div>
                  <Link className={styles.textButton} href="/api/admin/providers/provider">Gerir prestadores</Link>
                </div>
                {dados.pending_verifications.length ? (
                  <ul className={styles.listPanel}>
                    {dados.pending_verifications.map((provider) => (
                      <li key={provider.id}>
                        <div><strong>{provider.name}</strong><span>Submetido em {formatarData(provider.submitted_at)}</span></div>
                        <Link className={styles.linkButton} href={`/api/admin/providers/provider/${provider.id}/change/`}>Consultar</Link>
                      </li>
                    ))}
                  </ul>
                ) : <p className={styles.emptyState}>Não há verificações submetidas pendentes.</p>}
              </article>
            </section>

            <section className={styles.bottomGrid}>
              <article className={styles.tableCard} id="activity">
                <div className={styles.cardHeader}>
                  <div><p className={styles.cardKicker}>Auditoria</p><h2>Actividade de verificação</h2></div>
                  <Link className={styles.textButton} href="/api/admin/providers/providerverificationauditevent">Ver registos</Link>
                </div>
                {dados.recent_activity.length ? (
                  <ul className={styles.timeline}>
                    {dados.recent_activity.map((entry) => (
                      <li key={entry.id}>
                        <span className={styles.timelineDot} aria-hidden="true" />
                        <div><strong>{entry.provider_name}</strong><p>{rotuloEstado(entry.previous_status || "—")} → {rotuloEstado(entry.new_status)} · {entry.actor ?? "Sistema"}</p></div>
                        <time>{formatarDataRelativa(entry.created_at)}</time>
                      </li>
                    ))}
                  </ul>
                ) : <p className={styles.emptyState}>As decisões administrativas aparecerão aqui após a primeira revisão.</p>}
              </article>

              <article className={styles.tableCard}>
                <div className={styles.cardHeader}>
                  <div><p className={styles.cardKicker}>Moderação</p><h2>Denúncias</h2></div>
                </div>
                <p className={styles.emptyState}>
                  {dados.reports_available
                    ? "As denúncias serão apresentadas aqui."
                    : "A plataforma ainda não tem um módulo de denúncias ligado à API. Nenhum dado demonstrativo é apresentado."}
                </p>
              </article>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
