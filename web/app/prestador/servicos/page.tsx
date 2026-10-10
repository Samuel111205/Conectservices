"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import EstruturaAutenticacao from "../../auth-shell";
import styles from "../../auth.module.css";

type Category = { id: number; name: string };
type Service = {
  id: number;
  category: number;
  name: string;
  description: string;
  minimum_price: string | null;
  maximum_price: string | null;
  currency: string;
  price_type: "FIXED" | "STARTING_AT" | "RANGE" | "ON_REQUEST";
  duration_minutes: number | null;
  is_active: boolean;
};
type Provider = { verification_status: string };
type ApiPage<T> = { results: T[] };

const tiposPreco = [
  { value: "FIXED", label: "Preço fixo" },
  { value: "STARTING_AT", label: "A partir de" },
  { value: "RANGE", label: "Faixa de preço" },
  { value: "ON_REQUEST", label: "Sob consulta" },
] as const;

function obterMensagemErro(dados: unknown) {
  if (dados && typeof dados === "object") {
    const mensagens = Object.values(dados).flatMap((valor) =>
      Array.isArray(valor) ? valor : [valor],
    );
    const mensagem = mensagens.find((valor) => typeof valor === "string");
    if (typeof mensagem === "string") return mensagem;
  }
  return "Não foi possível concluir a operação. Confirma os dados e tenta novamente.";
}

function formatarPreco(servico: Service) {
  if (servico.price_type === "ON_REQUEST" || servico.minimum_price === null) {
    return "Preço sob consulta";
  }
  const minimo = Number(servico.minimum_price).toLocaleString("pt-AO");
  if (servico.price_type === "RANGE" && servico.maximum_price !== null) {
    return `${minimo}–${Number(servico.maximum_price).toLocaleString("pt-AO")} ${servico.currency}`;
  }
  if (servico.price_type === "STARTING_AT") {
    return `Desde ${minimo} ${servico.currency}`;
  }
  return `${minimo} ${servico.currency}`;
}

export default function PaginaServicosPrestador() {
  const navegador = useRouter();
  const [categorias, definirCategorias] = useState<Category[]>([]);
  const [servicos, definirServicos] = useState<Service[]>([]);
  const [prestador, definirPrestador] = useState<Provider | null>(null);
  const [estaCarregando, definirCarregamento] = useState(true);
  const [erro, definirErro] = useState("");
  const [aGuardar, definirGravacao] = useState(false);
  const [idEmAtualizacao, definirIdEmAtualizacao] = useState<number | null>(null);
  const [idEmAlteracao, definirIdEmAlteracao] = useState<number | null>(null);
  const [erroFormulario, definirErroFormulario] = useState("");
  const [categoria, definirCategoria] = useState("");
  const [nome, definirNome] = useState("");
  const [descricao, definirDescricao] = useState("");
  const [tipoPreco, definirTipoPreco] =
    useState<Service["price_type"]>("FIXED");
  const [precoMinimo, definirPrecoMinimo] = useState("");
  const [precoMaximo, definirPrecoMaximo] = useState("");
  const [duracao, definirDuracao] = useState("");
  const [ativo, definirAtivo] = useState(true);

  const prestadorVerificado =
    prestador?.verification_status === "VERIFIED";

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch("/api/auth/services/", { cache: "no-store" }),
      fetch("/api/auth/providers/me/", { cache: "no-store" }),
      fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000/api/v1"}/categories/?parent=null`,
        { headers: { Accept: "application/json" }, cache: "no-store" },
      ),
    ])
      .then(async ([respostaServicos, respostaPrestador, respostaCategorias]) => {
        if (respostaServicos.status === 401 || respostaPrestador.status === 401) {
          navegador.replace("/entrar?next=%2Fprestador%2Fservicos");
          return;
        }
        if (
          !respostaServicos.ok ||
          (!respostaPrestador.ok && respostaPrestador.status !== 404) ||
          !respostaCategorias.ok
        ) {
          throw new Error("Não foi possível carregar os serviços e categorias.");
        }
        const [paginaServicos, dadosPrestador, paginaCategorias] =
          (await Promise.all([
            respostaServicos.json(),
            respostaPrestador.status === 404
              ? Promise.resolve(null)
              : respostaPrestador.json(),
            respostaCategorias.json(),
          ])) as [ApiPage<Service>, Provider | null, ApiPage<Category>];
        if (!mounted) return;
        definirServicos(paginaServicos.results);
        definirPrestador(dadosPrestador);
        definirCategorias(paginaCategorias.results);
        definirCategoria(
          paginaCategorias.results[0]
            ? String(paginaCategorias.results[0].id)
            : "",
        );
      })
      .catch((motivo: unknown) => {
        if (mounted) {
          definirErro(
            motivo instanceof Error
              ? motivo.message
              : "Não foi possível carregar os serviços.",
          );
        }
      })
      .finally(() => {
        if (mounted) definirCarregamento(false);
      });
    return () => {
      mounted = false;
    };
  }, [navegador]);

  function prepararEdicao(servico: Service) {
    definirIdEmAtualizacao(servico.id);
    definirErroFormulario("");
    definirCategoria(String(servico.category));
    definirNome(servico.name);
    definirDescricao(servico.description);
    definirTipoPreco(servico.price_type);
    definirPrecoMinimo(servico.minimum_price ?? "");
    definirPrecoMaximo(servico.maximum_price ?? "");
    definirDuracao(servico.duration_minutes ? String(servico.duration_minutes) : "");
    definirAtivo(servico.is_active);
    document.getElementById("formulario-servico")?.scrollIntoView({ behavior: "smooth" });
  }

  function limparFormulario() {
    definirIdEmAtualizacao(null);
    definirErroFormulario("");
    definirNome("");
    definirDescricao("");
    definirTipoPreco("FIXED");
    definirPrecoMinimo("");
    definirPrecoMaximo("");
    definirDuracao("");
    definirAtivo(prestadorVerificado);
  }

  async function guardarServico(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirErroFormulario("");
    definirGravacao(true);
    const payload = {
      category: Number(categoria),
      name,
      description: descricao,
      minimum_price:
        tipoPreco === "ON_REQUEST" || !precoMinimo ? null : precoMinimo,
      maximum_price:
        tipoPreco === "FIXED"
          ? precoMinimo || null
          : tipoPreco === "RANGE" && precoMaximo
            ? precoMaximo
            : null,
      currency: "AOA",
      price_type: tipoPreco,
      duration_minutes: duracao ? Number(duracao) : null,
      is_active: ativo,
    };

    try {
      const resposta = await fetch(
        idEmAtualizacao
          ? `/api/auth/services/${idEmAtualizacao}/`
          : "/api/auth/services/",
        {
          method: idEmAtualizacao ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const dados: unknown = await resposta.json();
      if (resposta.status === 401) {
        navegador.replace("/entrar?next=%2Fprestador%2Fservicos");
        return;
      }
      if (!resposta.ok) {
        definirErroFormulario(obterMensagemErro(dados));
        return;
      }
      const servicoGuardado = dados as Service;
      definirServicos((atuais) => {
        const semServicoGuardado = atuais.filter(
          (servico) => servico.id !== servicoGuardado.id,
        );
        return [...semServicoGuardado, servicoGuardado].sort((a, b) =>
          a.name.localeCompare(b.name, "pt"),
        );
      });
      limparFormulario();
    } catch {
      definirErroFormulario("Não foi possível contactar o serviço.");
    } finally {
      definirGravacao(false);
    }
  }

  async function alternarEstado(servico: Service) {
    definirIdEmAlteracao(servico.id);
    definirErro("");
    try {
      const resposta = await fetch(`/api/auth/services/${servico.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !servico.is_active }),
      });
      const dados: unknown = await resposta.json();
      if (resposta.status === 401) {
        navegador.replace("/entrar?next=%2Fprestador%2Fservicos");
        return;
      }
      if (!resposta.ok) {
        definirErro(obterMensagemErro(dados));
        return;
      }
      const atualizado = dados as Service;
      definirServicos((atuais) =>
        atuais.map((item) => (item.id === atualizado.id ? atualizado : item)),
      );
    } catch {
      definirErro("Não foi possível contactar o serviço.");
    } finally {
      definirIdEmAlteracao(null);
    }
  }

  return (
    <EstruturaAutenticacao account>
      <p className={styles.eyebrow}>Área do prestador</p>
      <h1>Os meus serviços</h1>
      <p className={styles.intro}>
        Publica e mantém atualizada a lista de serviços que os clientes podem
        encontrar no catálogo.
      </p>
      <div className={styles.accountActions}>
        <Link className={styles.secondary} href="/perfil">
          Gerir perfil profissional
        </Link>
        <Link className={styles.secondary} href="/prestador/pedidos">
          Ver pedidos disponíveis
        </Link>
      </div>
      {estaCarregando ? (
        <p className={styles.intro} aria-live="polite">A carregar serviços…</p>
      ) : erro ? (
        <p className={styles.notice} role="alert">{erro}</p>
      ) : !prestador ? (
        <section className={styles.profileSection}>
          <h2>Cria primeiro o teu perfil profissional</h2>
          <p className={styles.profileHint}>
            O perfil profissional é necessário para poderes gerir serviços.
          </p>
          <Link className={styles.submit} href="/perfil">
            Criar perfil profissional
          </Link>
        </section>
      ) : (
        <>
          {!prestadorVerificado && (
            <p className={styles.notice} role="status">
              O teu perfil ainda não está verificado. Podes guardar serviços como
              rascunho, mas só os perfis verificados podem publicá-los.
            </p>
          )}
          <section className={styles.profileSection}>
            <div className={styles.profileHeading}>
              <h2>Serviços publicados e rascunhos</h2>
              <span className={styles.profileBadge}>{servicos.length} no total</span>
            </div>
            {servicos.length ? (
              <div className={styles.managedServiceList}>
                {servicos.map((servico) => (
                  <article className={styles.managedService} key={servico.id}>
                    <div>
                      <div className={styles.profileHeading}>
                        <h3>{servico.name}</h3>
                        <span className={styles.profileBadge}>
                          {servico.is_active ? "Publicado" : "Rascunho"}
                        </span>
                      </div>
                      <p>{servico.description || "Sem descrição."}</p>
                      <small>
                        {categorias.find((item) => item.id === servico.category)?.name ?? "Categoria"} ·{" "}
                        {formatarPreco(servico)}
                        {servico.duration_minutes
                          ? ` · ${servico.duration_minutes} min`
                          : ""}
                      </small>
                    </div>
                    <div className={styles.managedServiceActions}>
                      <button
                        className={styles.secondary}
                        type="button"
                        onClick={() => prepararEdicao(servico)}
                      >
                        Editar
                      </button>
                      <button
                        className={styles.secondary}
                        type="button"
                        disabled={idEmAlteracao === servico.id}
                        onClick={() => void alternarEstado(servico)}
                      >
                        {idEmAlteracao === servico.id
                          ? "A atualizar…"
                          : servico.is_active
                            ? "Despublicar"
                            : "Publicar"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.profileHint}>
                Ainda não tens serviços. Usa o formulário abaixo para criar o primeiro.
              </p>
            )}
          </section>

          <section className={styles.profileSection} id="formulario-servico">
            <div className={styles.profileHeading}>
              <h2>{idEmAtualizacao ? "Editar serviço" : "Adicionar serviço"}</h2>
              {idEmAtualizacao && (
                <button className={styles.secondary} type="button" onClick={limparFormulario}>
                  Cancelar edição
                </button>
              )}
            </div>
            <form className={styles.form} onSubmit={guardarServico}>
              <label className={styles.field}>
                Categoria
                <select required value={categoria} onChange={(evento) => definirCategoria(evento.target.value)}>
                  {categorias.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Nome do serviço
                <input required maxLength={160} value={nome} onChange={(evento) => definirNome(evento.target.value)} />
              </label>
              <label className={styles.field}>
                Descrição <span>(opcional)</span>
                <textarea maxLength={5000} rows={4} value={descricao} onChange={(evento) => definirDescricao(evento.target.value)} />
              </label>
              <label className={styles.field}>
                Tipo de preço
                <select value={tipoPreco} onChange={(evento) => definirTipoPreco(evento.target.value as Service["price_type"])}>
                  {tiposPreco.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </label>
              {tipoPreco !== "ON_REQUEST" && (
                <div className={styles.formRow}>
                  <label className={styles.field}>
                    {tipoPreco === "STARTING_AT" ? "Preço inicial (AOA)" : "Preço mínimo (AOA)"}
                    <input required type="number" min="0" step="0.01" value={precoMinimo} onChange={(evento) => definirPrecoMinimo(evento.target.value)} />
                  </label>
                  {tipoPreco === "RANGE" && (
                    <label className={styles.field}>
                      Preço máximo (AOA)
                      <input required type="number" min="0" step="0.01" value={precoMaximo} onChange={(evento) => definirPrecoMaximo(evento.target.value)} />
                    </label>
                  )}
                </div>
              )}
              <label className={styles.field}>
                Duração estimada em minutos <span>(opcional)</span>
                <input type="number" min="1" max="1440" value={duracao} onChange={(evento) => definirDuracao(evento.target.value)} />
              </label>
              <label className={styles.checkboxField}>
                <input
                  type="checkbox"
                  checked={ativo}
                  disabled={!prestadorVerificado}
                  onChange={(evento) => definirAtivo(evento.target.checked)}
                />
                Publicar este serviço no catálogo
              </label>
              {erroFormulario && <p className={styles.notice} role="alert">{erroFormulario}</p>}
              <button className={styles.submit} type="submit" disabled={aGuardar || !categorias.length}>
                {aGuardar ? "A guardar…" : idEmAtualizacao ? "Guardar alterações" : "Criar serviço"}
              </button>
            </form>
          </section>
        </>
      )}
    </EstruturaAutenticacao>
  );
}
