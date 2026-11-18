"use client";

import { useEffect, useState } from "react";
import Link from "@/lib/link";
import { requisitarJson } from "@/lib/api-client";
import BusinessLogo from "@/app/components/business-logo";
import styles from "./directory.module.css";

const audiences = {
  providers: {
    title: "Prestadores de serviços",
    label: "Prestador",
    description: "Profissionais verificados, prontos para ajudar.",
    empty: "Ainda não há prestadores verificados nesta área.",
  },
  companies: {
    title: "Empresas",
    label: "Empresa",
    description: "Empresas verificadas que prestam serviços em Angola.",
    empty: "Ainda não há empresas verificadas nesta área.",
  },
  entrepreneurs: {
    title: "Empreendedores",
    label: "Empreendedor",
    description: "Negócios individuais e trabalhadores por conta própria.",
    empty: "Ainda não há empreendedores verificados nesta área.",
  },
};

const directoryLinks = [
  { audience: "providers", href: "/prestadores", label: "Prestadores" },
  { audience: "companies", href: "/empresas", label: "Empresas" },
  { audience: "entrepreneurs", href: "/empreendedores", label: "Empreendedores" },
];

function pluralizar(quantidade, singular, plural) {
  return `${Number(quantidade || 0).toLocaleString("pt-AO")} ${
    quantidade === 1 ? singular : plural
  }`;
}

export function DirectoryNavigation({ current }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} href="/" aria-label="Conect Services — início">
          <span className={styles.brandMark} aria-hidden="true">C</span>
          <span>Conect <strong>Services</strong></span>
        </Link>
        <nav className={styles.navigation} aria-label="Vitrines">
          <Link href="/" className={styles.homeLink}>Início</Link>
          {directoryLinks.map(({ audience, href, label }) => (
            <Link
              key={audience}
              href={href}
              aria-current={current === audience ? "page" : undefined}
              className={current === audience ? styles.navigationActive : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link className={styles.accountLink} href="/entrar">Entrar</Link>
      </div>
    </header>
  );
}

export function ProviderCard({ provider, audience }) {
  const config = audiences[audience];
  const rating = Number(provider.average_rating);

  return (
    <article className={styles.listingCard}>
      <div className={styles.cardTop}>
        <BusinessLogo
          className={styles.avatar}
          companyName={provider.commercial_name}
          logoUrl={provider.business_profile?.logo}
          width={56}
          height={56}
        />
        <div className={styles.badges}>
          <span className={styles.typeBadge}>
            {config.label}
          </span>
          <span className={styles.verifiedBadge}>
            <span aria-hidden="true" />
            Verificado
          </span>
        </div>
      </div>
      <h3 title={provider.commercial_name}>{provider.commercial_name}</h3>
      <p className={styles.description}>
        {provider.description || "Perfil verificado na Conect Services."}
      </p>
      <div className={styles.cardStats} aria-label="Informações do perfil">
        <span className={styles.rating}>
          <span aria-hidden="true">★</span>
          {rating > 0 ? rating.toFixed(1) : "Novo"}
        </span>
        <span>{pluralizar(provider.review_count, "avaliação", "avaliações")}</span>
        <span>{pluralizar(provider.active_service_count, "serviço", "serviços")}</span>
      </div>
      <Link className={styles.profileLink} href={`/prestadores/${provider.id}`}>
        Ver perfil
      </Link>
    </article>
  );
}

export function DirectorySection({
  audience,
  compact = false,
  query = "",
  category = "",
  municipality = "",
}) {
  const config = audiences[audience];
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("-views");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      audience,
      ordering,
      page: String(compact ? 1 : page),
    });
    if (query.trim()) params.set("search", query.trim());
    if (category) params.set("category", category);
    if (municipality) params.set("municipality", municipality);

    setLoading(true);
    setError("");
    requisitarJson(`/api/public/providers/discover/?${params}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        let visibleResults = response.results;
        if (
          compact &&
          audience === "companies" &&
          response.count > response.results.length
        ) {
          const pageCount = Math.ceil(response.count / response.results.length);
          const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
          const rotatingPage = (week % (pageCount - 1)) + 2;
          params.set("page", String(rotatingPage));
          const rotatingResults = await requisitarJson(
            `/api/public/providers/discover/?${params}`,
            { signal: controller.signal },
          );
          visibleResults = [
            ...response.results.slice(0, 3),
            ...rotatingResults.results.slice(0, 1),
          ];
        }
        setResults(visibleResults);
        setTotal(response.count);
        setHasNext(Boolean(response.next));
        setHasPrevious(Boolean(response.previous));
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar esta lista.",
        );
        setResults([]);
        setTotal(0);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [audience, category, compact, municipality, ordering, page, query, retry]);

  function atualizarOrdenacao(value) {
    setPage(1);
    setOrdering(value);
  }

  const visibleResults = compact ? results.slice(0, 4) : results;

  return (
    <section
      className={`${styles.directorySection} ${compact ? styles.previewSection : ""}`}
      id={
        compact
          ? audience === "companies" ? "empresas" : audience
          : undefined
      }
      aria-labelledby={`${audience}-heading`}
    >
      <div className={styles.sectionHeading}>
        <div>
          {compact && <p className={styles.eyebrow}>Perfis verificados</p>}
          <h2 id={`${audience}-heading`}>{config.title}</h2>
          <p>{compact ? config.description : pluralizar(total, "perfil verificado", "perfis verificados")}</p>
        </div>
        {compact ? (
          <Link className={styles.viewAllLink} href={directoryLinks.find((item) => item.audience === audience).href}>
            Ver todos
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <label className={styles.sortControl}>
            Ordenar por
            <select
              value={ordering}
              onChange={(event) => atualizarOrdenacao(event.target.value)}
            >
              <option value="-views">Mais visitados</option>
              <option value="-rating">Melhor avaliados</option>
              <option value="name">Nome (A–Z)</option>
            </select>
          </label>
        )}
      </div>

      {error ? (
        <div className={styles.feedback} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Tentar novamente
          </button>
        </div>
      ) : loading ? (
        <div className={styles.listingGrid} aria-label={`A carregar ${config.title.toLocaleLowerCase("pt-AO")}`}>
          {Array.from({ length: compact ? 4 : 8 }, (_, index) => (
            <div className={styles.skeletonCard} key={index} aria-hidden="true" />
          ))}
        </div>
      ) : visibleResults.length ? (
        <div className={styles.listingGrid}>
          {visibleResults.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              audience={audience}
            />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden="true">⌕</span>
          <h3>{query ? "Não encontrámos resultados" : "Em breve, mais opções"}</h3>
          <p>{query ? "Experimenta pesquisar por outro nome ou serviço." : config.empty}</p>
        </div>
      )}

      {!compact && !error && !loading && total > 0 && (
        <div className={styles.pagination}>
          <span>
            Página {page} · {pluralizar(total, "perfil", "perfis")}
          </span>
          <div>
            <button
              type="button"
              disabled={!hasPrevious}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => setPage((value) => value + 1)}
            >
              Seguinte
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function DirectoryPage({ audience }) {
  const config = audiences[audience];
  const [search, setSearch] = useState(() => (
    new URLSearchParams(window.location.search).get("q") || ""
  ));
  const [query, setQuery] = useState(search);

  return (
    <main className={styles.page}>
      <DirectoryNavigation current={audience} />
      <section className={styles.directoryHero}>
        <div className={styles.pageContainer}>
          <p className={styles.eyebrow}>Conect Services · Angola</p>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
      </section>
      <div className={styles.pageContainer}>
        <form
          className={styles.directorySearch}
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
          }}
        >
          <label htmlFor="directory-search">Pesquisar nesta lista</label>
          <div>
            <input
              id="directory-search"
              type="search"
              placeholder="Nome, serviço ou especialidade"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit">Pesquisar</button>
          </div>
        </form>
        <DirectorySection audience={audience} query={query} />
      </div>
    </main>
  );
}
