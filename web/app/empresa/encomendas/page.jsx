"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import EstruturaAutenticacao from "../../auth-shell";
import accountStyles from "../../auth.module.css";
import styles from "../commerce.module.css";
const labels = {
    PENDING: "A aguardar confirmação",
    ACCEPTED: "Aceite pela empresa",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
    REJECTED: "Recusada pela empresa",
};
function errorMessage(data) {
    if (data && typeof data === "object") {
        const values = Object.values(data).flatMap((value) => Array.isArray(value) ? value : [value]);
        const message = values.find((value) => typeof value === "string");
        if (typeof message === "string")
            return message;
    }
    return "Não foi possível concluir a operação.";
}
export default function EncomendasRecebidas() {
    const router = useRouter();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workingId, setWorkingId] = useState(null);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        fetchApi("/api/auth/product-orders", { cache: "no-store" })
            .then(async (response) => {
            if (response.status === 401) {
                router.replace("/entrar?next=%2Fempresa%2Fencomendas");
                return null;
            }
            const data = await response.json();
            if (!response.ok)
                throw new Error(errorMessage(data));
            return data;
        })
            .then((data) => {
            if (active && data)
                setOrders(data.results.filter((order) => order.is_provider));
        })
            .catch((reason) => {
            if (active)
                setError(reason instanceof Error ? reason.message : "Não foi possível carregar as encomendas.");
        })
            .finally(() => {
            if (active)
                setLoading(false);
        });
        return () => { active = false; };
    }, [router]);
    async function agir(order, action) {
        setWorkingId(order.id);
        setError("");
        try {
            const response = await fetchApi(`/api/auth/product-orders/${order.id}/${action}`, { method: "POST" });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401) {
                router.replace("/entrar?next=%2Fempresa%2Fencomendas");
                return;
            }
            if (!response.ok)
                throw new Error(errorMessage(data));
            setOrders((current) => current.map((item) => item.id === order.id ? data : item));
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Não foi possível atualizar a encomenda.");
        }
        finally {
            setWorkingId(null);
        }
    }
    return (_jsxs(EstruturaAutenticacao, { account: true, children: [_jsx("p", { className: accountStyles.eyebrow, children: "\u00C1rea empresarial" }), _jsx("h1", { children: "Encomendas recebidas" }), _jsx("p", { className: accountStyles.intro, children: "Confirma os pedidos, contacta o cliente e atualiza o estado quando a encomenda estiver conclu\u00EDda." }), _jsxs("div", { className: styles.commerceLinks, children: [_jsx(Link, { href: "/empresa/produtos", children: "Gerir produtos" }), _jsx(Link, { href: "/produtos", children: "Ver cat\u00E1logo p\u00FAblico" })] }), _jsx("div", { className: styles.commerceLinks, children: _jsx(Link, { className: styles.primaryLink, href: "/empresa/produtos#formulario-produto", children: "Adicionar produto" }) }), _jsx("p", { className: accountStyles.intro, children: "As encomendas pendentes aparecem abaixo; podes aceitar ou recusar cada pedido." }), error && _jsx("p", { className: styles.inlineError, role: "alert", children: error }), loading ? _jsx("p", { className: accountStyles.intro, role: "status", children: "A carregar encomendas\u2026" }) : orders.length ? (_jsx("div", { className: styles.orderList, children: orders.map((order) => (_jsxs("article", { className: styles.orderCard, children: [_jsxs("div", { className: styles.orderTop, children: [_jsxs("h2", { children: ["Encomenda #", order.id] }), _jsx("span", { className: styles.statusBadge, "data-status": order.status, children: labels[order.status] })] }), _jsx("p", { children: new Date(order.created_at).toLocaleString("pt-AO", { dateStyle: "medium", timeStyle: "short" }) }), _jsx("ul", { className: styles.orderItems, children: order.items.map((item) => _jsxs("li", { children: [_jsxs("span", { children: [item.quantity, " \u00D7 ", item.product_name] }), _jsxs("strong", { children: [Number(item.subtotal).toLocaleString("pt-AO"), " ", order.currency] })] }, item.product_id)) }), _jsxs("div", { className: styles.orderTotal, children: [_jsx("span", { children: "Total" }), _jsxs("strong", { children: [Number(order.total_amount).toLocaleString("pt-AO"), " ", order.currency] })] }), order.delivery_notes && _jsxs("p", { children: ["Observa\u00E7\u00F5es do cliente: ", order.delivery_notes] }), _jsx("p", { className: styles.paymentNote, children: order.payment_note }), _jsxs("div", { className: styles.orderContact, children: [order.buyer_email && _jsxs("a", { href: `mailto:${order.buyer_email}`, children: ["Email do cliente: ", order.buyer_email] }), order.buyer_phone && _jsxs("a", { href: `tel:${order.buyer_phone}`, children: ["Telefone: ", order.buyer_phone] })] }), _jsxs("div", { className: styles.productActions, children: [order.status === "PENDING" && _jsxs(_Fragment, { children: [_jsx("button", { className: styles.acceptOrderButton, type: "button", disabled: workingId === order.id, onClick: () => void agir(order, "accept"), children: "Aceitar encomenda" }), _jsx("button", { type: "button", disabled: workingId === order.id, onClick: () => void agir(order, "reject"), children: "Recusar" })] }), order.status === "ACCEPTED" && _jsxs(_Fragment, { children: [_jsx("button", { type: "button", disabled: workingId === order.id, onClick: () => void agir(order, "complete"), children: "Marcar como conclu\u00EDda" }), _jsx("button", { type: "button", disabled: workingId === order.id, onClick: () => void agir(order, "cancel"), children: "Cancelar encomenda" })] })] })] }, order.id))) })) : (_jsxs("div", { className: styles.emptyState, children: ["Ainda n\u00E3o recebeste encomendas. ", _jsx(Link, { href: "/empresa/produtos", children: "Publica os teus produtos" }), " para os clientes poderem encomendar."] }))] }));
}
