"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { requisitarJson } from "@/lib/api-client";
import EstruturaAutenticacao from "../../auth-shell";
import styles from "../../auth.module.css";

type ApiPage<T> = { results: T[] };
type Category = { id: number; name: string; parent: number | null };
type Municipality = { id: number; name: string; province: number };

function obterMensagemErro(dadosRecebidos: unknown) {
  if (dadosRecebidos && typeof dadosRecebidos === "object") {
    const valores = Object.values(dadosRecebidos).flatMap((valor) =>
      Array.isArray(valor) ? valor : [valor],
    );
    const mensagem = valores.find((valor) => typeof valor === "string");
    if (typeof mensagem === "string") return mensagem;
  }
  return "Não foi possível enviar o pedido. Confirma os dados e tenta novamente.";
}

export default function PaginaNovoPedido() {
  const navegador = useRouter();
  const [categorias, definirCategorias] = useState<Category[]>([]);
  const [municipios, definirMunicipios] = useState<Municipality[]>([]);
  const [categoria, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [descricao, definirDescricao] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [address, setAddress] = useState("");
  const [minimumBudget, setMinimumBudget] = useState("");
  const [maximumBudget, setMaximumBudget] = useState("");
  const [duration, setDuration] = useState("");
  const [requestedAt, setRequestedAt] = useState("");
  const [prestadorDeOrigem, definirPrestadorDeOrigem] = useState("");
  const [erro, definirErro] = useState("");
  const [estaCarregando, definirCarregamento] = useState(true);
  const [estaAEnviar, definirEnvio] = useState(false);

  useEffect(() => {
    let ativo = true;
    Promise.all([
      requisitarJson<ApiPage<Category>>("/api/public/categories/?parent=null"),
      requisitarJson<ApiPage<Municipality>>("/api/public/municipalities/"),
    ])
      .then(([paginaCategorias, paginaMunicipios]) => {
        if (ativo) {
          definirCategorias(paginaCategorias.results);
          definirMunicipios(paginaMunicipios.results);

          const parametros = new URLSearchParams(window.location.search);
          const categoriaPreSelecionada = parametros.get("category");
          if (
            categoriaPreSelecionada &&
            paginaCategorias.results.some(
              (item) => String(item.id) === categoriaPreSelecionada,
            )
          ) {
            setCategory(categoriaPreSelecionada);
          }
          setTitle(parametros.get("title")?.slice(0, 160) ?? "");
          definirDescricao(
            parametros.get("description")?.slice(0, 5000) ?? "",
          );
          definirPrestadorDeOrigem(
            parametros.get("source_provider")?.slice(0, 160) ?? "",
          );

          const minimo = parametros.get("minimum_budget") ?? "";
          const maximo = parametros.get("maximum_budget") ?? "";
          const duracao = parametros.get("duration") ?? "";
          if (/^\d+(\.\d{1,2})?$/.test(minimo)) setMinimumBudget(minimo);
          if (/^\d+(\.\d{1,2})?$/.test(maximo)) setMaximumBudget(maximo);
          if (/^\d{1,4}$/.test(duracao) && Number(duracao) <= 1440) {
            setDuration(duracao);
          }
        }
      })
      .catch((motivo: unknown) => {
        if (ativo) {
          definirErro(
            motivo instanceof Error
              ? motivo.message
              : "Não foi possível carregar os dados do formulário.",
          );
        }
      })
      .finally(() => {
        if (ativo) definirCarregamento(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  async function enviarFormulario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirErro("");
    definirEnvio(true);
    try {
      const respostaHttp = await fetch("/api/auth/orders/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: Number(categoria),
          title,
          description: descricao,
          municipality: Number(municipality),
          neighborhood,
          address,
          minimum_budget: minimumBudget || null,
          maximum_budget: maximumBudget || null,
          requested_duration_minutes: duration ? Number(duration) : null,
          requested_at: requestedAt ? new Date(requestedAt).toISOString() : null,
        }),
      });
      const dadosRecebidos: unknown = await respostaHttp.json();
      if (respostaHttp.status === 401) {
        const next = `${window.location.pathname}${window.location.search}`;
        navegador.replace(`/entrar?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!respostaHttp.ok) {
        definirErro(obterMensagemErro(dadosRecebidos));
        return;
      }
      navegador.replace("/pedidos");
    } catch {
      definirErro("Não foi possível contactar o serviço. Tenta novamente.");
    } finally {
      definirEnvio(false);
    }
  }

  return (
    <EstruturaAutenticacao account>
      <p className={styles.eyebrow}>Pedir um serviço</p>
      <h1>O que precisas?</h1>
      <p className={styles.intro}>
        Descreve o trabalho e a zona. O teu pedido ficará visível a prestadores
        elegíveis para que possam enviar propostas.
      </p>
      {prestadorDeOrigem && (
        <aside className={styles.requestContext}>
          <strong>Pedido iniciado a partir de {prestadorDeOrigem}</strong>
          <span>
            Os dados do serviço foram pré-preenchidos. Ao enviar, o pedido será
            partilhado com prestadores elegíveis na categoria e localização
            escolhidas, não apenas com este prestador.
          </span>
        </aside>
      )}
      {estaCarregando ? (
        <p className={styles.intro} aria-live="polite">
          A carregar categorias e municípios…
        </p>
      ) : (
        <form className={styles.form} onSubmit={enviarFormulario}>
          <label className={styles.field}>
            Categoria
            <select
              required
              value={categoria}
              onChange={(evento) => setCategory(evento.target.value)}
            >
              <option value="">Seleciona uma categoria</option>
              {categorias.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Título do pedido
            <input
              required
              maxLength={160}
              value={title}
              onChange={(evento) => setTitle(evento.target.value)}
              placeholder="Ex.: Instalar iluminação numa sala"
            />
          </label>
          <label className={styles.field}>
            Descreve o que precisas
            <textarea
              required
              maxLength={5000}
              rows={5}
              value={descricao}
              onChange={(evento) => definirDescricao(evento.target.value)}
              placeholder="Inclui detalhes que ajudem o profissional a preparar uma proposta."
            />
          </label>
          <label className={styles.field}>
            Município
            <select
              required
              value={municipality}
              onChange={(evento) => setMunicipality(evento.target.value)}
            >
              <option value="">Seleciona um município</option>
              {municipios.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Bairro <span>(opcional)</span>
            <input
              maxLength={120}
              value={neighborhood}
              onChange={(evento) => setNeighborhood(evento.target.value)}
            />
          </label>
          <label className={styles.field}>
            Morada <span>(opcional; visível apenas nas etapas apropriadas)</span>
            <input
              maxLength={250}
              value={address}
              onChange={(evento) => setAddress(evento.target.value)}
            />
          </label>
          <div className={styles.formRow}>
            <label className={styles.field}>
              Orçamento mínimo (AOA) <span>(opcional)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={minimumBudget}
                onChange={(evento) => setMinimumBudget(evento.target.value)}
              />
            </label>
            <label className={styles.field}>
              Orçamento máximo (AOA) <span>(opcional)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maximumBudget}
                onChange={(evento) => setMaximumBudget(evento.target.value)}
              />
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.field}>
              Duração estimada (minutos) <span>(opcional)</span>
              <input
                type="number"
                min="1"
                max="1440"
                value={duration}
                onChange={(evento) => setDuration(evento.target.value)}
              />
            </label>
            <label className={styles.field}>
              Data pretendida <span>(opcional)</span>
              <input
                type="datetime-local"
                value={requestedAt}
                onChange={(evento) => setRequestedAt(evento.target.value)}
              />
            </label>
          </div>
          {erro && (
            <p className={styles.notice} role="alert">
              {erro}
            </p>
          )}
          <button
            className={styles.submit}
            type="submit"
            disabled={estaAEnviar || !categorias.length || !municipios.length}
          >
            {estaAEnviar ? "A enviar pedido…" : "Enviar pedido"}
          </button>
        </form>
      )}
      <div className={styles.accountActions}>
        <Link className={styles.secondary} href="/pedidos">
          Ver os meus pedidos
        </Link>
      </div>
    </EstruturaAutenticacao>
  );
}
