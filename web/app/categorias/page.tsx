"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BusinessLogo from "@/app/components/business-logo";
import { requisitarJson } from "@/lib/api-client";
import styles from "./categorias.module.css";

type ApiPage<T> = { results: T[]; count: number };
type Category = { id: number; name: string; description: string };
type Provider = {
  id: number;
  commercial_name: string;
  description: string;
  verification_status: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";
  business_profile: { logo: string; website: string; opening_hours: Record<string, string> } | null;
  active_service_count: number;
  average_rating: string | null;
  review_count: number;
};

const icones = ["⌘", "⌂", "✚", "✧", "➜", "▱", "◌", "▣"];

export default function CategoriasPublicasPage() {
  const [categorias, definirCategorias] = useState<Category[]>([]);
  const [categoriaSelecionada, definirCategoriaSelecionada] = useState<Category | null>(null);
  const [prestadores, definirPrestadores] = useState<Provider[]>([]);
  const [termo, definirTermo] = useState("");
  const [carregandoCategorias, definirCarregamentoCategorias] = useState(true);
  const [carregandoPrestadores, definirCarregamentoPrestadores] = useState(false);
  const [erro, definirErro] = useState("");

  useEffect(() => {
    let ativo = true;
    requisitarJson<ApiPage<Category>>("/api/public/categories?parent=null")
      .then((pagina) => { if (ativo) definirCategorias(pagina.results); })
      .catch((falha: unknown) => {
        if (ativo) definirErro(falha instanceof Error ? falha.message : "Não foi possível carregar as categorias.");
      })
      .finally(() => { if (ativo) definirCarregamentoCategorias(false); });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!categoriaSelecionada) {
      return;
    }
    let ativo = true;
    requisitarJson<ApiPage<Provider>>(
      `/api/public/providers/discover?category=${categoriaSelecionada.id}&ordering=-rating`,
    )
      .then((pagina) => { if (ativo) definirPrestadores(pagina.results); })
      .catch((falha: unknown) => {
        if (ativo) definirErro(falha instanceof Error ? falha.message : "Não foi possível carregar os prestadores.");
      })
      .finally(() => { if (ativo) definirCarregamentoPrestadores(false); });
    return () => { ativo = false; };
  }, [categoriaSelecionada]);

  const categoriasFiltradas = categorias.filter((categoria) =>
    `${categoria.name} ${categoria.description}`.toLocaleLowerCase("pt-AO").includes(termo.trim().toLocaleLowerCase("pt-AO")),
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Conect Services — página inicial">
          <span className={styles.brandMark} aria-hidden="true">C</span>
          <span>Conect <strong>Services</strong></span>
        </Link>
        <nav aria-label="Navegação principal">
          <Link href="/">Início</Link>
          <Link href="/categorias" aria-current="page">Categorias</Link>
          <Link href="/explorar">Empresas e profissionais</Link>
        </nav>
        <div className={styles.headerActions}>
          <Link href="/entrar">Entrar</Link>
          <Link className={styles.primaryButton} href="/registar">Criar conta</Link>
        </div>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>Encontra o que procuras</span>
        <h1>Categorias de serviços</h1>
        <p>Explora categorias e descobre empresas e profissionais disponíveis em Angola.</p>
        <label className={styles.searchField}>
          <span aria-hidden="true">⌕</span>
          <span className={styles.srOnly}>Pesquisar categorias</span>
          <input value={termo} onChange={(evento) => definirTermo(evento.target.value)} placeholder="Pesquisar categorias…" />
        </label>
      </section>

      <section className={styles.content} aria-labelledby="categories-title">
        <div className={styles.sectionHeading}>
          <div><span className={styles.sectionKicker}>Explore por área</span><h2 id="categories-title">Escolhe uma categoria</h2></div>
          <span className={styles.resultCount}>{categoriasFiltradas.length} categorias</span>
        </div>
        {carregandoCategorias ? (
          <p className={styles.notice} role="status">A carregar categorias…</p>
        ) : erro && categorias.length === 0 ? (
          <div className={styles.notice} role="alert"><p>{erro}</p><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></div>
        ) : categoriasFiltradas.length ? (
          <div className={styles.categoryGrid}>
            {categoriasFiltradas.map((categoria, index) => (
              <button
                className={`${styles.categoryCard} ${categoriaSelecionada?.id === categoria.id ? styles.categorySelected : ""}`}
                key={categoria.id}
                type="button"
                aria-pressed={categoriaSelecionada?.id === categoria.id}
                onClick={() => {
                  definirErro("");
                  const desmarcar = categoriaSelecionada?.id === categoria.id;
                  definirCarregamentoPrestadores(!desmarcar);
                  definirCategoriaSelecionada(desmarcar ? null : categoria);
                }}
              >
                <span className={`${styles.categoryIcon} ${styles[`categoryIcon${index % 4}`]}`} aria-hidden="true">{icones[index % icones.length]}</span>
                <strong>{categoria.name}</strong>
                <span>{categoria.description || "Descobre serviços e profissionais nesta área."}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.notice}>Não encontrámos categorias com esse nome.</p>
        )}
      </section>

      {categoriaSelecionada && (
        <section className={styles.providers} aria-live="polite">
          <div className={styles.sectionHeading}>
            <div><span className={styles.sectionKicker}>Prestadores verificados</span><h2>{categoriaSelecionada.name}</h2></div>
            <button className={styles.clearButton} type="button" onClick={() => { definirCarregamentoPrestadores(false); definirCategoriaSelecionada(null); }}>Limpar seleção</button>
          </div>
          {carregandoPrestadores ? (
            <p className={styles.notice} role="status">A procurar empresas e profissionais…</p>
          ) : erro ? (
            <p className={styles.notice} role="alert">{erro}</p>
          ) : prestadores.length ? (
            <div className={styles.providerGrid}>
              {prestadores.map((prestador) => (
                <article className={styles.providerCard} key={prestador.id}>
                  {prestador.business_profile ? (
                    <BusinessLogo className={styles.avatarImage} companyName={prestador.commercial_name} logoUrl={prestador.business_profile.logo} width={48} height={48} />
                  ) : <span className={styles.avatar} aria-hidden="true">{prestador.commercial_name.slice(0, 1)}</span>}
                  <div className={styles.providerInfo}>
                    <h3>{prestador.commercial_name}</h3>
                    <p>{prestador.description || "Prestador de serviços em Angola."}</p>
                    <span className={styles.providerMeta}>
                      {prestador.average_rating ? `★ ${prestador.average_rating} · ${prestador.review_count} avaliações` : "Novo prestador"}
                      {` · ${prestador.active_service_count} ${prestador.active_service_count === 1 ? "serviço" : "serviços"}`}
                    </span>
                  </div>
                  <Link className={styles.profileLink} href={`/prestadores/${prestador.id}`}>Ver perfil</Link>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.notice}>Ainda não há prestadores publicados nesta categoria. Experimenta outra categoria.</p>
          )}
        </section>
      )}

      <footer className={styles.footer}><Link href="/">Conect Services</Link><span>Conectando o mundo, movendo o futuro.</span><span>© {new Date().getFullYear()} Conect Services</span></footer>
    </main>
  );
}
