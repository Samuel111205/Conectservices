"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { requisitarJson } from "@/lib/api-client";
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
        <Link className={styles.brand} href={appMode ? "/conta" : "/"} aria-label="Conect Services — início">
          <span className={styles.brandMark} aria-hidden="true">C</span>
          <span className={styles.brandName}>conect<span className={styles.brandAccent}>.</span><small>services</small></span>
        </Link>

        <div className={styles.headerActions}>
          <a className={styles.providerButton} href="#tornar-prestador">
            Sou prestador
          </a>
          <a className={styles.headerSearchButton} href="#pesquisa">
            Explorar serviços
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
          {appMode ? <Link href="/conta" onClick={() => definirMenuMovelAberto(false)}>A minha área</Link> : <>
            <Link href="/entrar" onClick={() => definirMenuMovelAberto(false)}>Entrar</Link>
            <Link href="/registar" onClick={() => definirMenuMovelAberto(false)}>Criar conta</Link>
          </>}
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowLine} />
            O teu próximo serviço começa com uma boa ligação
          </div>
          <h1>
            Encontra os profissionais certos para o que{" "}
            <span>precisas.</span>
          </h1>
          <p className={styles.heroDescription}>
            Descobre profissionais de confiança ou apresenta os teus serviços
            a quem procura soluções como a tua.
          </p>
          <div className={styles.heroButtons}>
            <a className={styles.heroPrimaryButton} href="#pesquisa">
              Encontrar um profissional <Icone name="arrow" size={17} />
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
              <small>Uma rede feita para o teu negócio.</small>
            </span>
          </div>
        </div>
      </section>

      <section className={styles.searchSection} id="pesquisa">
        <form className={styles.searchPanel} onSubmit={enviarPesquisa}>
          <label className={styles.searchField}>
            <Icone name="search" size={21} />
            <span className={styles.visuallyHidden}>Que serviço procuras?</span>
            <input
              type="search"
              placeholder="Que serviço procuras?"
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
      </section>

      <section className={styles.categorySection} id="categorias">
        <div className={styles.sectionHeading}>
          <div>
            <div className={styles.sectionKicker}>Explora serviços</div>
            <h2>Categorias populares</h2>
            <p className={styles.sectionSubtitle}>
              Encontra profissionais e empresas para o que precisas.
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
              Profissionais em destaque
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
                A API não respondeu como esperado. Verifica a ligação e tenta novamente.
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
                  <Link
                    className={styles.providerLink}
                    href={`/prestadores/${prestador.id}`}
                  >
                    Ver perfil e serviços <Icone name="arrow" size={17} />
                  </Link>
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
            Da pesquisa ao contacto, a Conect Services ajuda a tornar o processo
            mais simples.
          </p>
        </div>
        <div className={styles.steps}>
          <article className={styles.step}>
            <span className={styles.stepNumber}>01</span>
            <span className={styles.stepIcon}>
              <Icone name="search" size={22} />
            </span>
            <h3>Define o que procuras</h3>
            <p>
              Pesquisa por serviço, categoria ou localização para encontrares
              opções relevantes.
            </p>
          </article>
          <article className={styles.step}>
            <span className={styles.stepNumber}>02</span>
            <span className={styles.stepIcon}>
              <Icone name="briefcase" size={22} />
            </span>
            <h3>Descobre opções</h3>
            <p>
              Explora perfis de profissionais e empresas e compara a informação
              disponível.
            </p>
          </article>
          <article className={styles.step}>
            <span className={styles.stepNumber}>03</span>
            <span className={styles.stepIcon}>
              <Icone name="spark" size={22} />
            </span>
            <h3>Estabelece contacto</h3>
            <p>
              Entra em contacto com o profissional para esclarecer detalhes e
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
          <h2>O teu negócio precisa de boas ligações para crescer.</h2>
          <p>
            Encontra competências, serviços e parceiros que te ajudam a
            transformar ideias em resultados.
          </p>
          <ul className={styles.checkList}>
            <li>Descobre profissionais de várias áreas.</li>
            <li>Pesquisa por categoria e localização.</li>
            <li>Conhece cada profissional antes de entrar em contacto.</li>
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
          <h2>O teu talento merece ser encontrado.</h2>
          <p>
            Apresenta os teus serviços a potenciais clientes e aumenta a
            presença digital do teu negócio.
          </p>
          <ul className={styles.checkList}>
            <li>Mostra os teus serviços e especialidades.</li>
            <li>Aumenta a visibilidade da tua atividade profissional.</li>
            <li>Cria oportunidades com clientes e pequenas empresas.</li>
          </ul>
          <Link className={styles.audienceButton} href="/perfil">
            Apresentar os meus serviços <Icone name="arrow" size={17} />
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
            <h3>Encontra com facilidade</h3>
            <p>
              Procura serviços por categoria e localização, de forma simples e
              organizada.
            </p>
          </article>
          <article>
            <Icone name="spark" size={23} />
            <h3>Conexões relevantes</h3>
            <p>
              Aproxima clientes de profissionais e empresas que correspondem
              ao que procuram.
            </p>
          </article>
          <article>
            <Icone name="arrow" size={23} />
            <h3>Oportunidades de crescimento</h3>
            <p>
              Ajuda profissionais independentes e pequenas empresas a
              apresentarem o seu trabalho a novos clientes.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <h2>A tua próxima oportunidade começa aqui.</h2>
          <p>Encontra um serviço ou dá mais visibilidade ao teu negócio.</p>
        </div>
        <a href="#pesquisa">
          Explorar a plataforma <Icone name="arrow" size={17} />
        </a>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div>
            <Link className={styles.footerBrand} href={appMode ? "/conta" : "/"}>
              Conect Services
            </Link>
            <p>
              Ligamos clientes, profissionais e pequenas empresas em Angola.
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
            {appMode ? <Link href="/conta">Área pessoal</Link> : <>
              <Link href="/entrar">Entrar</Link>
              <Link href="/registar">Criar conta</Link>
            </>}
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
