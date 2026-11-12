"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Eye, MessageCircle, PackageCheck, Send, ShoppingBag, } from "lucide-react";
import styles from "./analytics-panel.module.css";
const metricas = [
    { key: "views", label: "Visualizações", icon: Eye },
    { key: "publications", label: "Novas publicações", icon: ClipboardList },
    { key: "service_orders", label: "Pedidos de serviço", icon: ShoppingBag },
    { key: "proposals", label: "Propostas", icon: Send },
    { key: "conversations", label: "Conversas", icon: MessageCircle },
    { key: "product_orders", label: "Encomendas", icon: PackageCheck },
];
const diasPermitidos = [7, 30, 90];
function dataCurta(data) {
    return new Date(`${data}T12:00:00`).toLocaleDateString("pt-AO", {
        day: "2-digit",
        month: "short",
    });
}
export default function AnalyticsPanel() {
    const [period, setPeriod] = useState(30);
    const [data, setData] = useState(null);
    const [metric, setMetric] = useState("views");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const controller = new AbortController();
        fetchApi(`/api/auth/analytics?period=${period}`, {
            cache: "no-store",
            signal: controller.signal,
        })
            .then(async (response) => {
            const payload = await response.json();
            if (!response.ok) {
                const detail = payload && typeof payload === "object" && "detail" in payload
                    ? String(payload.detail)
                    : "Não foi possível carregar a análise.";
                throw new Error(detail);
            }
            setData(payload);
        })
            .catch((reason) => {
            if (controller.signal.aborted)
                return;
            setError(reason instanceof Error
                ? reason.message
                : "Não foi possível carregar a análise.");
        })
            .finally(() => {
            if (!controller.signal.aborted)
                setLoading(false);
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
    return (_jsxs("section", { className: styles.panel, "aria-labelledby": "analytics-title", children: [_jsxs("header", { className: styles.header, children: [_jsxs("div", { children: [_jsx("p", { className: styles.kicker, children: "Desempenho" }), _jsx("h2", { id: "analytics-title", children: "An\u00E1lise da atividade" }), _jsx("p", { children: "Dados reais das publica\u00E7\u00F5es e intera\u00E7\u00F5es com clientes." })] }), _jsxs("label", { className: styles.period, children: [_jsx("span", { children: "Per\u00EDodo" }), _jsx("select", { value: period, onChange: (event) => {
                                    setLoading(true);
                                    setError("");
                                    setPeriod(Number(event.target.value));
                                }, children: diasPermitidos.map((days) => (_jsxs("option", { value: days, children: ["\u00DAltimos ", days, " dias"] }, days))) })] })] }), error ? (_jsx("p", { className: styles.error, role: "alert", children: error })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.metrics, "aria-label": `Indicadores dos últimos ${period} dias`, children: [
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
                            return (_jsxs("article", { className: styles.metric, children: [_jsx("span", { children: _jsx(Icon, { size: 17, "aria-hidden": "true" }) }), _jsx("small", { children: item.label }), _jsx("strong", { children: loading ? "—" : (item.value ?? 0).toLocaleString("pt-AO") })] }, item.label));
                        }) }), _jsxs("div", { className: styles.chartCard, children: [_jsxs("div", { className: styles.chartHeader, children: [_jsxs("div", { children: [_jsx("p", { className: styles.kicker, children: "Tend\u00EAncia di\u00E1ria" }), _jsx("h3", { children: metricas.find((item) => item.key === metric)?.label })] }), _jsxs("label", { className: styles.chartSelect, children: [_jsx("span", { className: styles.visuallyHidden, children: "M\u00E9trica do gr\u00E1fico" }), _jsx("select", { value: metric, onChange: (event) => setMetric(event.target.value), children: metricas.map((item) => (_jsx("option", { value: item.key, children: item.label }, item.key))) })] })] }), loading ? (_jsx("p", { className: styles.chartFeedback, role: "status", children: "A carregar os dados\u2026" })) : chart.length ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: styles.chart, viewBox: "0 0 600 196", role: "img", "aria-label": `${metricas.find((item) => item.key === metric)?.label} por dia`, children: [[38, 82, 126, 170].map((y) => (_jsx("line", { x1: "20", x2: "580", y1: y, y2: y, className: styles.gridLine }, y))), _jsx("polyline", { points: chart.map((point) => `${point.x},${point.y}`).join(" "), className: styles.line }), chart.map((point) => (_jsx("circle", { cx: point.x, cy: point.y, r: "3", className: styles.point, children: _jsx("title", { children: `${dataCurta(point.date)}: ${point[metric] ?? 0}` }) }, point.date)))] }), _jsxs("div", { className: styles.chartLabels, children: [_jsx("small", { children: chart[0] ? dataCurta(chart[0].date) : "" }), _jsx("small", { children: chart[Math.floor(chart.length / 2)] ? dataCurta(chart[Math.floor(chart.length / 2)].date) : "" }), _jsx("small", { children: chart[chart.length - 1] ? dataCurta(chart[chart.length - 1].date) : "" })] })] })) : (_jsx("p", { className: styles.chartFeedback, children: "Ainda n\u00E3o h\u00E1 dados para este per\u00EDodo." }))] })] }))] }));
}
