import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  TrendingUp,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ApiRequestError, requisitarJson } from "@/lib/api-client";
import styles from "./admin.module.css";

const navigation = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard, section: "dashboard" },
  { label: "Utilizadores", path: "/admin?section=users", icon: Users, section: "users" },
  { label: "Empresas / PMEs", path: "/admin?section=businesses", icon: Building2, section: "businesses" },
  { label: "Prestadores", path: "/admin?section=providers", icon: UserRound, section: "providers" },
  { label: "Serviços", path: "/admin?section=services", icon: ClipboardList, section: "services" },
  { label: "Pedidos", path: "/admin?section=orders", icon: ShoppingBag, section: "orders" },
  { label: "Avaliações", path: "/admin?section=reviews", icon: Star, section: "reviews" },
  { label: "Relatórios", path: "/admin?section=reports", icon: TrendingUp, section: "reports" },
  { label: "Configurações", path: "/admin?section=settings", icon: Settings, section: "settings" },
  { label: "Suporte", path: "/admin?section=support", icon: LifeBuoy, section: "support" },
];

const chartColors = ["#4c8dff", "#24c9d8", "#9b8cff", "#f7b955", "#ff7d91", "#53d6a0"];
const metricLabels = {
  registrations: "Registos",
  publications: "Publicações",
  service_orders: "Pedidos de serviço",
  product_orders: "Encomendas",
  conversations: "Conversas",
  views: "Visualizações",
};

const metricIcons = {
  registrations: Users,
  publications: ClipboardList,
  service_orders: ShoppingBag,
  product_orders: ShoppingBag,
  conversations: Activity,
  views: TrendingUp,
};

const djangoAdminPaths = {
  users: "/admin/accounts/user/",
  businesses: "/admin/businesses/businessprofile/",
  providers: "/admin/providers/provider/",
  services: "/admin/catalog/service/",
  orders: "/admin/orders/serviceorder/",
  reviews: "/admin/reviews/review/",
};

function validateDashboardData(data) {
  const requiredSummary = [
    "users_total",
    "businesses_total",
    "providers_total",
    "services_total",
    "verifications_pending",
  ];
  const validSummary = requiredSummary.every((key) => Number.isFinite(data?.summary?.[key]));
  const validAnalytics = Object.keys(metricLabels).every((key) =>
    Number.isFinite(data?.analytics?.summary?.[key]),
  );
  const validAdministration = [
    "business_verifications_pending",
    "inactive_services",
  ].every((key) => Number.isFinite(data?.summary?.[key]));
  const validComparison =
    Number.isInteger(data?.period_comparison?.period_days) &&
    Object.keys(metricLabels).every((key) => {
      const metric = data?.period_comparison?.metrics?.[key];
      return Number.isFinite(metric?.current) &&
        Number.isFinite(metric?.previous) &&
        Number.isFinite(metric?.change) &&
        (Number.isFinite(metric?.change_percent) || metric?.change_percent === null);
    });
  const analysisMetrics = data?.analytics?.analysis?.metrics;
  const validStatisticalAnalysis =
    data?.analytics?.analysis?.method === "ordinary_least_squares" &&
    Number.isInteger(data?.analytics?.analysis?.rolling_window_days) &&
    Object.keys(metricLabels).every((key) => {
      const metric = analysisMetrics?.[key];
      return Number.isFinite(metric?.total) &&
        Number.isFinite(metric?.daily_average) &&
        (Number.isFinite(metric?.daily_standard_deviation) || metric?.daily_standard_deviation === null) &&
        Number.isFinite(metric?.active_days) &&
        Number.isFinite(metric?.zero_days) &&
        Number.isFinite(metric?.trend_per_day) &&
        ["increasing", "decreasing", "stable"].includes(metric?.trend_direction) &&
        (Number.isFinite(metric?.r_squared) || metric?.r_squared === null);
    });
  const validCollections =
    Array.isArray(data?.analytics?.series) &&
    data.analytics.series.every((item) =>
      Object.keys(metricLabels).every((key) => {
        const average = item[`${key}_average_7d`];
        return Number.isFinite(average) || average === null;
      }),
    ) &&
    Array.isArray(data?.user_growth) &&
    Array.isArray(data?.business_growth) &&
    Array.isArray(data?.services_by_category) &&
    Array.isArray(data?.recent_users) &&
    Array.isArray(data?.pending_verifications) &&
    Array.isArray(data?.pending_businesses) &&
    Array.isArray(data?.inactive_services) &&
    Array.isArray(data?.recent_activity);
  const validFunnel =
    Array.isArray(data?.service_order_funnel?.stages) &&
    data.service_order_funnel.stages.length === 4 &&
    data.service_order_funnel.stages.every((stage) =>
      Number.isFinite(stage.count) &&
      (Number.isFinite(stage.conversion_from_previous) || stage.conversion_from_previous === null),
    );

  if (!validSummary || !validAnalytics || !validAdministration || !validComparison || !validStatisticalAnalysis || !validCollections || !validFunnel) {
    throw new Error("A API devolveu dados incompletos para apresentar o painel administrativo.");
  }
  return data;
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("pt-AO");
}

function formatDecimal(value) {
  return value === null || value === undefined
    ? "N/D"
    : Number(value).toLocaleString("pt-AO", { maximumFractionDigits: 2 });
}

function formatDate(value, options = { day: "2-digit", month: "short", year: "numeric" }) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-AO", options);
}

function formatMonth(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return value;
  return new Date(`${value}-01T12:00:00`).toLocaleDateString("pt-AO", {
    month: "short",
    year: "2-digit",
  });
}

function formatSeriesDate(value) {
  if (typeof value !== "string") return value;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-AO", { day: "2-digit", month: "short" });
}

function statusLabel(value) {
  const labels = {
    PENDING: "Pendente",
    VERIFIED: "Verificado",
    REJECTED: "Rejeitado",
    SUSPENDED: "Suspenso",
  };
  return labels[value] ?? value ?? "Actualizado";
}

function ChartTooltip({ active, payload, label, valueName }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.chartTooltip}>
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.dataKey}>
          {item.name ?? valueName}: {formatDecimal(item.value)}
        </span>
      ))}
    </div>
  );
}

function Sidebar({ activeSection, onNavigate, onLogout, isLoggingOut, logoutError, isOpen, onClose }) {
  return (
    <>
      {isOpen && <button className={styles.backdrop} type="button" aria-label="Fechar menu" onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`} aria-label="Menu administrativo">
        <NavLink className={styles.brand} to="/" onClick={onClose}>
          <span className={styles.brandMark} aria-hidden="true">C</span>
          <span className={styles.brandText}>
            <strong>Conect<span>Services</span></strong>
            <small>Administração</small>
          </span>
        </NavLink>

        <div className={styles.adminCard}>
          <span className={styles.adminAvatar}><ShieldCheck size={18} aria-hidden="true" /></span>
          <span>
            <strong>Administrador</strong>
            <small>Área protegida</small>
          </span>
          <span className={styles.onlineDot} aria-label="Sessão activa" />
        </div>

        <p className={styles.navCaption}>MENU PRINCIPAL</p>
        <nav className={styles.nav}>
          {navigation.map(({ label, path, icon: Icon, section }) => (
            <NavLink
              key={section}
              to={path}
              end={section === "dashboard"}
              onClick={onNavigate}
              className={`${styles.navItem} ${activeSection === section ? styles.navItemActive : ""}`}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
              {section === "dashboard" && <span className={styles.navAccent} aria-hidden="true" />}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.helpCard}>
            <span className={styles.helpIcon}><CircleHelp size={17} aria-hidden="true" /></span>
            <div>
              <strong>Precisa de ajuda?</strong>
              <small>Consulte a área de suporte</small>
            </div>
          </div>
          {logoutError && <p className={styles.logoutError} role="alert">{logoutError}</p>}
          <button className={styles.logoutButton} type="button" onClick={onLogout} disabled={isLoggingOut}>
            <LogOut size={18} aria-hidden="true" />
            <span>{isLoggingOut ? "A terminar sessão…" : "Terminar sessão"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function StatCard({ label, value, note, icon: Icon, tone }) {
  return (
    <article className={styles.statCard}>
      <div className={`${styles.statIcon} ${styles[tone]}`}>
        <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <span className={styles.statLabel}>{label}</span>
      <strong className={styles.statValue}>{formatNumber(value)}</strong>
      <span className={styles.statNote}>{note}</span>
      <ArrowDownRight className={`${styles.statArrow} ${styles[tone]}`} size={18} aria-hidden="true" />
    </article>
  );
}

function CardHeading({ eyebrow, title, action }) {
  return (
    <div className={styles.cardHeading}>
      <div>
        {eyebrow && <p className={styles.cardEyebrow}>{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function PeriodAnalysis({ comparison, categories }) {
  const metrics = Object.entries(comparison.metrics).map(([key, result]) => ({
    key,
    ...result,
    label: metricLabels[key],
    average: result.current / comparison.period_days,
    icon: metricIcons[key],
  }));
  const largestIncrease = metrics
    .filter((metric) => metric.change > 0)
    .sort((left, right) => right.change - left.change)[0];
  const largestDecrease = metrics
    .filter((metric) => metric.change < 0)
    .sort((left, right) => left.change - right.change)[0];
  const leadingCategory = categories[0];

  return (
    <section className={styles.analysisSection} aria-labelledby="analysis-title">
      <div className={styles.analysisHeading}>
        <div>
          <p className={styles.cardEyebrow}>ANÁLISE DE DESEMPENHO</p>
          <h2 id="analysis-title">Comparação entre períodos</h2>
          <p>Últimos {comparison.period_days} dias face aos {comparison.period_days} dias anteriores</p>
        </div>
        <span className={styles.analysisRange}>
          {formatDate(comparison.current_start, { day: "2-digit", month: "short" })}
          {" — "}
          {formatDate(comparison.current_end, { day: "2-digit", month: "short" })}
        </span>
      </div>

      <div className={styles.comparisonGrid}>
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const percent = metric.change_percent;
          const trendClass = metric.change > 0
            ? styles.trendUp
            : metric.change < 0
              ? styles.trendDown
              : styles.trendFlat;
          return (
            <article className={styles.comparisonCard} key={metric.key}>
              <span className={styles.comparisonIcon}><Icon size={16} aria-hidden="true" /></span>
              <span className={styles.comparisonLabel}>{metric.label}</span>
              <strong className={styles.comparisonValue}>{formatNumber(metric.current)}</strong>
              <span className={styles.comparisonAverage}>
                {formatNumber(Number(metric.average.toFixed(1)))} por dia
              </span>
              <span className={`${styles.comparisonChange} ${trendClass}`}>
                {metric.change > 0 ? "+" : ""}{formatNumber(metric.change)}
                {percent === null ? " · sem período anterior" : ` · ${percent > 0 ? "+" : ""}${formatNumber(percent)}%`}
              </span>
              <span className={styles.comparisonPrevious}>
                anterior: {formatNumber(metric.previous)}
              </span>
            </article>
          );
        })}
      </div>

      <div className={styles.insightGrid} aria-label="Principais conclusões">
        <article className={styles.insightCard}>
          <span className={styles.insightMarker}><TrendingUp size={16} aria-hidden="true" /></span>
          <div>
            <span className={styles.insightLabel}>Maior aumento em volume</span>
            <strong>{largestIncrease ? largestIncrease.label : "Sem aumentos neste período"}</strong>
            <small>
              {largestIncrease
                ? `+${formatNumber(largestIncrease.change)} face ao período anterior`
                : "Os indicadores não registaram crescimento"}
            </small>
          </div>
        </article>
        <article className={styles.insightCard}>
          <span className={`${styles.insightMarker} ${styles.insightMarkerAlt}`}><ArrowDownRight size={16} aria-hidden="true" /></span>
          <div>
            <span className={styles.insightLabel}>Maior redução em volume</span>
            <strong>{largestDecrease ? largestDecrease.label : "Sem reduções neste período"}</strong>
            <small>
              {largestDecrease
                ? `${formatNumber(largestDecrease.change)} face ao período anterior`
                : "Os indicadores não registaram redução"}
            </small>
          </div>
        </article>
        <article className={styles.insightCard}>
          <span className={`${styles.insightMarker} ${styles.insightMarkerCategory}`}><Star size={16} aria-hidden="true" /></span>
          <div>
            <span className={styles.insightLabel}>Categoria com mais serviços</span>
            <strong>{leadingCategory?.name ?? "Sem dados de categorias"}</strong>
            <small>
              {leadingCategory
                ? `${formatNumber(leadingCategory.total)} serviços · ${formatNumber(leadingCategory.percentage)}% do total`
                : "Não existem serviços activos por categoria"}
            </small>
          </div>
        </article>
      </div>
      <p className={styles.analysisNote}>
        As variações comparam contagens registadas; não representam previsões nem estabelecem causalidade.
      </p>
    </section>
  );
}

function StatisticalAnalysis({ analysis, selectedMetric, onSelectMetric }) {
  const directionLabels = {
    increasing: "A aumentar",
    decreasing: "A diminuir",
    stable: "Estável",
  };

  return (
    <section className={styles.statisticalSection} aria-labelledby="statistical-analysis-title">
      <div className={styles.analysisHeading}>
        <div>
          <p className={styles.cardEyebrow}>CIÊNCIA DE DADOS · PANDAS</p>
          <h2 id="statistical-analysis-title">Tendência e variabilidade</h2>
          <p>Estatísticas descritivas das contagens diárias no período seleccionado.</p>
        </div>
        <span className={styles.analysisRange}>
          Regressão linear · {analysis.rolling_window_days} dias
        </span>
      </div>
      <div className={styles.statisticalGrid}>
        {Object.entries(analysis.metrics).map(([key, result]) => (
          <button
            className={`${styles.statisticalCard} ${selectedMetric === key ? styles.statisticalCardSelected : ""}`}
            type="button"
            key={key}
            aria-pressed={selectedMetric === key}
            aria-label={`${metricLabels[key]}: seleccionar no gráfico`}
            onClick={() => onSelectMetric(key)}
          >
            <strong className={styles.statisticalTitle}>{metricLabels[key]}</strong>
            <span>Média diária <strong>{formatDecimal(result.daily_average)}</strong></span>
            <span>Desvio padrão amostral <strong>{formatDecimal(result.daily_standard_deviation)}</strong></span>
            <span>Tendência <strong>{directionLabels[result.trend_direction]}</strong></span>
            <span>Declive por dia <strong>{formatDecimal(result.trend_per_day)}</strong></span>
            <span>R² <strong>{formatDecimal(result.r_squared)}</strong></span>
          </button>
        ))}
      </div>
      <p className={styles.analysisNote}>
        O gráfico compara valores diários com a média móvel de {analysis.rolling_window_days} dias.
        A média móvel só aparece após completar a janela.
        O desvio padrão é amostral; R² não está disponível quando a série não varia.
        A tendência é descritiva, não constitui previsão nem demonstra causalidade.
      </p>
    </section>
  );
}

function UserGrowthChart({ data, metric }) {
  if (!data.length) {
    return <p className={styles.emptyState}>Não há actividade registada neste período.</p>;
  }

  return (
    <>
      <div className={styles.chartCanvas} role="img" aria-label={`${metricLabels[metric]} por dia e média móvel de 7 dias`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#24364d" strokeDasharray="4 5" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatSeriesDate} interval="preserveStartEnd" minTickGap={26} tick={{ fill: "#8292a8", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals tick={{ fill: "#8292a8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip valueName={metricLabels[metric].toLocaleLowerCase("pt-AO")} />} cursor={{ stroke: "#354a64" }} />
            <Line
              type="monotone"
              dataKey={metric}
              name="Diário"
              stroke="#4c8dff"
              strokeWidth={2}
              dot={{ fill: "#0d1b2c", stroke: "#69a3ff", strokeWidth: 2, r: 3 }}
              activeDot={{ fill: "#69a3ff", stroke: "#0d1b2c", strokeWidth: 3, r: 5 }}
            />
            <Line
              type="monotone"
              dataKey={`${metric}_average_7d`}
              name="Média móvel (7 dias)"
              stroke="#24c9d8"
              strokeWidth={2}
              dot={false}
              activeDot={{ fill: "#54dce7", stroke: "#0d1b2c", strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.chartLegend} aria-label="Legenda do gráfico">
        <span><i className={styles.legendDaily} aria-hidden="true" />Diário</span>
        <span><i className={styles.legendAverage} aria-hidden="true" />Média móvel (7 dias)</span>
      </div>
    </>
  );
}

function BusinessGrowthChart({ data }) {
  if (!data.length) {
    return (
      <div className={styles.chartEmpty}>
        <span className={styles.chartEmptyIcon}><Building2 size={20} aria-hidden="true" /></span>
        <strong>Dados de crescimento indisponíveis</strong>
        <p>A API actual não fornece uma série histórica de empresas registadas.</p>
      </div>
    );
  }

  return (
    <div className={styles.chartCanvas} role="img" aria-label="Crescimento mensal das empresas">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#24364d" strokeDasharray="4 5" vertical={false} />
          <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: "#8292a8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "#8292a8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip valueName="empresas" />} cursor={{ stroke: "#354a64" }} />
          <Line
            type="monotone"
            dataKey="businesses"
            name="Empresas"
            stroke="#24c9d8"
            strokeWidth={3}
            dot={{ fill: "#0d1b2c", stroke: "#54dce7", strokeWidth: 2, r: 4 }}
            activeDot={{ fill: "#54dce7", stroke: "#0d1b2c", strokeWidth: 3, r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryChart({ categories }) {
  if (!categories.length) {
    return <p className={styles.emptyState}>Não há serviços activos distribuídos por categorias.</p>;
  }
  return (
    <div className={styles.categoryLayout}>
      <div className={styles.donutCanvas} role="img" aria-label="Distribuição dos serviços por categoria">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categories}
              dataKey="total"
              nameKey="name"
              innerRadius="66%"
              outerRadius="91%"
              paddingAngle={3}
              stroke="none"
            >
              {categories.map((category, index) => (
                <Cell key={category.id ?? category.name} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatNumber(value), name]}
              contentStyle={{
                backgroundColor: "#102238",
                border: "1px solid #2d4561",
                borderRadius: "8px",
                color: "#e5edf7",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.donutTotal}>
          <strong>{formatNumber(categories.reduce((sum, item) => sum + item.total, 0))}</strong>
          <span>serviços</span>
        </div>
      </div>
      <ul className={styles.categoryLegend}>
        {categories.map((category, index) => (
          <li key={category.id ?? category.name}>
            <span className={styles.legendDot} style={{ backgroundColor: chartColors[index % chartColors.length] }} />
            <span className={styles.legendName}>{category.name}</span>
            <strong>{formatNumber(category.total)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FunnelTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const stage = payload[0].payload;
  return (
    <div className={styles.chartTooltip}>
      <strong>{stage.name}</strong>
      <span>{formatNumber(stage.count)} pedidos</span>
      {stage.conversion_from_previous !== null && (
        <span>{formatDecimal(stage.conversion_from_previous)}% da etapa anterior</span>
      )}
    </div>
  );
}

function ServiceOrderFunnel({ funnel }) {
  if (funnel.stages[0]?.count === 0) {
    return (
      <div className={styles.chartEmpty}>
        <span className={styles.chartEmptyIcon}><ShoppingBag size={20} aria-hidden="true" /></span>
        <strong>Sem pedidos no período seleccionado</strong>
        <p>Não há dados para calcular as conversões desta coorte.</p>
      </div>
    );
  }

  return (
    <div className={styles.funnelLayout}>
      <div className={styles.funnelCanvas} role="img" aria-label="Funil de conversão dos pedidos de serviço">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={funnel.stages}
            layout="vertical"
            margin={{ top: 4, right: 34, bottom: 4, left: 0 }}
          >
            <CartesianGrid stroke="#24364d" strokeDasharray="4 5" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: "#8292a8", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={112}
              interval={0}
              tick={{ fill: "#a4b3c5", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<FunnelTooltip />} cursor={{ fill: "rgb(76 141 255 / 8%)" }} />
            <Bar dataKey="count" name="Pedidos" radius={[0, 5, 5, 0]} minPointSize={2}>
              {funnel.stages.map((stage, index) => (
                <Cell key={stage.key} fill={chartColors[index]} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                formatter={formatNumber}
                fill="#dce6f2"
                fontSize={10}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.funnelConversions}>
        <strong>Conversão face à etapa anterior</strong>
        {funnel.stages.slice(1).map((stage) => (
          <div className={styles.funnelConversion} key={stage.key}>
            <span>{stage.name}</span>
            <strong>
              {stage.conversion_from_previous === null
                ? "N/D"
                : `${formatDecimal(stage.conversion_from_previous)}%`}
            </strong>
          </div>
        ))}
        <p>
          Coorte: {formatDate(funnel.cohort_start, { day: "2-digit", month: "short" })}
          {" — "}
          {formatDate(funnel.cohort_end, { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      </div>
      <p className={styles.funnelNote}>
        As etapas contam pedidos criados no período; propostas e contratações reflectem o estado actual desses pedidos.
      </p>
    </div>
  );
}

function ApprovalQueue({ data, onOpenProviders }) {
  const queues = [
    {
      label: "Empresas",
      description: "Empresas pendentes de verificação",
      count: data.summary.business_verifications_pending,
      icon: Building2,
    },
    {
      label: "Prestadores",
      description: "Verificação de identidade e perfil",
      count: data.summary.verifications_pending,
      icon: FileCheck2,
      action: onOpenProviders,
    },
    {
      label: "Serviços inactivos",
      description: "Não publicados; podem ser rascunhos",
      count: data.summary.inactive_services,
      icon: ClipboardList,
    },
    {
      label: "Denúncias",
      description: "Ocorrências reportadas na plataforma",
      count: null,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className={styles.approvalList}>
      {queues.map(({ label, description, count, icon: Icon, action }) => (
        <div className={styles.approvalRow} key={label}>
          <span className={styles.approvalIcon}><Icon size={17} aria-hidden="true" /></span>
          <span className={styles.approvalText}>
            <strong>{label}</strong>
            <small>{description}</small>
          </span>
          <span className={count === null ? styles.notAvailable : styles.approvalCount}>
            {count === null ? "N/D" : formatNumber(count)}
          </span>
          {action && (
            <button type="button" className={styles.rowAction} onClick={action} aria-label="Abrir verificações de prestadores">
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      <p className={styles.dataNote}>Denúncias: indisponíveis porque ainda não existe um modelo de denúncias no backend. Serviços inactivos não são necessariamente pedidos de aprovação.</p>
    </div>
  );
}

function UsersTable({ users, search, onOpenUsers }) {
  const filteredUsers = users.filter((user) => {
    const query = search.trim().toLocaleLowerCase("pt-AO");
    if (!query) return true;
    return [user.name, user.full_name, user.email].some((value) =>
      String(value ?? "").toLocaleLowerCase("pt-AO").includes(query),
    );
  });

  return (
    <section className={styles.panel}>
      <CardHeading
        eyebrow="Contas recentes"
        title="Utilizadores"
        action={<button className={styles.textLink} type="button" onClick={onOpenUsers}>Abrir gestão <ArrowRight size={15} /></button>}
      />
      {filteredUsers.length ? (
        <div className={styles.tableScroll}>
          <table className={styles.usersTable}>
            <thead>
              <tr>
                <th scope="col">Nome / conta</th>
                <th scope="col">Email</th>
                <th scope="col">Tipo de conta</th>
                <th scope="col">Data de registo</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const name = user.name || user.full_name || user.email || "Conta sem email";
                return (
                  <tr key={user.id}>
                    <td>
                      <span className={styles.personCell}>
                        <span className={styles.personAvatar}>{String(name).slice(0, 1).toUpperCase()}</span>
                        <span><strong>{name}</strong><small>#{user.id}</small></span>
                      </span>
                    </td>
                    <td>{user.email || "—"}</td>
                    <td><span className={styles.accountType}>{user.staff ? "Administrador" : "Utilizador"}</span></td>
                    <td>{formatDate(user.created_at)}</td>
                    <td><span className={user.active ? styles.statusActive : styles.statusInactive}>{user.active ? "Activo" : "Inactivo"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.emptyState}>
          {users.length ? "Nenhuma conta recente corresponde à pesquisa." : "Ainda não existem utilizadores registados."}
        </p>
      )}
      <p className={styles.dataNote}>A API fornece as seis contas registadas mais recentemente. Para gerir todas, abre a gestão completa.</p>
    </section>
  );
}

function RecentActivity({ events }) {
  return (
    <section className={styles.panel}>
      <CardHeading eyebrow="Últimos acontecimentos" title="Actividade recente" />
      {events.length ? (
        <ul className={styles.activityList}>
          {events.map((event) => (
            <li key={event.id}>
              <span className={styles.activityIcon}><Activity size={15} aria-hidden="true" /></span>
              <span className={styles.activityCopy}>
                <strong>{event.provider_name || "Verificação de prestador"}</strong>
                <small>
                  {event.previous_status
                    ? `${statusLabel(event.previous_status)} → ${statusLabel(event.new_status)}`
                    : `Estado actualizado: ${statusLabel(event.new_status)}`}
                  {event.actor ? ` · por ${event.actor}` : ""}
                </small>
              </span>
              <time dateTime={event.created_at}>{formatDate(event.created_at, { day: "2-digit", month: "short" })}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyState}>Ainda não há actividade de verificação registada.</p>
      )}
    </section>
  );
}

function PendingProviders({ providers, onOpenProviders }) {
  return (
    <section className={styles.panel}>
      <CardHeading
        eyebrow="Revisão necessária"
        title="Verificações pendentes"
        action={<button className={styles.textLink} type="button" onClick={onOpenProviders}>Ver todas <ArrowRight size={15} /></button>}
      />
      {providers.length ? (
        <ul className={styles.pendingList}>
          {providers.map((provider) => (
            <li key={provider.id}>
              <span className={styles.pendingAvatar}><UserRound size={17} aria-hidden="true" /></span>
              <span className={styles.pendingPerson}>
                <strong>{provider.name || "Prestador"}</strong>
                <small>Submetido a {formatDate(provider.submitted_at)}</small>
              </span>
              <span className={styles.pendingBadge}>Pendente</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.allClear}>
          <CheckCircle2 size={19} aria-hidden="true" />
          <span>Não há verificações submetidas pendentes.</span>
        </div>
      )}
    </section>
  );
}

function PendingBusinesses({ businesses, onOpenBusinesses }) {
  return (
    <section className={styles.panel}>
      <CardHeading
        eyebrow="Empresas e PMEs"
        title="Verificações pendentes"
        action={<button className={styles.textLink} type="button" onClick={onOpenBusinesses}>Ver todas <ArrowRight size={15} /></button>}
      />
      {businesses.length ? (
        <ul className={styles.pendingList}>
          {businesses.map((business) => (
            <li key={business.id}>
              <span className={styles.pendingAvatar}><Building2 size={17} aria-hidden="true" /></span>
              <span className={styles.pendingPerson}>
                <strong>{business.registered_name || business.name}</strong>
                <small>{business.email} · submetida a {formatDate(business.submitted_at)}</small>
              </span>
              <span className={styles.pendingBadge}>Pendente</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.allClear}>
          <CheckCircle2 size={19} aria-hidden="true" />
          <span>Não há empresas com verificações submetidas pendentes.</span>
        </div>
      )}
    </section>
  );
}

function InactiveServices({ services, onOpenServices }) {
  return (
    <section className={styles.panel}>
      <CardHeading
        eyebrow="Catálogo"
        title="Serviços inactivos"
        action={<button className={styles.textLink} type="button" onClick={onOpenServices}>Abrir catálogo <ArrowRight size={15} /></button>}
      />
      {services.length ? (
        <ul className={styles.pendingList}>
          {services.map((service) => (
            <li key={service.id}>
              <span className={styles.pendingAvatar}><ClipboardList size={17} aria-hidden="true" /></span>
              <span className={styles.pendingPerson}>
                <strong>{service.name}</strong>
                <small>{service.provider_name} · criado a {formatDate(service.created_at)}</small>
              </span>
              <span className={styles.notAvailable}>Inactivo</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyState}>Não há serviços inactivos registados.</p>
      )}
      <p className={styles.dataNote}>O modelo não distingue rascunhos de serviços que aguardam aprovação.</p>
    </section>
  );
}

function SectionWorkspace({ section, data, search, onOpenUsers, onOpenProviders }) {
  if (section === "users") {
    return <UsersTable users={data.recent_users} search={search} onOpenUsers={onOpenUsers} />;
  }
  if (section === "providers") {
    return (
      <div className={styles.sectionStack}>
        <div className={styles.sectionSummary}>
          <span className={styles.statIcon}><UserRound size={20} aria-hidden="true" /></span>
          <div><small>Prestadores registados</small><strong>{formatNumber(data.summary.providers_total)}</strong></div>
          <span className={styles.summaryDivider} />
          <div><small>Verificações pendentes</small><strong>{formatNumber(data.summary.verifications_pending)}</strong></div>
        </div>
        <PendingProviders providers={data.pending_verifications} onOpenProviders={onOpenProviders} />
        <RecentActivity events={data.recent_activity} />
      </div>
    );
  }
  if (section === "services") {
    return (
      <div className={styles.sectionStack}>
        <div className={styles.sectionSummary}>
          <span className={styles.statIcon}><ClipboardList size={20} aria-hidden="true" /></span>
          <div><small>Serviços publicados</small><strong>{formatNumber(data.summary.services_total)}</strong></div>
        </div>
        <section className={styles.panel}>
          <CardHeading eyebrow="Catálogo activo" title="Distribuição por categoria" />
          <CategoryChart categories={data.services_by_category} />
        </section>
        <InactiveServices services={data.inactive_services} onOpenServices={() => window.location.assign(djangoAdminPaths.services)} />
      </div>
    );
  }

  const details = {
    businesses: {
      title: "Empresas / PMEs",
      description: "Visão geral das empresas registadas na plataforma.",
      value: data.summary.businesses_total,
      label: "Empresas registadas",
      icon: Building2,
      integration: "O painel não recebe uma lista de empresas pendentes de aprovação.",
    },
    orders: {
      title: "Pedidos",
      description: "Volume actual de pedidos e encomendas registados.",
      value: data.summary.service_orders_total + data.summary.product_orders_total,
      label: "Pedidos e encomendas",
      icon: ShoppingBag,
      integration: "A API do painel não fornece uma tabela de pedidos recentes.",
    },
    reviews: {
      title: "Avaliações",
      description: "A gestão de avaliações ainda não está disponível nesta API de painel.",
      value: null,
      label: "Dados não disponíveis",
      icon: Star,
      integration: "A API actual não disponibiliza métricas ou uma lista de avaliações.",
    },
    reports: {
      title: "Relatórios",
      description: "Relatórios e exportações administrativas.",
      value: null,
      label: "Não disponível",
      icon: TrendingUp,
      integration: "O backend indica que os relatórios ainda não estão disponíveis.",
    },
    settings: {
      title: "Configurações",
      description: "Preferências e controlos da área administrativa.",
      value: null,
      label: "Gestão no Django Admin",
      icon: Settings,
      integration: "As configurações e permissões são geridas no backend Django.",
    },
    support: {
      title: "Suporte",
      description: "Acompanhamento de ocorrências e pedidos de ajuda.",
      value: null,
      label: "Integração necessária",
      icon: LifeBuoy,
      integration: "A API actual não disponibiliza uma fila de suporte ou denúncias.",
    },
  };
  const detail = details[section] ?? details.businesses;
  const Icon = detail.icon;
  const adminPath = djangoAdminPaths[section];

  return (
    <div className={styles.sectionStack}>
      <section className={`${styles.panel} ${styles.sectionHero}`}>
        <span className={styles.sectionHeroIcon}><Icon size={23} aria-hidden="true" /></span>
        <div>
          <p className={styles.cardEyebrow}>ÁREA ADMINISTRATIVA</p>
          <h2>{detail.title}</h2>
          <p>{detail.description}</p>
        </div>
        {detail.value === null ? (
          <span className={styles.integrationBadge}>{detail.label}</span>
        ) : (
          <span className={styles.sectionMetricBlock}>
            <small>{detail.label}</small>
            <strong className={styles.sectionMetric}>{formatNumber(detail.value)}</strong>
          </span>
        )}
      </section>
      <IntegrationNotice text={detail.integration} />
      {adminPath && (
        <a className={styles.adminLink} href={adminPath}>
          Abrir gestão no Django Admin <ArrowRight size={16} aria-hidden="true" />
        </a>
      )}
      {section === "businesses" && (
        <>
          <section className={styles.panel}>
            <CardHeading eyebrow="Crescimento" title="Empresas ao longo do tempo" />
            <BusinessGrowthChart data={data.business_growth} />
          </section>
          <PendingBusinesses
            businesses={data.pending_businesses}
            onOpenBusinesses={() => window.location.assign(djangoAdminPaths.businesses)}
          />
        </>
      )}
    </div>
  );
}

function IntegrationNotice({ text }) {
  return (
    <div className={styles.integrationNotice}>
      <CircleHelp size={17} aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

export default function AdministracaoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialDashboard = location.state?.adminDashboard;
  const [data, setData] = useState(initialDashboard ?? null);
  const [loadError, setLoadError] = useState("");
  const [noPermission, setNoPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialDashboard);
  const [refreshKey, setRefreshKey] = useState(0);
  const [period, setPeriod] = useState(initialDashboard?.analytics?.period_days ?? 30);
  const [metric, setMetric] = useState("registrations");
  const [search, setSearch] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const requestedSection = new URLSearchParams(location.search).get("section");
  const activeSection = navigation.some(({ section }) => section === requestedSection)
    ? requestedSection
    : "dashboard";
  const activePage = navigation.find(({ section }) => section === activeSection) ?? navigation[0];
  const isDashboard = activeSection === "dashboard";
  const businessGrowth = useMemo(
    () => (Array.isArray(data?.business_growth) ? data.business_growth : []),
    [data],
  );

  useEffect(() => {
    let active = true;
    if (initialDashboard && refreshKey === 0 && period === initialDashboard.analytics?.period_days) {
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    setIsLoading(true);
    setLoadError("");
    setNoPermission(false);

    requisitarJson(`/api/auth/admin/dashboard?period=${period}`)
      .then(validateDashboardData)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiRequestError && error.status === 401) {
          navigate("/entrar?next=%2Fadmin", { replace: true });
          return;
        }
        if (error instanceof ApiRequestError && error.status === 403) {
          setNoPermission(true);
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os dados do painel.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [navigate, period, refreshKey]);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError("");
    try {
      await requisitarJson("/api/auth/logout/", { method: "POST" });
      navigate("/", { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Não foi possível terminar a sessão.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  function openDjangoAdmin(section) {
    const path = djangoAdminPaths[section];
    if (path) window.location.assign(path);
  }

  const currentTitle = isDashboard ? "Visão geral" : activePage.label;

  return (
    <main className={styles.page}>
      <Sidebar
        activeSection={activeSection}
        onNavigate={() => setIsMenuOpen(false)}
        onLogout={() => void handleLogout()}
        isLoggingOut={isLoggingOut}
        logoutError={logoutError}
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />
      <div className={styles.mainPanel}>
        <header className={styles.topbar}>
          <button className={styles.menuButton} type="button" aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen((open) => !open)}>
            {isMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
          <div className={styles.heading}>
            <p className={styles.breadcrumb}>Conect Services <span>/</span> Administração</p>
            <h1>{currentTitle}</h1>
          </div>
          <label className={styles.searchBox}>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                if (!["dashboard", "users"].includes(activeSection)) {
                  navigate("/admin?section=users");
                }
              }}
              placeholder="Pesquisar utilizadores"
              aria-label="Pesquisar utilizadores recentes"
            />
          </label>
          <button
            className={styles.notificationButton}
            type="button"
            onClick={() => navigate("/admin?section=providers")}
            aria-label={`${formatNumber(data?.summary?.verifications_pending ?? 0)} verificações pendentes; abrir prestadores`}
          >
            <Bell size={19} aria-hidden="true" />
            {!!data?.summary?.verifications_pending && <span className={styles.notificationBadge}>{data.summary.verifications_pending}</span>}
          </button>
          <div className={styles.profileChip}>
            <span className={styles.profileAvatar}>A</span>
            <span><strong>Admin</strong><small>Administrador</small></span>
          </div>
        </header>

        <section className={styles.content}>
          {isLoading ? (
            <div className={styles.loadingState} role="status"><span className={styles.spinner} />A carregar dados da plataforma…</div>
          ) : noPermission ? (
            <section className={styles.feedback} role="alert">
              <span className={styles.feedbackIcon}><ShieldCheck size={22} aria-hidden="true" /></span>
              <h2>Acesso restrito</h2>
              <p>Esta área só está disponível para administradores. A autorização é validada pelo Django.</p>
              <button className={styles.primaryButton} type="button" onClick={() => navigate("/", { replace: true })}>Voltar ao início</button>
            </section>
          ) : loadError ? (
            <section className={styles.feedback} role="alert">
              <span className={styles.feedbackIcon}><CircleHelp size={22} aria-hidden="true" /></span>
              <h2>Não foi possível carregar o painel</h2>
              <p>{loadError}</p>
              <button className={styles.primaryButton} type="button" onClick={() => setRefreshKey((key) => key + 1)}>Tentar novamente</button>
            </section>
          ) : data ? (
            isDashboard ? (
              <>
                <div className={styles.welcomeRow}>
                  <div>
                    <h2>Bem-vindo à administração <span aria-hidden="true">✦</span></h2>
                    <p>Acompanhe os principais indicadores da plataforma.</p>
                  </div>
                  <div className={styles.headerActions}>
                    <label className={styles.periodSelect}>
                      <span>Período</span>
                      <select value={period} onChange={(event) => setPeriod(Number(event.target.value))} aria-label="Período dos gráficos">
                        <option value={7}>7 dias</option>
                        <option value={30}>30 dias</option>
                        <option value={90}>90 dias</option>
                      </select>
                    </label>
                    <button className={styles.refreshButton} type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={isLoading}>
                      <Activity size={16} aria-hidden="true" /> Actualizar
                    </button>
                  </div>
                </div>

                <section className={styles.statsGrid} aria-label="Indicadores da plataforma">
                  <StatCard label="Total de utilizadores" value={data.summary.users_total} note={`${formatNumber(data.summary.new_users_30d)} novos nos últimos 30 dias`} icon={Users} tone="blue" />
                  <StatCard label="Empresas registadas" value={data.summary.businesses_total} note="Contas empresariais" icon={Building2} tone="cyan" />
                  <StatCard label="Prestadores de serviços" value={data.summary.providers_total} note="Contas activas" icon={UserRound} tone="violet" />
                  <StatCard label="Serviços publicados" value={data.summary.services_total} note="Publicações activas" icon={ClipboardList} tone="amber" />
                </section>
                <section className={styles.secondaryStats} aria-label="Outros indicadores">
                  {[
                    { label: "Produtos", value: data.summary.products_total },
                    { label: "Pedidos de serviço", value: data.summary.service_orders_total },
                    { label: "Encomendas", value: data.summary.product_orders_total },
                    { label: "Conversas", value: data.summary.conversations_total },
                    { label: "Visualizações", value: data.summary.views_total },
                    { label: "Verificações pendentes", value: data.summary.verifications_pending },
                  ].map(({ label, value }) => (
                    <div className={styles.secondaryStat} key={label}>
                      <span>{label}</span>
                      <strong>{formatNumber(value)}</strong>
                    </div>
                  ))}
                </section>
                <PeriodAnalysis
                  comparison={data.period_comparison}
                  categories={data.services_by_category}
                />
                <StatisticalAnalysis
                  analysis={data.analytics.analysis}
                  selectedMetric={metric}
                  onSelectMetric={setMetric}
                />

                <section className={styles.chartsGrid} aria-label="Gráficos da plataforma">
                  <article className={styles.panel}>
                    <CardHeading
                      eyebrow={`Últimos ${period} dias · ${formatNumber(data.analytics.summary[metric])} no período`}
                      title={metric === "registrations" ? "Crescimento de utilizadores" : metricLabels[metric]}
                      action={(
                        <label className={styles.chartSelect}>
                          <span className={styles.srOnly}>Métrica do gráfico</span>
                          <select value={metric} onChange={(event) => setMetric(event.target.value)} aria-label="Métrica do gráfico">
                            {Object.entries(metricLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
                          </select>
                        </label>
                      )}
                    />
                    <UserGrowthChart data={data.analytics.series} metric={metric} />
                  </article>
                  <article className={styles.panel}>
                    <CardHeading eyebrow="Empresas / PMEs" title="Crescimento de empresas" />
                    <BusinessGrowthChart data={businessGrowth} />
                  </article>
                  <article className={`${styles.panel} ${styles.categoryPanel}`}>
                    <CardHeading eyebrow="Serviços activos" title="Categorias de serviços" />
                    <CategoryChart categories={data.services_by_category} />
                  </article>
                  <article className={`${styles.panel} ${styles.funnelPanel}`}>
                    <CardHeading
                      eyebrow={`Pedidos criados nos últimos ${period} dias`}
                      title="Funil de conversão de pedidos de serviço"
                    />
                    <ServiceOrderFunnel funnel={data.service_order_funnel} />
                  </article>
                </section>

                <section className={styles.lowerGrid}>
                  <ApprovalQueue data={data} onOpenProviders={() => navigate("/admin?section=providers")} />
                  <PendingBusinesses
                    businesses={data.pending_businesses.slice(0, 4)}
                    onOpenBusinesses={() => openDjangoAdmin("businesses")}
                  />
                </section>
                <section className={styles.lowerGrid}>
                  <PendingProviders providers={data.pending_verifications.slice(0, 4)} onOpenProviders={() => openDjangoAdmin("providers")} />
                  <InactiveServices services={data.inactive_services.slice(0, 4)} onOpenServices={() => openDjangoAdmin("services")} />
                </section>
                <section className={styles.lowerGrid}>
                  <UsersTable users={data.recent_users} search={search} onOpenUsers={() => openDjangoAdmin("users")} />
                  <RecentActivity events={data.recent_activity.slice(0, 5)} />
                </section>
                <p className={styles.dataFootnote}>
                  <ShieldCheck size={14} aria-hidden="true" />
                  Dados carregados da API administrativa do Django. Acesso e permissões são validados no backend.
                </p>
              </>
            ) : (
              <SectionWorkspace
                section={activeSection}
                data={data}
                search={search}
                onOpenUsers={() => openDjangoAdmin("users")}
                onOpenProviders={() => openDjangoAdmin("providers")}
              />
            )
          ) : null}
        </section>
      </div>
    </main>
  );
}
