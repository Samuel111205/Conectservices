"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
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
  active_service_count: number;
  average_rating: string | null;
  review_count: number;
};

type Service = {
  id: number;
  category: number;
  name: string;
  description: string;
  minimum_price: string | null;
  maximum_price: string | null;
  currency: string;
  price_type: string;
  duration_minutes: number | null;
};

type DiscoveryFilters = {
  search: string;
  category: string;
  municipality: string;
  ordering: string;
  page: number;
};

const URL_BASE_API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000/api/v1";

const filtrosIniciais: DiscoveryFilters = {
  search: "",
  category: "",
  municipality: "",
  ordering: "-rating",
  page: 1,
};

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

async function obterDadosApi<T>(
  endpoint: string,
  parametros?: URLSearchParams,
): Promise<T> {
  const consulta = parametros?.toString();
  const respostaHttp = await fetch(
    `${URL_BASE_API}${endpoint}${consulta ? `?${consulta}` : ""}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );

  if (!respostaHttp.ok) {
    throw new Error(`A API respondeu com o erro ${respostaHttp.status}.`);
  }

  return respostaHttp.json() as Promise<T>;
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

function formatarPrecoServico(servico: Service) {
  if (servico.price_type === "ON_REQUEST" || servico.minimum_price === null) {
    return "Preço sob consulta";
  }

  const minimo = Number(servico.minimum_price).toLocaleString("pt-AO");
  if (
    servico.price_type === "RANGE" &&
    servico.maximum_price !== null
  ) {
    const maximo = Number(servico.maximum_price).toLocaleString("pt-AO");
    return `${minimo}–${maximo} ${servico.currency}`;
  }
  if (servico.price_type === "STARTING_AT") {
    return `Desde ${minimo} ${servico.currency}`;
  }
  return `${minimo} ${servico.currency}`;
}

function criarUrlPedidoServico(servico: Service, prestador: Provider) {
  const parametros = new URLSearchParams({
    category: String(servico.category),
    title: servico.name,
    description: servico.description,
    source_provider: prestador.commercial_name,
  });

  if (
    servico.price_type !== "ON_REQUEST" &&
    servico.minimum_price !== null
  ) {
    parametros.set("minimum_budget", servico.minimum_price);
  }
  if (servico.maximum_price !== null) {
    parametros.set("maximum_budget", servico.maximum_price);
  }
  if (servico.duration_minutes !== null) {
    parametros.set("duration", String(servico.duration_minutes));
  }

  return `/pedidos/novo?${parametros.toString()}`;
}

export default function PaginaInicial() {
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
  const [menuMovelAberto, definirMenuMovelAberto] = useState(false);
  const [prestadorSelecionado, definirPrestadorSelecionado] = useState<Provider | null>(null);
  const [servicosDoPrestador, definirServicosDoPrestador] = useState<Service[]>([]);
  const [carregandoServicos, definirCarregamentoServicos] = useState(false);
  const [erroDosServicos, definirErroDosServicos] = useState("");
  const [tentativas, definirTentativas] = useState(0);

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
    if (!prestadorSelecionado) return;

    function fecharComEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") definirPrestadorSelecionado(null);
    }

    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [prestadorSelecionado]);

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
          definirCategorias(paginaCategorias.results);
          definirMunicipios(paginaMunicipios.results);
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
  }, []);

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

  async function abrirPrestador(prestador: Provider) {
    definirPrestadorSelecionado(prestador);
    definirServicosDoPrestador([]);
    definirErroDosServicos("");
    definirCarregamentoServicos(true);
    try {
      const pagina = await obterDadosApi<ApiPage<Service>>(
        "/services/",
        new URLSearchParams({ provider: String(prestador.id) }),
      );
      definirServicosDoPrestador(pagina.results);
    } catch (erro) {
      definirErroDosServicos(
        erro instanceof Error
          ? erro.message
          : "Não foi possível carregar os serviços.",
      );
    } finally {
      definirCarregamentoServicos(false);
    }
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
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Conect Services — início">
          <span>
            Conect <span className={styles.brandAccent}>Services</span>
          </span>
        </Link>

        <div className={styles.headerActions}>
          <a className={styles.providerButton} href="#tornar-prestador">
            Sou prestador
          </a>
          <a className={styles.headerSearchButton} href="#pesquisa">
            Encontrar serviço
          </a>
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

        <nav
          className={`${styles.navigation} ${menuMovelAberto ? styles.navigationOpen : ""}`}
          aria-label="Navegação principal"
        >
          <a href="#categorias" onClick={() => definirMenuMovelAberto(false)}>
            Categorias
          </a>
          <a href="#como-funciona" onClick={() => definirMenuMovelAberto(false)}>
            Como funciona
          </a>
          <a href="#clientes" onClick={() => definirMenuMovelAberto(false)}>
            Para clientes
          </a>
          <a href="#tornar-prestador" onClick={() => definirMenuMovelAberto(false)}>
            Para profissionais
          </a>
          <Link href="/entrar" onClick={() => definirMenuMovelAberto(false)}>
            Entrar
          </Link>
          <Link href="/registar" onClick={() => definirMenuMovelAberto(false)}>
            Criar conta
          </Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowLine} />
            A sua próxima conexão começa aqui
          </div>
          <h1>
            Conectando as melhores empresas e profissionais aos{" "}
            <span>clientes certos.</span>
          </h1>
          <p className={styles.heroDescription}>
            Encontre prestadores de serviços qualificados ou expanda a
            visibilidade do seu negócio em poucos cliques.
          </p>
          <div className={styles.heroButtons}>
            <a className={styles.heroPrimaryButton} href="#pesquisa">
              Encontrar um serviço <Icone name="arrow" size={17} />
            </a>
            <a className={styles.heroSecondaryButton} href="#tornar-prestador">
              Divulgar o meu negócio
            </a>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div
            className={styles.heroImage}
            role="img"
            aria-label="Profissionais a colaborar numa reunião de trabalho"
          />
          <div className={styles.imageNote}>
            <span className={styles.noteIcon} aria-hidden="true">
              <Icone name="spark" size={21} />
            </span>
            <span>
              <strong>Pessoas certas. Novas possibilidades.</strong>
              <small>Uma rede feita para o seu negócio.</small>
            </span>
          </div>
        </div>
      </section>

      <section className={styles.searchSection} id="pesquisa">
        <form className={styles.searchPanel} onSubmit={enviarPesquisa}>
          <label className={styles.searchField}>
            <Icone name="search" size={21} />
            <span className={styles.visuallyHidden}>Que serviço procura?</span>
            <input
              type="search"
              placeholder="Que serviço procura?"
              value={textoPesquisa}
              onChange={(evento) => definirTextoPesquisa(evento.target.value)}
            />
          </label>
          <label className={styles.searchField}>
            <Icone name="pin" size={21} />
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
            Pesquisar serviços
          </button>
        </form>
        {erroNosFiltros && (
          <p className={styles.filterNotice} role="status">
            {erroNosFiltros}
          </p>
        )}
      </section>

      <section className={styles.categorySection} id="categorias">
        <div className={styles.sectionHeading}>
          <div>
            <div className={styles.sectionKicker}>Explore os serviços</div>
            <h2>Categorias populares</h2>
            <p className={styles.sectionSubtitle}>
              Encontre profissionais e empresas para as suas necessidades.
            </p>
          </div>
          <a href="#prestadores" className={styles.textLink}>
            Ver todos os serviços <Icone name="arrow" size={17} />
          </a>
        </div>
        <div className={styles.categoryList}>
          {categorias.length ? (
            categorias.slice(0, 8).map((categoria, index) => (
              <button
                className={`${styles.categoryCard} ${filtros.category === String(categoria.id) ? styles.categorySelected : ""}`}
                key={categoria.id}
                type="button"
                onClick={() => selecionarCategoria(String(categoria.id))}
              >
                <span className={`${styles.categoryIcon} ${styles[`categoryIcon${index % 4}`]}`}>
                  <Icone
                    name={index % 2 === 0 ? "briefcase" : "spark"}
                    size={22}
                  />
                </span>
                <span className={styles.categoryText}>
                  <span className={styles.categoryName}>{categoria.name}</span>
                  <small className={styles.categoryDescription}>
                    {categoria.description}
                  </small>
                </span>
                <span className={styles.categoryArrow}>
                  <Icone name="arrow" size={16} />
                </span>
              </button>
            ))
          ) : (
            categoriasSugeridas.map((categoria, index) => (
              <button
                className={styles.categoryCard}
                key={categoria.name}
                type="button"
                onClick={() => pesquisarCategoriaSugerida(categoria.name)}
              >
                <span className={`${styles.categoryIcon} ${styles[`categoryIcon${index % 4}`]}`}>
                  <Icone
                    name={index % 2 === 0 ? "briefcase" : "spark"}
                    size={22}
                  />
                </span>
                <span className={styles.categoryText}>
                  <span className={styles.categoryName}>{categoria.name}</span>
                  <small className={styles.categoryDescription}>
                    {categoria.description}
                  </small>
                </span>
                <span className={styles.categoryArrow}>
                  <Icone name="arrow" size={16} />
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      <section className={styles.providerSection} id="prestadores">
        <div className={styles.sectionHeading}>
          <div>
            <div className={styles.sectionKicker}>Escolhidos com confiança</div>
            <h2>
              Prestadores em destaque
              {nomeCategoriaSelecionada ? (
                <span className={styles.titleFilter}> · {nomeCategoriaSelecionada}</span>
              ) : null}
            </h2>
          </div>
          <label className={styles.sortLabel}>
            Ordenar por
            <select
              value={filtros.ordering}
              onChange={(evento) => atualizarFiltro("ordering", evento.target.value)}
            >
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
              {filtros.search && (
                <span className={styles.activeFilter}>
                  Pesquisa: “{filtros.search}”
                </span>
              )}
              {nomeCategoriaSelecionada && (
                <span className={styles.activeFilter}>
                  Categoria: {nomeCategoriaSelecionada}
                </span>
              )}
              {nomeMunicipioSelecionado && (
                <span className={styles.activeFilter}>
                  Localização: {nomeMunicipioSelecionado}
                </span>
              )}
            </div>
            <button
              className={styles.clearFiltersButton}
              type="button"
              onClick={limparFiltros}
            >
              Limpar filtros
            </button>
          </div>
        )}

        {erroNaPesquisa ? (
          <div className={styles.statusPanel} role="alert">
            <span className={styles.statusIcon}>!</span>
            <div>
              <strong>Não foi possível carregar os prestadores.</strong>
              <p>
                Confirma se a API está em execução em{" "}
                <code>{URL_BASE_API}</code> e tenta novamente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                definirCarregamento(true);
                definirErroNaPesquisa("");
                definirTentativas((quantidade) => quantidade + 1);
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : estaCarregando ? (
          <div className={styles.loadingGrid} aria-label="A carregar prestadores">
            {[0, 1, 2].map((item) => (
              <div className={styles.skeletonCard} key={item}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : prestadores.length ? (
          <>
            <div className={styles.providerGrid}>
              {prestadores.map((prestador) => (
                <article className={styles.providerCard} key={prestador.id}>
                  <div className={styles.providerCardHeader}>
                    <div className={styles.providerAvatar}>
                      {prestador.commercial_name.slice(0, 1).toLocaleUpperCase("pt-AO")}
                    </div>
                    <span className={styles.providerVerified}>
                      <span /> Verificado
                    </span>
                  </div>
                  <h3>{prestador.commercial_name}</h3>
                  <p className={styles.providerDescription}>
                    {prestador.description || "Prestador de serviços em Angola."}
                  </p>
                  <div className={styles.providerStats}>
                    <span className={styles.providerRating}>
                      <span aria-label="avaliação média">★</span>{" "}
                      {prestador.average_rating ?? "Novo"}
                    </span>
                    <span>{formatarContagemAvaliacoes(prestador.review_count)}</span>
                    <span>
                      {prestador.active_service_count}{" "}
                      {prestador.active_service_count === 1 ? "serviço" : "serviços"}
                    </span>
                  </div>
                  <button
                    className={styles.providerLink}
                    type="button"
                    onClick={() => void abrirPrestador(prestador)}
                  >
                    Ver serviços <Icone name="arrow" size={17} />
                  </button>
                </article>
              ))}
            </div>
            <div className={styles.pagination}>
              <span>{quantidadePrestadores} prestadores encontrados</span>
              <div>
                <button
                  type="button"
                  disabled={!temPaginaAnterior}
                  onClick={() =>
                    {
                      definirCarregamento(true);
                      definirFiltros((atual) => ({
                        ...atual,
                        page: Math.max(1, atual.page - 1),
                      }));
                    }
                  }
                >
                  Anterior
                </button>
                <span>Página {filtros.page}</span>
                <button
                  type="button"
                  disabled={!temProximaPagina}
                  onClick={() =>
                    {
                      definirCarregamento(true);
                      definirFiltros((atual) => ({
                        ...atual,
                        page: atual.page + 1,
                      }));
                    }
                  }
                >
                  Seguinte
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>
              <Icone name="search" size={24} />
            </span>
            <h3>A tua próxima boa escolha começa aqui.</h3>
            <p>
              {filtros.search || filtros.category || filtros.municipality
                ? "Ainda não encontrámos prestadores com estes filtros. Experimenta ajustar a pesquisa."
                : "Estamos a preparar a comunidade de prestadores verificados. Volta em breve para descobrir quem pode ajudar."}
            </p>
            {(filtros.search || filtros.category || filtros.municipality) && (
              <button
                type="button"
                onClick={limparFiltros}
              >
                Limpar pesquisa
              </button>
            )}
          </div>
        )}
      </section>

      <section className={styles.howSection} id="como-funciona">
        <div className={styles.howHeading}>
          <div className={styles.sectionKicker}>Simples, como deve ser</div>
          <h2>Uma boa parceria começa em 3 passos.</h2>
          <p>
            Da procura ao contacto, a Conect Services ajuda a tornar o processo
            mais simples.
          </p>
        </div>
        <div className={styles.steps}>
          <article className={styles.step}>
            <span className={styles.stepNumber}>01</span>
            <span className={styles.stepIcon}>
              <Icone name="search" size={22} />
            </span>
            <h3>Defina o que procura</h3>
            <p>
              Pesquise por serviço, categoria ou localização para encontrar
              opções relevantes.
            </p>
          </article>
          <article className={styles.step}>
            <span className={styles.stepNumber}>02</span>
            <span className={styles.stepIcon}>
              <Icone name="briefcase" size={22} />
            </span>
            <h3>Descubra opções</h3>
            <p>
              Explore perfis de profissionais e empresas e compare as
              informações disponíveis.
            </p>
          </article>
          <article className={styles.step}>
            <span className={styles.stepNumber}>03</span>
            <span className={styles.stepIcon}>
              <Icone name="spark" size={22} />
            </span>
            <h3>Estabeleça contacto</h3>
            <p>
              Entre em contacto com o prestador para esclarecer detalhes e
              combinar o serviço.
            </p>
          </article>
        </div>
        <a href="#pesquisa" className={styles.stepsCta}>
          Começar agora <Icone name="arrow" size={17} />
        </a>
      </section>

      <section className={styles.audienceSection} id="clientes">
        <div
          className={styles.audienceImage}
          role="img"
          aria-label="Equipa a conversar e planear um projeto"
        />
        <div className={styles.audienceCopy}>
          <div className={styles.sectionKicker}>Para clientes e empresas</div>
          <h2>O seu negócio precisa de boas conexões para crescer.</h2>
          <p>
            Encontre competências, serviços e parceiros que podem ajudar a
            transformar as suas ideias em resultados.
          </p>
          <ul className={styles.checkList}>
            <li>Descubra prestadores de serviços em diferentes áreas.</li>
            <li>Pesquise por categoria e localização.</li>
            <li>
              Conheça cada profissional antes de entrar em contacto.
            </li>
          </ul>
          <a className={styles.audienceButton} href="#pesquisa">
            Encontrar profissionais <Icone name="arrow" size={17} />
          </a>
        </div>
      </section>

      <section
        className={`${styles.audienceSection} ${styles.professionalSection}`}
        id="tornar-prestador"
      >
        <div className={styles.audienceCopy}>
          <div className={styles.sectionKicker}>Para prestadores de serviços</div>
          <h2>O seu talento merece ser encontrado.</h2>
          <p>
            Apresente os seus serviços a potenciais clientes e aumente a
            presença digital do seu negócio.
          </p>
          <ul className={styles.checkList}>
            <li>Mostre os seus serviços e especialidades.</li>
            <li>Amplie a visibilidade da sua actividade profissional.</li>
            <li>Crie novas oportunidades com clientes e PMEs.</li>
          </ul>
          <Link className={styles.audienceButton} href="/perfil">
            Divulgar os meus serviços <Icone name="arrow" size={17} />
          </Link>
        </div>
        <div
          className={styles.professionalImage}
          role="img"
          aria-label="Profissional a trabalhar no seu negócio"
        />
      </section>

      <section className={styles.benefitsSection}>
        <div className={styles.howHeading}>
          <div className={styles.sectionKicker}>Conect Services</div>
          <h2>Mais informação. Melhores escolhas.</h2>
          <p>
            Uma plataforma pensada para aproximar pessoas, profissionais e
            empresas.
          </p>
        </div>
        <div className={styles.benefits}>
          <article>
            <Icone name="search" size={23} />
            <h3>Encontre com facilidade</h3>
            <p>
              Procure serviços por categoria e localização, de forma simples e
              organizada.
            </p>
          </article>
          <article>
            <Icone name="spark" size={23} />
            <h3>Conexões relevantes</h3>
            <p>
              Aproxime clientes de prestadores e empresas que correspondem às
              suas necessidades.
            </p>
          </article>
          <article>
            <Icone name="arrow" size={23} />
            <h3>Oportunidades de crescimento</h3>
            <p>
              Ajude profissionais independentes e PMEs a apresentar o seu
              trabalho a novos clientes.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <h2>A sua próxima oportunidade começa aqui.</h2>
          <p>Encontre um serviço ou dê mais visibilidade ao seu negócio.</p>
        </div>
        <a href="#pesquisa">
          Explorar a plataforma <Icone name="arrow" size={17} />
        </a>
      </section>

      {prestadorSelecionado && (
        <div
          className={styles.modalBackdrop}
          onClick={() => definirPrestadorSelecionado(null)}
        >
          <section
            className={styles.providerModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="provider-modal-title"
            onClick={(evento) => evento.stopPropagation()}
          >
            <button
              className={styles.modalClose}
              type="button"
              aria-label="Fechar detalhes do prestador"
              onClick={() => definirPrestadorSelecionado(null)}
            >
              ×
            </button>
            <div className={styles.modalEyebrow}>
              <span /> Prestador verificado
            </div>
            <h2 id="provider-modal-title">
              {prestadorSelecionado.commercial_name}
            </h2>
            <p className={styles.modalDescription}>
              {prestadorSelecionado.description || "Prestador de serviços em Angola."}
            </p>
            <div className={styles.modalRating}>
              <span>★</span> {prestadorSelecionado.average_rating ?? "Novo"} ·{" "}
              {formatarContagemAvaliacoes(prestadorSelecionado.review_count)}
            </div>
            <div className={styles.modalSectionHeading}>
              <h3>Serviços disponíveis</h3>
              <span>{prestadorSelecionado.active_service_count}</span>
            </div>
            {carregandoServicos ? (
              <p className={styles.modalMessage}>A carregar serviços...</p>
            ) : erroDosServicos ? (
              <p className={styles.modalError} role="alert">
                {erroDosServicos}
              </p>
            ) : servicosDoPrestador.length ? (
              <ul className={styles.serviceList}>
                {servicosDoPrestador.map((servico) => (
                  <li key={servico.id}>
                    <span className={styles.serviceIcon}>
                      <Icone name="briefcase" size={17} />
                    </span>
                    <span className={styles.serviceInfo}>
                      <strong>{servico.name}</strong>
                      <small>
                        {categorias.find(
                          (categoria) => categoria.id === servico.category,
                        )?.name ?? "Serviço"}
                        {servico.duration_minutes
                          ? ` · ${servico.duration_minutes} min`
                          : ""}
                      </small>
                      <Link
                        className={styles.requestServiceLink}
                        href={criarUrlPedidoServico(
                          servico,
                          prestadorSelecionado,
                        )}
                        onClick={() => definirPrestadorSelecionado(null)}
                      >
                        Pedir este serviço <Icone name="arrow" size={14} />
                      </Link>
                    </span>
                    <span className={styles.servicePrice}>
                      {formatarPrecoServico(servico)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.modalMessage}>
                Ainda não há serviços publicados para este prestador.
              </p>
            )}
            <p className={styles.modalMessage}>
              O pedido será partilhado com prestadores elegíveis pela categoria
              e localização indicadas.
            </p>
          </section>
        </div>
      )}

      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div>
            <Link className={styles.footerBrand} href="/">
              Conect Services
            </Link>
            <p>
              Conectando clientes, profissionais e pequenas e médias empresas
              em Angola.
            </p>
          </div>
          <div>
            <h3>Explorar</h3>
            <a href="#categorias">Categorias</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#pesquisa">Pesquisar serviços</a>
          </div>
          <div>
            <h3>Para profissionais</h3>
            <a href="#tornar-prestador">Divulgar serviços</a>
            <Link href="/perfil">Criar perfil profissional</Link>
            <a href="mailto:contacto@conectservices.ao">Contactar a equipa</a>
          </div>
          <div>
            <h3>Conta</h3>
            <Link href="/entrar">Entrar</Link>
            <Link href="/registar">Criar conta</Link>
            <Link href="/pedidos/novo">Pedir um serviço</Link>
          </div>
        </div>
        <div className={styles.copyright}>
          <span>
            © {new Date().getFullYear()} Conect Services. Todos os direitos
            reservados.
          </span>
          <span>Feito para conectar oportunidades em Angola.</span>
        </div>
      </footer>
    </main>
  );
}
