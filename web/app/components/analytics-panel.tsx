"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Eye,
  MessageCircle,
  PackageCheck,
  Send,
  ShoppingBag,
} from "lucide-react";
import styles from "./analytics-panel.module.css";

type MetricKey =
  | "views"
  | "publications"
  | "service_orders"
  | "proposals"
  | "conversations"
  | "product_orders";

type AnalyticsData = {
  period_days: number;
  publications_total: number;
  summary: Record<MetricKey, number>;
  series: Array<Record<MetricKey, number> & { date: string }>;
};

const metricas: Array<{
  key: MetricKey;
  label: string;
  icon: typeof Eye;
}> = [
  { key: "views", label: "Visualizações", icon: Eye },
  { key: "publications", label: "Novas publicações", icon: ClipboardList },
  { key: "service_orders", label: "Pedidos de serviço", icon: ShoppingBag },
  { key: "proposals", label: "Propostas", icon: Send },
  { key: "conversations", label: "Conversas", icon: MessageCircle },
  { key: "product_orders", label: "Encomendas", icon: PackageCheck },
];

const diasPermitidos = [7, 30, 90] as const;

function dataCurta(data: string) {
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-AO", {
    day: "2-digit",
    month: "short",
  });
}

export default function AnalyticsPanel() {
  const [period, setPeriod] = useState<(typeof diasPermitidos)[number]>(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [metric, setMetric] = useState<MetricKey>("views");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/auth/analytics?period=${period}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) {
          const detail =
            payload && typeof payload === "object" && "detail" in payload
              ? String(payload.detail)
              : "Não foi possível carregar a análise.";
          throw new Error(detail);
        }
        setData(payload as AnalyticsData);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar a análise.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [period]);

  const chart = useMemo(() => {
    const rows = data?.series ?? [];
    const max = Math.max(1, ...rows.map((row) => row[metric] ?? 0));
    return rows.map((row, index) => ({
      ...row,
      x: rows.length > 1 ? 24 + (index / (rows.length - 1)) * 552 : 300,
      y: 170 - ((row[metric] ?? 0) / max) * 132,
    }));
  }, [data, metric]);

  return (
    <section className={styles.panel} aria-labelledby="analytics-title">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Desempenho</p>
          <h2 id="analytics-title">Análise da atividade</h2>
          <p>Dados reais das publicações e interações com clientes.</p>
        </div>
        <label className={styles.period}>
          <span>Período</span>
          <select
            value={period}
            onChange={(event) => {
              setLoading(true);
              setError("");
              setPeriod(Number(event.target.value) as (typeof diasPermitidos)[number]);
            }}
          >
            {diasPermitidos.map((days) => (
              <option key={days} value={days}>
                Últimos {days} dias
              </option>
            ))}
          </select>
        </label>
      </header>

      {error ? (
        <p className={styles.error} role="alert">{error}</p>
      ) : (
        <>
          <div className={styles.metrics} aria-label={`Indicadores dos últimos ${period} dias`}>
            {[
              {
                label: "Publicações ativas",
                value: data?.publications_total,
                icon: ClipboardList,
              },
              ...metricas
                .filter((item) => item.key !== "publications")
                .map((item) => ({
                  label: item.label,
                  value: data?.summary[item.key],
                  icon: item.icon,
                })),
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article className={styles.metric} key={item.label}>
                  <span><Icon size={17} aria-hidden="true" /></span>
                  <small>{item.label}</small>
                  <strong>{loading ? "—" : (item.value ?? 0).toLocaleString("pt-AO")}</strong>
                </article>
              );
            })}
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div>
                <p className={styles.kicker}>Tendência diária</p>
                <h3>{metricas.find((item) => item.key === metric)?.label}</h3>
              </div>
              <label className={styles.chartSelect}>
                <span className={styles.visuallyHidden}>Métrica do gráfico</span>
                <select
                  value={metric}
                  onChange={(event) => setMetric(event.target.value as MetricKey)}
                >
                  {metricas.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
            </div>
            {loading ? (
              <p className={styles.chartFeedback} role="status">A carregar os dados…</p>
            ) : chart.length ? (
              <>
                <svg
                  className={styles.chart}
                  viewBox="0 0 600 196"
                  role="img"
                  aria-label={`${metricas.find((item) => item.key === metric)?.label} por dia`}
                >
                  {[38, 82, 126, 170].map((y) => (
                    <line key={y} x1="20" x2="580" y1={y} y2={y} className={styles.gridLine} />
                  ))}
                  <polyline
                    points={chart.map((point) => `${point.x},${point.y}`).join(" ")}
                    className={styles.line}
                  />
                  {chart.map((point) => (
                    <circle
                      key={point.date}
                      cx={point.x}
                      cy={point.y}
                      r="3"
                      className={styles.point}
                    >
                      <title>{`${dataCurta(point.date)}: ${point[metric] ?? 0}`}</title>
                    </circle>
                  ))}
                </svg>
                <div className={styles.chartLabels}>
                  <small>{chart[0] ? dataCurta(chart[0].date) : ""}</small>
                  <small>{chart[Math.floor(chart.length / 2)] ? dataCurta(chart[Math.floor(chart.length / 2)].date) : ""}</small>
                  <small>{chart[chart.length - 1] ? dataCurta(chart[chart.length - 1].date) : ""}</small>
                </div>
              </>
            ) : (
              <p className={styles.chartFeedback}>Ainda não há dados para este período.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
