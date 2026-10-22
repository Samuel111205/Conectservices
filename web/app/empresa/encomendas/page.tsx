"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EstruturaAutenticacao from "../../auth-shell";
import accountStyles from "../../auth.module.css";
import styles from "../commerce.module.css";

type OrderStatus = "PENDING" | "ACCEPTED" | "COMPLETED" | "CANCELLED" | "REJECTED";
type OrderItem = { product_id: number; product_name: string; unit_price: string; quantity: number; subtotal: string };
type ProductOrder = {
  id: number;
  provider_name: string;
  is_buyer: boolean;
  is_provider: boolean;
  buyer_email: string;
  buyer_phone: string;
  status: OrderStatus;
  total_amount: string;
  currency: string;
  delivery_notes: string;
  payment_note: string;
  items: OrderItem[];
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

export default function EncomendasRecebidas() {
  const router = useRouter();
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/product-orders", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/entrar?next=%2Fempresa%2Fencomendas");
          return null;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(errorMessage(data));
        return data as Page<ProductOrder>;
      })
      .then((data) => {
        if (active && data) setOrders(data.results.filter((order) => order.is_provider));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar as encomendas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [router]);

  async function agir(order: ProductOrder, action: "accept" | "reject" | "complete" | "cancel") {
    setWorkingId(order.id);
    setError("");
    try {
      const response = await fetch(`/api/auth/product-orders/${order.id}/${action}`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        router.replace("/entrar?next=%2Fempresa%2Fencomendas");
        return;
      }
      if (!response.ok) throw new Error(errorMessage(data));
      setOrders((current) => current.map((item) => item.id === order.id ? data as ProductOrder : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar a encomenda.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <EstruturaAutenticacao account>
      <p className={accountStyles.eyebrow}>Área empresarial</p>
      <h1>Encomendas recebidas</h1>
      <p className={accountStyles.intro}>Confirma os pedidos, contacta o cliente e atualiza o estado quando a encomenda estiver concluída.</p>
      <div className={styles.commerceLinks}><Link href="/empresa/produtos">Gerir produtos</Link><Link href="/produtos">Ver catálogo público</Link></div>
      <div className={styles.commerceLinks}>
        <Link className={styles.primaryLink} href="/empresa/produtos#formulario-produto">Adicionar produto</Link>
      </div>
      <p className={accountStyles.intro}>As encomendas pendentes aparecem abaixo; podes aceitar ou recusar cada pedido.</p>
      {error && <p className={styles.inlineError} role="alert">{error}</p>}
      {loading ? <p className={accountStyles.intro} role="status">A carregar encomendas…</p> : orders.length ? (
        <div className={styles.orderList}>
          {orders.map((order) => (
            <article className={styles.orderCard} key={order.id}>
              <div className={styles.orderTop}>
                <h2>Encomenda #{order.id}</h2>
                <span className={styles.statusBadge} data-status={order.status}>{labels[order.status]}</span>
              </div>
              <p>{new Date(order.created_at).toLocaleString("pt-AO", { dateStyle: "medium", timeStyle: "short" })}</p>
              <ul className={styles.orderItems}>
                {order.items.map((item) => <li key={item.product_id}><span>{item.quantity} × {item.product_name}</span><strong>{Number(item.subtotal).toLocaleString("pt-AO")} {order.currency}</strong></li>)}
              </ul>
              <div className={styles.orderTotal}><span>Total</span><strong>{Number(order.total_amount).toLocaleString("pt-AO")} {order.currency}</strong></div>
              {order.delivery_notes && <p>Observações do cliente: {order.delivery_notes}</p>}
              <p className={styles.paymentNote}>{order.payment_note}</p>
              <div className={styles.orderContact}>
                {order.buyer_email && <a href={`mailto:${order.buyer_email}`}>Email do cliente: {order.buyer_email}</a>}
                {order.buyer_phone && <a href={`tel:${order.buyer_phone}`}>Telefone: {order.buyer_phone}</a>}
              </div>
              <div className={styles.productActions}>
                {order.status === "PENDING" && <>
                  <button className={styles.acceptOrderButton} type="button" disabled={workingId === order.id} onClick={() => void agir(order, "accept")}>Aceitar encomenda</button>
                  <button type="button" disabled={workingId === order.id} onClick={() => void agir(order, "reject")}>Recusar</button>
                </>}
                {order.status === "ACCEPTED" && <>
                  <button type="button" disabled={workingId === order.id} onClick={() => void agir(order, "complete")}>Marcar como concluída</button>
                  <button type="button" disabled={workingId === order.id} onClick={() => void agir(order, "cancel")}>Cancelar encomenda</button>
                </>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>Ainda não recebeste encomendas. <Link href="/empresa/produtos">Publica os teus produtos</Link> para os clientes poderem encomendar.</div>
      )}
    </EstruturaAutenticacao>
  );
}
