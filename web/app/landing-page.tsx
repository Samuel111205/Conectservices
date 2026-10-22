"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { requisitarJson } from "@/lib/api-client";
import BusinessLogo from "@/app/components/business-logo";
import styles from "./page.module.css";

type ApiPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type Category = {
  id: number;
  name: string;
  description: string;
};

type Municipality = {
  id: number;
  name: string;
  province: number;
};

type Provider = {
  id: number;
  commercial_name: string;
  description: string;
  business_profile: {
    logo: string;
    website: string;
    opening_hours: Record<string, string>;
  } | null;
  active_service_count: number;
  average_rating: string | null;
  review_count: number;
};

type DiscoveryFilters = {
  search: string;
  category: string;
  municipality: string;
  ordering: string;
  page: number;
};

const filtrosIniciais: DiscoveryFilters = {
  search: "",
  category: "",
  municipality: "",
  ordering: "-rating",
  page: 1,
};

const imagensFundoHero = [
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1800&q=80",
];

const categoriasSugeridas = [
  {
    name: "Tecnologia e informática",
    description: "Reparação, suporte e soluções digitais",
  },
  {
    name: "Reparações e manutenção",
    description: "Assistência técnica para o dia a dia",
  },
  {
    name: "Consultoria",
    description: "Apoio para pessoas e empresas",
  },
  {
    name: "Design e marketing",
    description: "Marcas, conteúdos e divulgação",
  },
  {
    name: "Educação e formação",
    description: "Aulas, explicações e cursos",
  },
  {
    name: "Limpeza e organização",
    description: "Soluções para casa e escritório",
  },
];

const iconesCategoria = ["♡", "✂", "⚒", "▣", "➜", "♨", "▱", "⌂", "✦", "⋯"];

async function obterDadosApi<T>(
  endpoint: string,
  parametros?: URLSearchParams,
): Promise<T> {
  const consulta = parametros?.toString();
  const recurso = endpoint.replace(/^\/+|\/+$/g, "");
  return requisitarJson<T>(
    `/api/public/${recurso}${consulta ? `?${consulta}` : ""}`,
  );
}

function Icone({
  name,
  size = 20,
}: {
  name: "search" | "pin" | "arrow" | "spark" | "briefcase" | "menu";
  size?: number;
}) {
  const atributosSvg = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (name === "search") {
    return (
      <svg {...atributosSvg}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
    );
  }
  if (name === "pin") {
    return (
      <svg {...atributosSvg}>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }
  if (name === "arrow") {
    return (
      <svg {...atributosSvg}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    );
  }
  if (name === "spark") {
    return (
      <svg {...atributosSvg}>
        <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
        <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />
      </svg>
    );
  }
  if (name === "briefcase") {
    return (
      <svg {...atributosSvg}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-13 5h18m-11 0v2h4v-2" />
      </svg>
    );
  }
  return (
    <svg {...atributosSvg}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function formatarContagemAvaliacoes(quantidade: number) {
  if (quantidade === 1) return "1 avaliação";
  return `${quantidade} avaliações`;
}

export default function PaginaInicial({ appMode = false }: { appMode?: boolean }) {
  const [filtros, definirFiltros] = useState(filtrosIniciais);
  const [textoPesquisa, definirTextoPesquisa] = useState("");
  const [prestadores, definirPrestadores] = useState<Provider[]>([]);
  const [quantidadePrestadores, definirQuantidadePrestadores] = useState(0);
  const [temProximaPagina, definirProximaPagina] = useState(false);
  const [temPaginaAnterior, definirPaginaAnterior] = useState(false);
  const [estaCarregando, definirCarregamento] = useState(true);
  const [erroNaPesquisa, definirErroNaPesquisa] = useState("");
  const [categorias, definirCategorias] = useState<Category[]>([]);
  const [municipios, definirMunicipios] = useState<Municipality[]>([]);
  const [erroNosFiltros, definirErroNosFiltros] = useState("");
  const [tentativaFiltros, definirTentativaFiltros] = useState(0);
  const [menuMovelAberto, definirMenuMovelAberto] = useState(false);
  const [tentativas, definirTentativas] = useState(0);
  const [indiceImagemHero, definirIndiceImagemHero] = useState(0);

  useEffect(() => {
    const temporizador = window.setInterval(() => {
      definirIndiceImagemHero((atual) => (atual + 1) % imagensFundoHero.length);
    }, 5_000);

    return () => window.clearInterval(temporizador);
  }, []);

  useEffect(() => {
    let ativo = true;
    const parametros = new URLSearchParams({
      ordering: filtros.ordering,
      page: String(filtros.page),
    });
    if (filtros.search) parametros.set("search", filtros.search);
    if (filtros.category) parametros.set("category", filtros.category);
    if (filtros.municipality) parametros.set("municipality", filtros.municipality);

    obterDadosApi<ApiPage<Provider>>("/providers/discover/", parametros)
      .then((pagina) => {
        if (!ativo) return;
        definirPrestadores(pagina.results);
        definirQuantidadePrestadores(pagina.count);
        definirProximaPagina(Boolean(pagina.next));
        definirPaginaAnterior(Boolean(pagina.previous));
        definirErroNaPesquisa("");
      })
      .catch((erro: unknown) => {
        if (!ativo) return;
        definirErroNaPesquisa(
          erro instanceof Error
            ? erro.message
            : "Não foi possível carregar os prestadores.",
        );
        definirPrestadores([]);
        definirQuantidadePrestadores(0);
      })
      .finally(() => {
        if (ativo) definirCarregamento(false);
      });

    return () => {
      ativo = false;
    };
  }, [filtros, tentativas]);

  useEffect(() => {
    let ativo = true;

    async function carregarFiltros() {
      try {
        const [paginaCategorias, paginaMunicipios] = await Promise.all([
          obterDadosApi<ApiPage<Category>>(
            "/categories/",
            new URLSearchParams({ parent: "null" }),
          ),
          obterDadosApi<ApiPage<Municipality>>("/municipalities/"),
        ]);
        if (ativo) {
          definirErroNosFiltros("");
          definirCategorias(paginaCategorias.results);
          definirMunicipios(paginaMunicipios.results);
          const municipioLuanda = paginaMunicipios.results.find(
            (municipio) =>
              municipio.name.trim().toLocaleLowerCase("pt-AO") === "luanda",
          );
          if (municipioLuanda) {
            definirFiltros((atual) =>
              atual.municipality
                ? atual
                : { ...atual, municipality: String(municipioLuanda.id) },
            );
          }
        }
      } catch {
        if (ativo) {
          definirErroNosFiltros("Alguns filtros não estão disponíveis neste momento.");
        }
      }
    }

    void carregarFiltros();
    return () => {
      ativo = false;
    };
  }, [tentativaFiltros]);

  function enviarPesquisa(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirCarregamento(true);
    definirErroNaPesquisa("");
    definirFiltros((atual) => ({
      ...atual,
      search: textoPesquisa.trim(),
      page: 1,
    }));
  }

  function atualizarFiltro(
    chave: "category" | "municipality" | "ordering",
    valor: string,
  ) {
    definirCarregamento(true);
    definirErroNaPesquisa("");
    definirFiltros((atual) => ({ ...atual, [chave]: valor, page: 1 }));
  }

  function selecionarCategoria(idCategoria: string) {
    atualizarFiltro(
      "category",
      filtros.category === idCategoria ? "" : idCategoria,
    );
    document.getElementById("prestadores")?.scrollIntoView({ behavior: "smooth" });
  }

  function pesquisarCategoriaSugerida(nomeCategoria: string) {
    definirTextoPesquisa(nomeCategoria);
    definirCarregamento(true);
    definirErroNaPesquisa("");
    definirFiltros((atual) => ({
      ...atual,
      search: nomeCategoria,
      category: "",
      page: 1,
    }));
    document.getElementById("prestadores")?.scrollIntoView({ behavior: "smooth" });
  }

  const nomeCategoriaSelecionada = categorias.find(
    (categoria) => String(categoria.id) === filtros.category,
  )?.name;
  const nomeMunicipioSelecionado = municipios.find(
    (municipio) => String(municipio.id) === filtros.municipality,
  )?.name;
  const temFiltrosAtivos = Boolean(
    filtros.search || filtros.category || filtros.municipality,
  );
  const categoriasVisiveis = categorias.length
    ? categorias.slice(0, 10)
    : categoriasSugeridas;
  function limparFiltros() {
    definirTextoPesquisa("");
    definirCarregamento(true);
    definirErroNaPesquisa("");
    definirFiltros((atual) => ({
      ...atual,
      search: "",
      category: "",
      municipality: "",
      page: 1,
    }));
  }

  return (
    <main className={styles.site}>
      <div className={styles.homeShell}>
        <div className={styles.primaryColumn}>
          <header className={styles.header}>
            <Link
              className={styles.brand}
              href={appMode ? "/conta" : "/"}
              aria-label="Conect Services — início"
            >
              <span className={styles.brandMark} aria-hidden="true">C</span>
              <span className={styles.brandName}>
                Conect <span className={styles.brandAccent}>Services</span>
                <small>Conectando o mundo, movendo o futuro.</small>
              </span>
            </Link>

            <nav
              className={`${styles.navigation} ${menuMovelAberto ? styles.navigationOpen : ""}`}
              aria-label="Navegação principal"
            >
              <a href="#inicio" onClick={() => definirMenuMovelAberto(false)}>
                Início
              </a>
              <a href="#categorias" onClick={() => definirMenuMovelAberto(false)}>
                Serviços
              </a>
              <Link href="/produtos" onClick={() => definirMenuMovelAberto(false)}>
                Produtos
              </Link>
              <a href="#empresas" onClick={() => definirMenuMovelAberto(false)}>
                Empresas
              </a>
              <a href="#prestadores" onClick={() => definirMenuMovelAberto(false)}>
                Prestadores
              </a>
              <a href="#como-funciona" onClick={() => definirMenuMovelAberto(false)}>
                Como funciona
              </a>
            </nav>

            <div className={styles.headerActions}>
              {appMode ? (
                <Link className={styles.headerSearchButton} href="/conta">
                  A minha área
                </Link>
              ) : (
                <>
                  <Link className={styles.headerLogin} href="/entrar">
                    Entrar
                  </Link>
                  <Link className={styles.headerSearchButton} href="/registar">
                    Criar conta
                  </Link>
                </>
              )}
            </div>

            <button
              className={styles.menuButton}
              type="button"
              aria-label={menuMovelAberto ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuMovelAberto}
              onClick={() => definirMenuMovelAberto((open) => !open)}
            >
              <Icone name="menu" />
            </button>
          </header>

          <section className={styles.hero} id="inicio">
            <div className={styles.heroBackgrounds} aria-hidden="true">
              {imagensFundoHero.map((imagem, indice) => (
                <div
                  key={imagem}
                  className={`${styles.heroBackground} ${indice === indiceImagemHero ? styles.heroBackgroundActive : ""}`}
                  style={{ backgroundImage: `url("${imagem}")` }}
                />
              ))}
            </div>
            <div className={styles.heroContent}>
              <div className={styles.eyebrow}>
                <span className={styles.eyebrowLine} />
                Serviços locais, ligações de confiança
              </div>
              <h1>
                Encontre os melhores serviços em <span>Angola.</span>
              </h1>
              <p className={styles.heroDescription}>
                Conectamos clientes, pequenas e médias empresas e prestadores de
                serviços, num só lugar.
              </p>
              <form
                className={styles.searchPanel}
                id="pesquisa"
                onSubmit={enviarPesquisa}
              >
                <label className={styles.searchField}>
                  <Icone name="search" size={20} />
                  <span className={styles.visuallyHidden}>Que serviço procura?</span>
                  <input
                    type="search"
                    placeholder="O que você procura?"
                    value={textoPesquisa}
                    onChange={(evento) => definirTextoPesquisa(evento.target.value)}
                  />
                </label>
                <label className={styles.searchField}>
                  <Icone name="pin" size={20} />
                  <span className={styles.visuallyHidden}>Localização</span>
                  <select
                    value={filtros.municipality}
                    onChange={(evento) =>
                      atualizarFiltro("municipality", evento.target.value)
                    }
                  >
                    <option value="">Todas as localizações</option>
                    {municipios.map((municipality) => (
                      <option key={municipality.id} value={municipality.id}>
                        {municipality.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className={styles.searchButton} type="submit">
                  Pesquisar
                </button>
              </form>
              {erroNosFiltros && (
                <div className={styles.filterNotice} role="status">
                  <span>{erroNosFiltros}</span>
                  <button
                    type="button"
                    onClick={() => definirTentativaFiltros((tentativa) => tentativa + 1)}
                  >
                    Atualizar filtros
                  </button>
                </div>
              )}
              <div className={styles.searchExamples}>
                <span>Exemplos:</span>
                {categoriasSugeridas.slice(0, 6).map((categoria) => (
                  <button
                    key={categoria.name}
                    type="button"
                    onClick={() => pesquisarCategoriaSugerida(categoria.name)}
                  >
                    {categoria.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.heroVisual}>
              <div className={styles.heroFeatureCard}>
                <span className={styles.featureEyebrow}>Conect Services</span>
                <h2>Serviços mais perto de si</h2>
                <ul>
                  <li><span>✓</span> Rápido</li>
                  <li><span>✓</span> Seguro</li>
                  <li><span>✓</span> Confiável</li>
                </ul>
              </div>
            </div>
          </section>

          <section className={styles.categorySection} id="categorias">
            <div className={styles.sectionHeading}>
              <div>
                <div className={styles.sectionKicker}>Explore por categoria</div>
                <h2>O que você precisa hoje?</h2>
              </div>
              <a href="#prestadores" className={styles.textLink}>
                Ver todos <Icone name="arrow" size={16} />
              </a>
            </div>
            <div className={styles.categoryList}>
              {categoriasVisiveis.map((categoria, index) => {
                const idCategoria = "id" in categoria ? String(categoria.id) : "";
                const categoriaSelecionada =
                  Boolean(idCategoria) && filtros.category === idCategoria;
                return (
                  <button
                    className={`${styles.categoryCard} ${categoriaSelecionada ? styles.categorySelected : ""}`}
                    key={categoria.name}
                    type="button"
                    onClick={() =>
                      idCategoria
                        ? selecionarCategoria(idCategoria)
                        : pesquisarCategoriaSugerida(categoria.name)
                    }
                  >
                    <span className={`${styles.categoryIcon} ${styles[`categoryIcon${index % 4}`]}`} aria-hidden="true">
                      {iconesCategoria[index % iconesCategoria.length]}
                    </span>
                    <span className={styles.categoryName}>{categoria.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={styles.providerSection} id="prestadores">
            <div className={styles.sectionHeading}>
              <div id="empresas">
                <div className={styles.sectionKicker}>Perto de si</div>
                <h2>
                  Empresas e prestadores de serviços
                  {nomeCategoriaSelecionada ? <span className={styles.titleFilter}> · {nomeCategoriaSelecionada}</span> : null}
                </h2>
              </div>
              <label className={styles.sortLabel}>
                Ordenar por
                <select value={filtros.ordering} onChange={(evento) => atualizarFiltro("ordering", evento.target.value)}>
                  <option value="-rating">Melhor avaliação</option>
                  <option value="-services">Mais serviços</option>
                  <option value="name">Nome A–Z</option>
                </select>
              </label>
            </div>

            {temFiltrosAtivos && (
              <div className={styles.activeFilters} aria-live="polite">
                <div className={styles.activeFilterList}>
                  <span className={styles.activeFilterLabel}>Filtros ativos</span>
                  {filtros.search && <span className={styles.activeFilter}>Pesquisa: “{filtros.search}”</span>}
                  {nomeCategoriaSelecionada && <span className={styles.activeFilter}>Categoria: {nomeCategoriaSelecionada}</span>}
                  {nomeMunicipioSelecionado && <span className={styles.activeFilter}>Localização: {nomeMunicipioSelecionado}</span>}
                </div>
                <button className={styles.clearFiltersButton} type="button" onClick={limparFiltros}>Limpar filtros</button>
              </div>
            )}

            {erroNaPesquisa ? (
              <div className={styles.statusPanel} role="alert">
                <span className={styles.statusIcon}>!</span>
                <div>
                  <strong>Não foi possível carregar os prestadores.</strong>
                  <p>A API não respondeu como esperado. Verifique a ligação e tente novamente.</p>
                </div>
                <button type="button" onClick={() => {
                  definirCarregamento(true);
                  definirErroNaPesquisa("");
                  definirTentativas((quantidade) => quantidade + 1);
                }}>Tentar novamente</button>
              </div>
            ) : estaCarregando ? (
              <div className={styles.loadingGrid} aria-label="A carregar prestadores">
                {[0, 1, 2, 3].map((item) => <div className={styles.skeletonCard} key={item}><span /><span /><span /></div>)}
              </div>
            ) : prestadores.length ? (
              <>
                <div className={styles.providerGrid}>
                  {prestadores.slice(0, 8).map((prestador) => (
                    <article className={styles.providerCard} key={prestador.id}>
                      <div className={styles.providerCardHeader}>
                        {prestador.business_profile ? (
                          <BusinessLogo
                            className={styles.providerAvatarImage}
                            companyName={prestador.commercial_name}
                            logoUrl={prestador.business_profile.logo}
                            width={52}
                            height={52}
                          />
                        ) : (
                          <div className={styles.providerAvatar}>{prestador.commercial_name.slice(0, 1).toLocaleUpperCase("pt-AO")}</div>
                        )}
                        <div className={styles.providerBadges}>
                          {prestador.business_profile && <span className={styles.providerType}>Empresa</span>}
                          <span className={styles.providerVerified}><span /> Verificado</span>
                        </div>
                      </div>
                      <h3>{prestador.commercial_name}</h3>
                      <p className={styles.providerDescription}>{prestador.description || "Prestador de serviços em Angola."}</p>
                      <div className={styles.providerStats}>
                        <span className={styles.providerRating}><span aria-label="avaliação média">★</span> {prestador.average_rating ?? "Novo"}</span>
                        <span>{formatarContagemAvaliacoes(prestador.review_count)}</span>
                        <span>{prestador.active_service_count} {prestador.active_service_count === 1 ? "serviço" : "serviços"}</span>
                      </div>
                      <Link className={styles.providerLink} href={`/prestadores/${prestador.id}`}>
                        Ver perfil <Icone name="arrow" size={16} />
                      </Link>
                    </article>
                  ))}
                </div>
                <div className={styles.pagination}>
                  <span>{quantidadePrestadores} empresas e prestadores encontrados</span>
                  <div>
                    <button type="button" disabled={!temPaginaAnterior} onClick={() => {
                      definirCarregamento(true);
                      definirFiltros((atual) => ({ ...atual, page: Math.max(1, atual.page - 1) }));
                    }}>Anterior</button>
                    <span>Página {filtros.page}</span>
                    <button type="button" disabled={!temProximaPagina} onClick={() => {
                      definirCarregamento(true);
                      definirFiltros((atual) => ({ ...atual, page: atual.page + 1 }));
                    }}>Seguinte</button>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}><Icone name="search" size={24} /></span>
                <h3>A sua próxima boa escolha começa aqui.</h3>
                <p>{temFiltrosAtivos
                  ? "Ainda não encontramos empresas ou prestadores com estes filtros. Experimente ajustar a pesquisa."
                  : "Estamos a preparar a comunidade de empresas e prestadores verificados. Volte em breve para descobrir quem pode ajudar."}</p>
                {temFiltrosAtivos && <button type="button" onClick={limparFiltros}>Limpar pesquisa</button>}
              </div>
            )}
          </section>

          <section className={styles.howItWorks} id="como-funciona" aria-labelledby="how-it-works-title">
            <div className={styles.howItWorksIntro}>
              <span>Como funciona</span>
              <h2 id="how-it-works-title">Encontre, compare e entre em contacto.</h2>
              <p>A plataforma aproxima clientes, empresas e profissionais. O contacto e os detalhes do serviço são combinados diretamente entre as partes.</p>
            </div>
            <ol className={styles.howItWorksSteps}>
              <li>
                <span>1</span>
                <div><strong>Pesquise o que precisa</strong><p>Escolha um serviço e indique a localização.</p></div>
              </li>
              <li>
                <span>2</span>
                <div><strong>Compare perfis</strong><p>Consulte empresas, profissionais e serviços publicados.</p></div>
              </li>
              <li>
                <span>3</span>
                <div><strong>Entre em contacto</strong><p>Fale diretamente com quem pode prestar o serviço.</p></div>
              </li>
            </ol>
          </section>

          <section className={styles.finalCta} id="tornar-prestador">
            <div>
              <span>Conect Services</span>
              <h2>Faça parte da Conect Services</h2>
              <p>Seja cliente, prestador ou empresa. Juntos, movemos o futuro de Angola.</p>
            </div>
            <div className={styles.audienceLinks}>
              <Link href="/registar">Sou cliente</Link>
              <Link href="/perfil">Sou prestador</Link>
              <Link href="/empresa">Sou empresa</Link>
            </div>
          </section>

          <footer className={styles.footer}>
            <Link className={styles.footerBrand} href={appMode ? "/conta" : "/"}>Conect Services</Link>
            <span>Ligando pessoas, profissionais e empresas em Angola.</span>
            <span>© {new Date().getFullYear()} Conect Services</span>
          </footer>
        </div>


      </div>
    </main>
  );
}
