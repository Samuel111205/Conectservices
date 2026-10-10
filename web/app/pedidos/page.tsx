"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";

type Order = {
  id: number;
  category: number;
  title: string;
  description: string;
  minimum_budget: string | null;
  maximum_budget: string | null;
  currency: string;
  municipality_name: string;
  province_name: string;
  neighborhood: string;
  requested_at: string | null;
  status: string;
  created_at: string;
};

type Proposal = {
  id: number;
  order_id: number;
  provider_id: number;
  provider_name: string;
  service: number | null;
  price: string;
  currency: string;
  description: string;
  estimated_days: number;
  status: string;
  created_at: string;
};

type Category = { id: number; name: string };
type ApiPage<T> = { count: number; results: T[] };

const URL_BASE_API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000/api/v1";

const nomesEstados: Record<string, string> = {
  OPEN: "Aberto",
  NEGOTIATING: "A receber propostas",
  AWARDED: "Contratado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

function formatarOrcamento(pedido: Order) {
  if (pedido.minimum_budget === null && pedido.maximum_budget === null) {
    return "Orçamento sob consulta";
  }
  const minimo =
    pedido.minimum_budget === null
      ? null
      : Number(pedido.minimum_budget).toLocaleString("pt-AO");
  const maximo =
    pedido.maximum_budget === null
      ? null
      : Number(pedido.maximum_budget).toLocaleString("pt-AO");
  if (minimo && maximo && minimo !== maximo) {
    return `${minimo}–${maximo} ${pedido.currency}`;
  }
  return `${minimo ?? maximo} ${pedido.currency}`;
}

export default function PaginaPedidos() {
  const navegador = useRouter();
  const [pedidos, definirPedidos] = useState<Order[]>([]);
  const [propostas, definirPropostas] = useState<Proposal[]>([]);
  const [categorias, definirCategorias] = useState<Category[]>([]);
  const [erro, definirErro] = useState("");
  const [estaCarregando, definirCarregamento] = useState(true);
  const [acaoProposta, definirAcaoProposta] = useState<number | null>(null);
  const [erroDaProposta, definirErroDaProposta] = useState("");

  useEffect(() => {
    let ativo = true;
    Promise.all([
      fetch("/api/auth/orders/", { cache: "no-store" }),
      fetch("/api/auth/proposals/", { cache: "no-store" }),
      fetch(`${URL_BASE_API}/categories/?parent=null`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      }),
    ])
      .then(async ([respostaPedidos, respostaPropostas, respostaCategorias]) => {
        if (respostaPedidos.status === 401 || respostaPropostas.status === 401) {
          navegador.replace("/entrar?next=%2Fpedidos");
          return;
        }
        if (
          !respostaPedidos.ok ||
          !respostaPropostas.ok ||
          !respostaCategorias.ok
        ) {
          const dadosRecebidos = await respostaPedidos.json().catch(() => null);
          throw new Error(
            typeof dadosRecebidos?.detail === "string"
              ? dadosRecebidos.detail
              : "Não foi possível carregar os pedidos.",
          );
        }
        const [orderPage, paginaPropostas, paginaCategorias] = (await Promise.all([
          respostaPedidos.json(),
          respostaPropostas.json(),
          respostaCategorias.json(),
        ])) as [ApiPage<Order>, ApiPage<Proposal>, ApiPage<Category>];
        if (ativo) {
          definirPedidos(orderPage.results);
          definirPropostas(paginaPropostas.results);
          definirCategorias(paginaCategorias.results);
        }
      })
      .catch((motivo: unknown) => {
        if (ativo) {
          definirErro(
            motivo instanceof Error
              ? motivo.message
              : "Não foi possível carregar os pedidos.",
          );
        }
      })
      .finally(() => {
        if (ativo) definirCarregamento(false);
      });
    return () => {
      ativo = false;
    };
  }, [navegador]);

  async function responderProposta(proposta: Proposal, acao: "accept" | "reject") {
    definirAcaoProposta(proposta.id);
    definirErroDaProposta("");
    try {
      const respostaHttp = await fetch(
        `/api/auth/proposals/${proposta.id}/${acao}/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const dadosRecebidos = await respostaHttp.json().catch(() => null);
      if (respostaHttp.status === 401) {
        navegador.replace("/entrar?next=%2Fpedidos");
        return;
      }
      if (!respostaHttp.ok) {
        definirErroDaProposta(
          typeof dadosRecebidos?.detail === "string"
            ? dadosRecebidos.detail
            : "Não foi possível atualizar a proposta.",
        );
        return;
      }
      definirPropostas((atual) =>
        atual.map((item) =>
          item.order_id === proposta.order_id && acao === "accept"
            ? {
                ...item,
                status: item.id === proposta.id ? "ACCEPTED" : "REJECTED",
              }
            : item.id === proposta.id
              ? { ...item, status: "REJECTED" }
              : item,
        ),
      );
      if (acao === "accept") {
        definirPedidos((atual) =>
          atual.map((pedido) =>
            pedido.id === proposta.order_id
              ? { ...pedido, status: "AWARDED" }
              : pedido,
          ),
        );
        navegador.push("/contratacoes");
      }
    } catch {
      definirErroDaProposta("Não foi possível contactar o serviço.");
    } finally {
      definirAcaoProposta(null);
    }
  }

  return (
    <EstruturaAutenticacao account>
      <p className={styles.eyebrow}>Acompanhamento</p>
      <h1>Os meus pedidos</h1>
      <p className={styles.intro}>
        Consulta os pedidos enviados e acompanha o estado de cada um.
      </p>
      <div className={styles.accountActions}>
        <Link className={styles.submitLink} href="/pedidos/novo">
          Criar pedido
        </Link>
        <Link className={styles.secondary} href="/conta">
          Área pessoal
        </Link>
      </div>
      {estaCarregando ? (
        <p className={styles.intro} aria-live="polite">
          A carregar pedidos…
        </p>
      ) : erro ? (
        <p className={styles.notice} role="alert">
          {erro}
        </p>
      ) : pedidos.length ? (
        <div className={styles.orderList}>
          {pedidos.map((pedido) => (
            <article className={styles.orderCard} key={pedido.id}>
              <div className={styles.orderTopline}>
                <span className={styles.orderCategory}>
                  {categorias.find((item) => item.id === pedido.category)?.name ??
                    "Serviço"}
                </span>
                <span className={styles.profileBadge}>
                  {nomesEstados[pedido.status] ?? pedido.status}
                </span>
              </div>
              <h2>{pedido.title}</h2>
              <p>{pedido.description}</p>
              <div className={styles.orderMetadata}>
                <span>
                  {pedido.neighborhood ? `${pedido.neighborhood}, ` : ""}
                  {pedido.municipality_name}, {pedido.province_name}
                </span>
                <strong>{formatarOrcamento(pedido)}</strong>
              </div>
              <small>
                Criado em{" "}
                {new Date(pedido.created_at).toLocaleDateString("pt-AO")}
                {pedido.requested_at
                  ? ` · Pretendido para ${new Date(pedido.requested_at).toLocaleString("pt-AO")}`
                  : ""}
              </small>
              {propostas.some((proposta) => proposta.order_id === pedido.id) && (
                <section className={styles.proposalSection}>
                  <h3>Propostas recebidas</h3>
                  {erroDaProposta && (
                    <p className={styles.notice} role="alert">
                      {erroDaProposta}
                    </p>
                  )}
                  {propostas
                    .filter((proposta) => proposta.order_id === pedido.id)
                    .map((proposta) => (
                      <article
                        className={styles.proposalCard}
                        key={proposta.id}
                      >
                        <div className={styles.orderTopline}>
                          <strong>{proposta.provider_name}</strong>
                          <span className={styles.profileBadge}>
                            {proposta.status === "PENDING"
                              ? "Pendente"
                              : proposta.status === "ACCEPTED"
                                ? "Aceite"
                                : proposta.status === "REJECTED"
                                  ? "Rejeitada"
                                  : proposta.status}
                          </span>
                        </div>
                        <p>{proposta.description}</p>
                        <div className={styles.orderMetadata}>
                          <strong>
                            {Number(proposta.price).toLocaleString("pt-AO")}{" "}
                            {proposta.currency}
                          </strong>
                          <span>
                            Prazo estimado: {proposta.estimated_days} dias
                          </span>
                        </div>
                        {proposta.status === "PENDING" &&
                          pedido.status !== "AWARDED" &&
                          pedido.status !== "COMPLETED" &&
                          pedido.status !== "CANCELLED" && (
                            <div className={styles.accountActions}>
                              <button
                                className={styles.submitLink}
                                type="button"
                                disabled={acaoProposta === proposta.id}
                                onClick={() =>
                                  void responderProposta(proposta, "accept")
                                }
                              >
                                {acaoProposta === proposta.id
                                  ? "A processar…"
                                  : "Aceitar proposta"}
                              </button>
                              <button
                                className={styles.secondary}
                                type="button"
                                disabled={acaoProposta === proposta.id}
                                onClick={() =>
                                  void responderProposta(proposta, "reject")
                                }
                              >
                                Rejeitar
                              </button>
                            </div>
                          )}
                      </article>
                    ))}
                </section>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.orderEmpty}>
          <h2>Ainda não tens pedidos.</h2>
          <p>Cria um pedido e recebe propostas de profissionais.</p>
        </div>
      )}
    </EstruturaAutenticacao>
  );
}
