"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import EstruturaAutenticacao from "../../auth-shell";
import styles from "../../auth.module.css";

type Opportunity = {
  id: number;
  category: number;
  category_name: string;
  title: string;
  description: string;
  minimum_budget: string | null;
  maximum_budget: string | null;
  currency: string;
  municipality_name_snapshot: string;
  province_name_snapshot: string;
  neighborhood_snapshot: string;
  requested_at: string | null;
  created_at: string;
};

type Proposal = {
  id: number;
  order_id: number;
  price: string;
  description: string;
  estimated_days: number;
  status: string;
};

type ApiPage<T> = { count: number; results: T[] };

function formatarOrcamento(orcamentoMinimo: string | null, orcamentoMaximo: string | null) {
  if (orcamentoMinimo === null && orcamentoMaximo === null) {
    return "Sem orçamento indicado";
  }
  const minimo = orcamentoMinimo === null
    ? null
    : Number(orcamentoMinimo).toLocaleString("pt-AO");
  const maximo = orcamentoMaximo === null
    ? null
    : Number(orcamentoMaximo).toLocaleString("pt-AO");
  if (minimo && maximo && minimo !== maximo) return `${minimo}–${maximo} AOA`;
  return `${minimo ?? maximo} AOA`;
}

function obterMensagemErro(dadosRecebidos: unknown) {
  if (dadosRecebidos && typeof dadosRecebidos === "object") {
    const mensagens = Object.values(dadosRecebidos).flatMap((valor) =>
      Array.isArray(valor) ? valor : [valor],
    );
    const mensagem = mensagens.find((valor) => typeof valor === "string");
    if (typeof mensagem === "string") return mensagem;
  }
  return "Não foi possível concluir a operação.";
}

export default function PaginaOportunidadesPrestador() {
  const navegador = useRouter();
  const [oportunidades, definirOportunidades] = useState<Opportunity[]>([]);
  const [propostas, definirPropostas] = useState<Proposal[]>([]);
  const [erro, definirErro] = useState("");
  const [estaCarregando, definirCarregamento] = useState(true);
  const [aEnviarPedido, definirEnvioPedido] = useState<number | null>(null);
  const [errosFormulario, definirErrosFormulario] = useState<Record<number, string>>({});
  const [precos, definirPrecos] = useState<Record<number, string>>({});
  const [descricoes, definirDescricoes] = useState<Record<number, string>>({});
  const [prazos, definirPrazos] = useState<Record<number, string>>({});

  useEffect(() => {
    let ativo = true;
    Promise.all([
      fetch("/api/auth/orders/opportunities/", { cache: "no-store" }),
      fetch("/api/auth/proposals/", { cache: "no-store" }),
    ])
      .then(async ([respostaOportunidades, respostaPropostas]) => {
        if (
          respostaOportunidades.status === 401 ||
          respostaPropostas.status === 401
        ) {
          navegador.replace("/entrar?next=%2Fprestador%2Fpedidos");
          return;
        }
        if (!respostaOportunidades.ok || !respostaPropostas.ok) {
          const dadosRecebidos = await respostaOportunidades.json().catch(() => null);
          throw new Error(
            typeof dadosRecebidos?.detail === "string"
              ? dadosRecebidos.detail
              : "Não foi possível carregar os pedidos disponíveis.",
          );
        }
        const [paginaOportunidades, paginaPropostas] = (await Promise.all([
          respostaOportunidades.json(),
          respostaPropostas.json(),
        ])) as [ApiPage<Opportunity>, ApiPage<Proposal>];
        if (ativo) {
          definirOportunidades(paginaOportunidades.results);
          definirPropostas(paginaPropostas.results);
        }
      })
      .catch((motivo: unknown) => {
        if (ativo) {
          definirErro(
            motivo instanceof Error
              ? motivo.message
              : "Não foi possível carregar os pedidos disponíveis.",
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

  async function enviarProposta(
    evento: FormEvent<HTMLFormElement>,
    oportunidade: Opportunity,
  ) {
    evento.preventDefault();
    definirEnvioPedido(oportunidade.id);
    definirErrosFormulario((atual) => ({ ...atual, [oportunidade.id]: "" }));
    try {
      const respostaHttp = await fetch("/api/auth/proposals/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: oportunidade.id,
          price: precos[oportunidade.id],
          description: descricoes[oportunidade.id],
          estimated_days: Number(prazos[oportunidade.id]),
        }),
      });
      const dadosRecebidos = await respostaHttp.json();
      if (respostaHttp.status === 401) {
        navegador.replace("/entrar?next=%2Fprestador%2Fpedidos");
        return;
      }
      if (!respostaHttp.ok) {
        definirErrosFormulario((atual) => ({
          ...atual,
          [oportunidade.id]: obterMensagemErro(dadosRecebidos),
        }));
        return;
      }
      definirPropostas((atual) => [dadosRecebidos as Proposal, ...atual]);
    } catch {
      definirErrosFormulario((atual) => ({
        ...atual,
        [oportunidade.id]: "Não foi possível contactar o serviço.",
      }));
    } finally {
      definirEnvioPedido(null);
    }
  }

  const propostaDoPedido = (idPedido: number) =>
    propostas.find(
      (proposta) =>
        proposta.order_id === idPedido && proposta.status !== "CANCELLED",
    );

  return (
    <EstruturaAutenticacao account>
      <p className={styles.eyebrow}>Área do prestador</p>
      <h1>Pedidos disponíveis</h1>
      <p className={styles.intro}>
        Consulta pedidos compatíveis com a tua conta e envia uma proposta aos
        clientes que podes ajudar.
      </p>
      <div className={styles.accountActions}>
        <Link className={styles.secondary} href="/perfil">
          Gerir perfil profissional
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
      ) : oportunidades.length ? (
        <div className={styles.orderList}>
          {oportunidades.map((oportunidade) => {
            const proposta = propostaDoPedido(oportunidade.id);
            return (
              <article className={styles.orderCard} key={oportunidade.id}>
                <div className={styles.orderTopline}>
                  <span className={styles.orderCategory}>
                    {oportunidade.category_name}
                  </span>
                  <span className={styles.profileBadge}>
                    {proposta ? "Proposta enviada" : "Aberto"}
                  </span>
                </div>
                <h2>{oportunidade.title}</h2>
                <p>{oportunidade.description}</p>
                <div className={styles.orderMetadata}>
                  <span>
                    {oportunidade.neighborhood_snapshot
                      ? `${oportunidade.neighborhood_snapshot}, `
                      : ""}
                    {oportunidade.municipality_name_snapshot},{" "}
                    {oportunidade.province_name_snapshot}
                  </span>
                  <strong>
                    {formatarOrcamento(
                      oportunidade.minimum_budget,
                      oportunidade.maximum_budget,
                    )}
                  </strong>
                </div>
                {oportunidade.requested_at && (
                  <small>
                    Pretendido para{" "}
                    {new Date(oportunidade.requested_at).toLocaleString("pt-AO")}
                  </small>
                )}
                {proposta ? (
                  <div className={styles.sentProposal}>
                    <strong>
                      A tua proposta:{" "}
                      {Number(proposta.price).toLocaleString("pt-AO")} AOA
                    </strong>
                    <span>
                      Prazo estimado: {proposta.estimated_days} dias · Estado:{" "}
                      {proposta.status === "PENDING"
                        ? "Pendente"
                        : proposta.status}
                    </span>
                  </div>
                ) : (
                  <form
                    className={styles.inlineProposal}
                    onSubmit={(evento) => void enviarProposta(evento, oportunidade)}
                  >
                    <label className={styles.field}>
                      A tua proposta (AOA)
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={precos[oportunidade.id] ?? ""}
                        onChange={(evento) =>
                          definirPrecos((atual) => ({
                            ...atual,
                            [oportunidade.id]: evento.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      Prazo estimado (dias)
                      <input
                        type="number"
                        min="1"
                        max="32767"
                        required
                        value={prazos[oportunidade.id] ?? ""}
                        onChange={(evento) =>
                          definirPrazos((atual) => ({
                            ...atual,
                            [oportunidade.id]: evento.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      Mensagem para o cliente
                      <textarea
                        required
                        maxLength={3000}
                        rows={3}
                        value={descricoes[oportunidade.id] ?? ""}
                        onChange={(evento) =>
                          definirDescricoes((atual) => ({
                            ...atual,
                            [oportunidade.id]: evento.target.value,
                          }))
                        }
                      />
                    </label>
                    {errosFormulario[oportunidade.id] && (
                      <p className={styles.notice} role="alert">
                        {errosFormulario[oportunidade.id]}
                      </p>
                    )}
                    <button
                      className={styles.submit}
                      type="submit"
                      disabled={aEnviarPedido === oportunidade.id}
                    >
                      {aEnviarPedido === oportunidade.id
                        ? "A enviar proposta…"
                        : "Enviar proposta"}
                    </button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.orderEmpty}>
          <h2>Não há pedidos disponíveis neste momento.</h2>
          <p>
            Confirma que o teu perfil profissional está verificado e que a tua
            conta está ativa. Os pedidos compatíveis aparecerão aqui.
          </p>
        </div>
      )}
    </EstruturaAutenticacao>
  );
}
