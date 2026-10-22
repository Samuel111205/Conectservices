"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EstruturaAutenticacao from "../auth-shell";
import accountStyles from "../auth.module.css";
import styles from "../empresa/commerce.module.css";

type OrderStatus = "PENDING" | "ACCEPTED" | "COMPLETED" | "CANCELLED" | "REJECTED";
type OrderItem = { product_id: number; product_name: string; unit_price: string; quantity: number; subtotal: string };
type Review = { rating: number; comment: string; created_at: string };
type ProductOrder = {
  id: number;
  provider_name: string;
  is_buyer: boolean;
  is_provider: boolean;
  provider_email: string;
  provider_phone: string;
  status: OrderStatus;
  total_amount: string;
  currency: string;
  delivery_notes: string;
  payment_note: string;
  items: OrderItem[];
  review: Review | null;
  created_at: string;
};
type Page<T> = { results: T[] };

const labels: Record<OrderStatus, string> = {
  PENDING: "A aguardar confirmação",
  ACCEPTED: "Aceite pela empresa",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  REJECTED: "Recusada pela empresa",
};

function errorMessage(data: unknown) {
  if (data && typeof data === "object") {
    const values = Object.values(data).flatMap((value) => Array.isArray(value) ? value : [value]);
    const message = values.find((value) => typeof value === "string");
    if (typeof message === "string") return message;
  }
  return "Não foi possível concluir a operação.";
}

export default function MinhasCompras() {
  const router = useRouter();
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [reviewWorkingId, setReviewWorkingId] = useState<number | null>(null);
  const [reviewErrors, setReviewErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    let active = true;
    fetch("/api/auth/product-orders", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/entrar?next=%2Fcompras");
          return null;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(errorMessage(data));
        return data as Page<ProductOrder>;
      })
      .then((data) => {
        if (active && data) setOrders(data.results.filter((order) => order.is_buyer));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar as encomendas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [router]);

  async function cancelar(order: ProductOrder) {
    setWorkingId(order.id);
    setError("");
    try {
      const response = await fetch(`/api/auth/product-orders/${order.id}/cancel`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        router.replace("/entrar?next=%2Fcompras");
        return;
      }
      if (!response.ok) throw new Error(errorMessage(data));
      setOrders((current) => current.map((item) => item.id === order.id ? data as ProductOrder : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível cancelar a encomenda.");
    } finally {
      setWorkingId(null);
    }
  }

  async function avaliar(order: ProductOrder) {
    const rating = ratings[order.id] ?? 0;
    if (rating < 1 || rating > 5) return;
    setReviewWorkingId(order.id);
    setReviewErrors((current) => ({ ...current, [order.id]: "" }));
    try {
      const response = await fetch("/api/auth/reviews/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_order_id: order.id,
          rating,
          comment: (comments[order.id] ?? "").trim(),
        }),
      });
      const data = await response.json().catch(() => null) as Review | null;
      if (response.status === 401) {
        router.replace("/entrar?next=%2Fcompras");
        return;
      }
      if (!response.ok) throw new Error(errorMessage(data));
      if (!data || typeof data.rating !== "number") {
        throw new Error("A API não devolveu a avaliação criada.");
      }
      setOrders((current) => current.map((item) =>
        item.id === order.id
          ? { ...item, review: data }
          : item,
      ));
    } catch (reason) {
      setReviewErrors((current) => ({
        ...current,
        [order.id]: reason instanceof Error ? reason.message : "Não foi possível enviar a avaliação.",
      }));
    } finally {
      setReviewWorkingId(null);
    }
  }

  return (
    <EstruturaAutenticacao account>
      <p className={accountStyles.eyebrow}>Área do cliente</p>
      <h1>As minhas encomendas</h1>
      <p className={accountStyles.intro}>Acompanha a resposta das empresas e combina com elas o pagamento e a entrega.</p>
      <div className={styles.commerceLinks}><Link href="/produtos">Ver produtos</Link></div>
      {error && <p className={styles.inlineError} role="alert">{error}</p>}
      {loading ? <p className={accountStyles.intro} role="status">A carregar encomendas…</p> : orders.length ? (
        <div className={styles.orderList}>
          {orders.map((order) => (
            <article className={styles.orderCard} key={order.id}>
              <div className={styles.orderTop}>
                <h2>Encomenda #{order.id} · {order.provider_name}</h2>
                <span className={styles.statusBadge} data-status={order.status}>{labels[order.status]}</span>
              </div>
              <p>{new Date(order.created_at).toLocaleString("pt-AO", { dateStyle: "medium", timeStyle: "short" })}</p>
              <ul className={styles.orderItems}>
                {order.items.map((item) => <li key={item.product_id}><span>{item.quantity} × {item.product_name}</span><strong>{Number(item.subtotal).toLocaleString("pt-AO")} {order.currency}</strong></li>)}
              </ul>
              <div className={styles.orderTotal}><span>Total</span><strong>{Number(order.total_amount).toLocaleString("pt-AO")} {order.currency}</strong></div>
              {order.delivery_notes && <p>Observações: {order.delivery_notes}</p>}
              <p className={styles.paymentNote}>{order.payment_note}</p>
              <div className={styles.orderContact}>
                {order.provider_email && <a href={`mailto:${order.provider_email}`}>Email da empresa: {order.provider_email}</a>}
                {order.provider_phone && <a href={`tel:${order.provider_phone}`}>Telefone: {order.provider_phone}</a>}
              </div>
              {order.status === "PENDING" && <div className={styles.productActions}><button type="button" disabled={workingId === order.id} onClick={() => void cancelar(order)}>{workingId === order.id ? "A cancelar…" : "Cancelar encomenda"}</button></div>}
              {order.status === "COMPLETED" && (
                <section className={styles.reviewPanel} aria-label={`Avaliação da encomenda ${order.id}`}>
                  {order.review ? (
                    <>
                      <strong role="status">Avaliação enviada</strong>
                      <p>
                        <span role="img" aria-label={`${order.review.rating} de 5 estrelas`}>
                          {"★".repeat(order.review.rating)}{"☆".repeat(5 - order.review.rating)}
                        </span>{" "}{order.review.rating}/5
                      </p>
                      {order.review.comment && <p>“{order.review.comment}”</p>}
                    </>
                  ) : (
                    <>
                      <strong>Como correu a encomenda?</strong>
                      <div className={styles.reviewStars} role="group" aria-label="Classificação da encomenda">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            type="button"
                            key={rating}
                            disabled={reviewWorkingId === order.id}
                            aria-label={`${rating} ${rating === 1 ? "estrela" : "estrelas"}`}
                            aria-pressed={ratings[order.id] === rating}
                            data-selected={rating <= (ratings[order.id] ?? 0)}
                            onClick={() => setRatings((current) => ({ ...current, [order.id]: rating }))}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <label>
                        Comentário opcional
                        <textarea
                          rows={3}
                          maxLength={2000}
                          disabled={reviewWorkingId === order.id}
                          value={comments[order.id] ?? ""}
                          onChange={(event) => setComments((current) => ({ ...current, [order.id]: event.target.value }))}
                        />
                      </label>
                      {reviewErrors[order.id] && <p className={styles.inlineError} role="alert">{reviewErrors[order.id]}</p>}
                      <div className={styles.productActions}>
                        <button
                          className={styles.acceptOrderButton}
                          type="button"
                          disabled={reviewWorkingId !== null || !ratings[order.id]}
                          onClick={() => void avaliar(order)}
                        >
                          {reviewWorkingId === order.id ? "A enviar avaliação…" : "Enviar avaliação"}
                        </button>
                      </div>
                    </>
                  )}
                </section>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>Ainda não fizeste encomendas de produtos. <Link href="/produtos">Explorar produtos</Link></div>
      )}
    </EstruturaAutenticacao>
  );
}
