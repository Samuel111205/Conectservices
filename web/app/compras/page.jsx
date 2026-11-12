"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import EstruturaAutenticacao from "../auth-shell";
import accountStyles from "../auth.module.css";
import styles from "../empresa/commerce.module.css";
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
export default function MinhasCompras() {
    const router = useRouter();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workingId, setWorkingId] = useState(null);
    const [error, setError] = useState("");
    const [ratings, setRatings] = useState({});
    const [comments, setComments] = useState({});
    const [reviewWorkingId, setReviewWorkingId] = useState(null);
    const [reviewErrors, setReviewErrors] = useState({});
    useEffect(() => {
        let active = true;
        fetchApi("/api/auth/product-orders", { cache: "no-store" })
            .then(async (response) => {
            if (response.status === 401) {
                router.replace("/entrar?next=%2Fcompras");
                return null;
            }
            const data = await response.json();
            if (!response.ok)
                throw new Error(errorMessage(data));
            return data;
        })
            .then((data) => {
            if (active && data)
                setOrders(data.results.filter((order) => order.is_buyer));
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
    async function cancelar(order) {
        setWorkingId(order.id);
        setError("");
        try {
            const response = await fetchApi(`/api/auth/product-orders/${order.id}/cancel`, { method: "POST" });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401) {
                router.replace("/entrar?next=%2Fcompras");
                return;
            }
            if (!response.ok)
                throw new Error(errorMessage(data));
            setOrders((current) => current.map((item) => item.id === order.id ? data : item));
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Não foi possível cancelar a encomenda.");
        }
        finally {
            setWorkingId(null);
        }
    }
    async function avaliar(order) {
        const rating = ratings[order.id] ?? 0;
        if (rating < 1 || rating > 5)
            return;
        setReviewWorkingId(order.id);
        setReviewErrors((current) => ({ ...current, [order.id]: "" }));
        try {
            const response = await fetchApi("/api/auth/reviews/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_order_id: order.id,
                    rating,
                    comment: (comments[order.id] ?? "").trim(),
                }),
            });
            const data = await response.json().catch(() => null);
            if (response.status === 401) {
                router.replace("/entrar?next=%2Fcompras");
                return;
            }
            if (!response.ok)
                throw new Error(errorMessage(data));
            if (!data || typeof data.rating !== "number") {
                throw new Error("A API não devolveu a avaliação criada.");
            }
            setOrders((current) => current.map((item) => item.id === order.id
                ? { ...item, review: data }
                : item));
        }
        catch (reason) {
            setReviewErrors((current) => ({
                ...current,
                [order.id]: reason instanceof Error ? reason.message : "Não foi possível enviar a avaliação.",
            }));
        }
        finally {
            setReviewWorkingId(null);
        }
    }
    return (_jsxs(EstruturaAutenticacao, { account: true, children: [_jsx("p", { className: accountStyles.eyebrow, children: "\u00C1rea do cliente" }), _jsx("h1", { children: "As minhas encomendas" }), _jsx("p", { className: accountStyles.intro, children: "Acompanha a resposta das empresas e combina com elas o pagamento e a entrega." }), _jsx("div", { className: styles.commerceLinks, children: _jsx(Link, { href: "/produtos", children: "Ver produtos" }) }), error && _jsx("p", { className: styles.inlineError, role: "alert", children: error }), loading ? _jsx("p", { className: accountStyles.intro, role: "status", children: "A carregar encomendas\u2026" }) : orders.length ? (_jsx("div", { className: styles.orderList, children: orders.map((order) => (_jsxs("article", { className: styles.orderCard, children: [_jsxs("div", { className: styles.orderTop, children: [_jsxs("h2", { children: ["Encomenda #", order.id, " \u00B7 ", order.provider_name] }), _jsx("span", { className: styles.statusBadge, "data-status": order.status, children: labels[order.status] })] }), _jsx("p", { children: new Date(order.created_at).toLocaleString("pt-AO", { dateStyle: "medium", timeStyle: "short" }) }), _jsx("ul", { className: styles.orderItems, children: order.items.map((item) => _jsxs("li", { children: [_jsxs("span", { children: [item.quantity, " \u00D7 ", item.product_name] }), _jsxs("strong", { children: [Number(item.subtotal).toLocaleString("pt-AO"), " ", order.currency] })] }, item.product_id)) }), _jsxs("div", { className: styles.orderTotal, children: [_jsx("span", { children: "Total" }), _jsxs("strong", { children: [Number(order.total_amount).toLocaleString("pt-AO"), " ", order.currency] })] }), order.delivery_notes && _jsxs("p", { children: ["Observa\u00E7\u00F5es: ", order.delivery_notes] }), _jsx("p", { className: styles.paymentNote, children: order.payment_note }), _jsxs("div", { className: styles.orderContact, children: [order.provider_email && _jsxs("a", { href: `mailto:${order.provider_email}`, children: ["Email da empresa: ", order.provider_email] }), order.provider_phone && _jsxs("a", { href: `tel:${order.provider_phone}`, children: ["Telefone: ", order.provider_phone] })] }), order.status === "PENDING" && _jsx("div", { className: styles.productActions, children: _jsx("button", { type: "button", disabled: workingId === order.id, onClick: () => void cancelar(order), children: workingId === order.id ? "A cancelar…" : "Cancelar encomenda" }) }), order.status === "COMPLETED" && (_jsx("section", { className: styles.reviewPanel, "aria-label": `Avaliação da encomenda ${order.id}`, children: order.review ? (_jsxs(_Fragment, { children: [_jsx("strong", { role: "status", children: "Avalia\u00E7\u00E3o enviada" }), _jsxs("p", { children: [_jsxs("span", { role: "img", "aria-label": `${order.review.rating} de 5 estrelas`, children: ["★".repeat(order.review.rating), "☆".repeat(5 - order.review.rating)] }), " ", order.review.rating, "/5"] }), order.review.comment && _jsxs("p", { children: ["\u201C", order.review.comment, "\u201D"] })] })) : (_jsxs(_Fragment, { children: [_jsx("strong", { children: "Como correu a encomenda?" }), _jsx("div", { className: styles.reviewStars, role: "group", "aria-label": "Classifica\u00E7\u00E3o da encomenda", children: [1, 2, 3, 4, 5].map((rating) => (_jsx("button", { type: "button", disabled: reviewWorkingId === order.id, "aria-label": `${rating} ${rating === 1 ? "estrela" : "estrelas"}`, "aria-pressed": ratings[order.id] === rating, "data-selected": rating <= (ratings[order.id] ?? 0), onClick: () => setRatings((current) => ({ ...current, [order.id]: rating })), children: "\u2605" }, rating))) }), _jsxs("label", { children: ["Coment\u00E1rio opcional", _jsx("textarea", { rows: 3, maxLength: 2000, disabled: reviewWorkingId === order.id, value: comments[order.id] ?? "", onChange: (event) => setComments((current) => ({ ...current, [order.id]: event.target.value })) })] }), reviewErrors[order.id] && _jsx("p", { className: styles.inlineError, role: "alert", children: reviewErrors[order.id] }), _jsx("div", { className: styles.productActions, children: _jsx("button", { className: styles.acceptOrderButton, type: "button", disabled: reviewWorkingId !== null || !ratings[order.id], onClick: () => void avaliar(order), children: reviewWorkingId === order.id ? "A enviar avaliação…" : "Enviar avaliação" }) })] })) }))] }, order.id))) })) : (_jsxs("div", { className: styles.emptyState, children: ["Ainda n\u00E3o fizeste encomendas de produtos. ", _jsx(Link, { href: "/produtos", children: "Explorar produtos" })] }))] }));
}
