"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Heart, Trash2 } from "lucide-react";
import BusinessLogo from "../components/business-logo";
import EstruturaAutenticacao from "../auth-shell";
import styles from "./favorites.module.css";

type FavoriteProvider = {
  id: number;
  provider: number;
  commercial_name: string;
};
type FavoriteService = {
  id: number;
  service: number;
  service_name: string;
  provider_name: string;
  minimum_price: string | null;
  maximum_price: string | null;
  currency: string;
};
type ApiPage<T> = { results: T[] };

function extrairMensagemErro(dados: unknown) {
  if (dados && typeof dados === "object" && "detail" in dados && typeof dados.detail === "string") {
    return dados.detail;
  }
  return "Não foi possível atualizar os favoritos.";
}

function formatarPreco(servico: FavoriteService) {
  if (servico.minimum_price === null) return "Preço sob consulta";
  const minimo = Number(servico.minimum_price);
  const maximo = servico.maximum_price === null ? null : Number(servico.maximum_price);
  const formatarValor = (valor: number) => new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: servico.currency || "AOA",
    maximumFractionDigits: 0,
  }).format(valor);
  return maximo !== null && maximo !== minimo
    ? `${formatarValor(minimo)} – ${formatarValor(maximo)}`
    : formatarValor(minimo);
}

export default function PaginaFavoritos() {
  const router = useRouter();
  const [prestadores, definirPrestadores] = useState<FavoriteProvider[]>([]);
  const [servicos, definirServicos] = useState<FavoriteService[]>([]);
  const [aCarregar, definirCarregamento] = useState(true);
  const [idEmRemocao, definirIdEmRemocao] = useState<string | null>(null);
  const [erro, definirErro] = useState("");

  useEffect(() => {
    let ativo = true;
    Promise.all([
      fetch("/api/auth/favorites/providers/", { cache: "no-store" }),
      fetch("/api/auth/favorites/services/", { cache: "no-store" }),
    ])
      .then(async ([prestadoresHttp, servicosHttp]) => {
        if ([prestadoresHttp, servicosHttp].some((resposta) => resposta.status === 401)) {
          router.replace("/entrar?next=%2Ffavoritos");
          return;
        }
        if ([prestadoresHttp, servicosHttp].some((resposta) => !resposta.ok)) {
          throw new Error("Não foi possível carregar os favoritos. Tenta novamente.");
        }
        const [paginaPrestadores, paginaServicos] = await Promise.all([
          prestadoresHttp.json() as Promise<ApiPage<FavoriteProvider>>,
          servicosHttp.json() as Promise<ApiPage<FavoriteService>>,
        ]);
        if (!ativo) return;
        definirPrestadores(paginaPrestadores.results ?? []);
        definirServicos(paginaServicos.results ?? []);
      })
      .catch((motivo: unknown) => {
        if (ativo) definirErro(motivo instanceof Error ? motivo.message : "Não foi possível carregar os favoritos.");
      })
      .finally(() => {
        if (ativo) definirCarregamento(false);
      });
    return () => { ativo = false; };
  }, [router]);

  async function removerFavorito(tipo: "providers" | "services", id: number) {
    const chave = `${tipo}-${id}`;
    definirIdEmRemocao(chave);
    definirErro("");
    try {
      const resposta = await fetch(`/api/auth/favorites/${tipo}/${id}/`, { method: "DELETE" });
      if (resposta.status === 401) {
        router.replace("/entrar?next=%2Ffavoritos");
        return;
      }
      if (!resposta.ok) {
        const dados: unknown = await resposta.json();
        throw new Error(extrairMensagemErro(dados));
      }
      if (tipo === "providers") {
        definirPrestadores((atuais) => atuais.filter((item) => item.id !== id));
      } else {
        definirServicos((atuais) => atuais.filter((item) => item.id !== id));
      }
    } catch (motivo) {
      definirErro(motivo instanceof Error ? motivo.message : "Não foi possível remover este favorito.");
    } finally {
      definirIdEmRemocao(null);
    }
  }

  const total = prestadores.length + servicos.length;

  return (
    <EstruturaAutenticacao account area="client" profileName="Cliente">
      <p className={styles.eyebrow}>A tua coleção</p>
      <h1>Favoritos</h1>
      <p className={styles.intro}>Guarda profissionais e serviços para os encontrares facilmente mais tarde.</p>
      {!aCarregar && <p className={styles.summary}>{total} {total === 1 ? "item guardado" : "itens guardados"}</p>}
      {erro && <p className={styles.error} role="alert">{erro}</p>}
      {aCarregar ? (
        <p className={styles.loading} role="status">A carregar os teus favoritos…</p>
      ) : total ? (
        <div className={styles.sections}>
          {prestadores.length > 0 && (
            <section aria-labelledby="favorite-providers-heading">
              <header className={styles.sectionHeading}>
                <div><p>Profissionais</p><h2 id="favorite-providers-heading">Prestadores guardados</h2></div>
                <span>{prestadores.length}</span>
              </header>
              <div className={styles.grid}>
                {prestadores.map((favorito) => (
                  <article className={styles.card} key={favorito.id}>
                    <BusinessLogo
                      className={styles.logo}
                      companyName={favorito.commercial_name}
                      width={58}
                      height={58}
                    />
                    <div className={styles.cardCopy}>
                      <strong>{favorito.commercial_name}</strong>
                      <span>Prestador de serviços</span>
                    </div>
                    <Link className={styles.open} href={`/prestadores/${favorito.provider}`} aria-label={`Ver perfil de ${favorito.commercial_name}`}>
                      <ArrowUpRight size={17} />
                    </Link>
                    <button
                      className={styles.remove}
                      type="button"
                      disabled={idEmRemocao === `providers-${favorito.id}`}
                      onClick={() => void removerFavorito("providers", favorito.id)}
                      aria-label={`Remover ${favorito.commercial_name} dos favoritos`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
          {servicos.length > 0 && (
            <section aria-labelledby="favorite-services-heading">
              <header className={styles.sectionHeading}>
                <div><p>Serviços</p><h2 id="favorite-services-heading">Serviços guardados</h2></div>
                <span>{servicos.length}</span>
              </header>
              <div className={styles.grid}>
                {servicos.map((favorito) => (
                  <article className={styles.card} key={favorito.id}>
                    <span className={styles.serviceIcon}><Heart size={20} aria-hidden="true" /></span>
                    <div className={styles.cardCopy}>
                      <strong>{favorito.service_name}</strong>
                      <span>{favorito.provider_name} · {formatarPreco(favorito)}</span>
                    </div>
                    <Link className={styles.open} href={`/servicos/${favorito.service}`} aria-label={`Ver serviço ${favorito.service_name}`}>
                      <ArrowUpRight size={17} />
                    </Link>
                    <button
                      className={styles.remove}
                      type="button"
                      disabled={idEmRemocao === `services-${favorito.id}`}
                      onClick={() => void removerFavorito("services", favorito.id)}
                      aria-label={`Remover ${favorito.service_name} dos favoritos`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <section className={styles.empty}>
          <span><Heart size={24} aria-hidden="true" /></span>
          <h2>Os teus favoritos aparecem aqui</h2>
          <p>Explora serviços e perfis profissionais e guarda os que queres consultar novamente.</p>
          <Link href="/explorar">Explorar serviços</Link>
        </section>
      )}
    </EstruturaAutenticacao>
  );
}
