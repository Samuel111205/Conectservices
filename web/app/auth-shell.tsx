"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { rememberActiveArea } from "@/lib/active-area";
import NotificationCenter from "./notification-center";
import styles from "./auth.module.css";

const navigationItems = [
  { href: "/conta", label: "Feed", letter: "F" },
  { href: "/explorar", label: "Explorar serviços", letter: "E" },
  { href: "/pedidos", label: "Os meus pedidos", letter: "P" },
  { href: "/contratacoes", label: "Contratações", letter: "C" },
  { href: "/mensagens", label: "Mensagens", letter: "M" },
  { href: "/prestador", label: "Área profissional", letter: "A" },
  { href: "/perfil", label: "Perfil e conta", letter: "U" },
];

export default function EstruturaAutenticacao({
  children,
  account = false,
}: {
  children: ReactNode;
  account?: boolean;
}) {
  const pathname = usePathname();
  const providerArea = pathname.startsWith("/prestador") || pathname.startsWith("/empresa");
  const companyArea = pathname.startsWith("/empresa");
  useEffect(() => {
    if (providerArea) rememberActiveArea("provider");
    else if (pathname === "/conta") rememberActiveArea("client");
  }, [pathname, providerArea]);
  const brand = (
    <Link className={styles.brand} href={account ? "/conta" : "/"} aria-label="Conect Services — início">
      <span className={styles.brandMark} aria-hidden="true">C</span>
      <span className={styles.brandWord}>conect<span>.</span><small>services</small></span>
    </Link>
  );

  if (!account) {
    return (
      <main className={styles.page}>
        <header className={styles.topbar}>{brand}</header>
        <section className={styles.card}>{children}</section>
        <Link className={styles.homeLink} href="/">Voltar à página inicial</Link>
      </main>
    );
  }

  const nav = (mobile = false) => (
    <nav className={mobile ? styles.mobileNav : styles.workspaceNav} aria-label={mobile ? "Navegação móvel" : "Navegação da área pessoal"}>
      {navigationItems.map((item) => {
        const ativo = item.href === "/conta"
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={styles.workspaceLink}
            aria-current={ativo ? "page" : undefined}
            onClick={() => {
              if (item.href === "/conta") rememberActiveArea("client");
              if (item.href.startsWith("/prestador")) rememberActiveArea("provider");
            }}
          >
            <span className={styles.navLetter} aria-hidden="true">{item.letter}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <main className={`${styles.page} ${styles.workspacePage}`}>
      <header className={styles.workspaceHeader}>
        <div className={styles.workspaceHeaderInner}>
          {brand}
          <div className={styles.workspaceHeaderActions}>
            <Link
              href={providerArea ? "/conta" : "/prestador"}
              onClick={() => rememberActiveArea(providerArea ? "client" : "provider")}
            >
              {providerArea ? "Área de cliente" : "Área profissional"}
            </Link>
            <NotificationCenter />
            <Link href={providerArea ? "/prestador/pedidos" : "/explorar"}>
              {providerArea ? "Ver oportunidades" : "Descobrir serviços"}
            </Link>
            <Link href="/mensagens">Mensagens</Link>
            <Link
              className={styles.createAction}
              href={companyArea ? "/empresa/produtos#formulario-produto" : providerArea ? "/prestador/servicos#formulario-servico" : "/pedidos/novo"}
            >
              <span aria-hidden="true">＋</span> {companyArea ? "Adicionar produto" : providerArea ? "Adicionar serviço" : "Pedir serviço"}
            </Link>
          </div>
        </div>
      </header>
      <div className={styles.workspaceLayout}>
        <aside className={styles.workspaceSidebar}>
          <p className={styles.sidebarCaption}>A tua Conect</p>
          {nav()}
          <Link
            className={styles.sidebarCreate}
            href={companyArea ? "/empresa/produtos#formulario-produto" : providerArea ? "/prestador/servicos#formulario-servico" : "/pedidos/novo"}
          >
            <span aria-hidden="true">＋</span> {companyArea ? "Adicionar produto" : providerArea ? "Adicionar serviço" : "Pedir um serviço"}
          </Link>
          <div className={styles.sidebarNote}>
            <span className={styles.sidebarNoteMark} aria-hidden="true">✦</span>
            <strong>
              {providerArea
                ? "Novos pedidos podem ser oportunidades para ti."
                : "O próximo serviço pode começar com uma conversa."}
            </strong>
            <Link href={providerArea ? "/prestador/pedidos" : "/explorar"}>
              {providerArea ? "Ver pedidos disponíveis" : "Encontrar profissionais"} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </aside>
        <div className={styles.workspaceMain}>
          <section className={`${styles.card} ${styles.accountCard}`}>{children}</section>
        </div>
        <aside className={styles.workspaceAside} aria-label="Atalhos">
          <section className={styles.asideCard}>
            <p className={styles.sidebarCaption}>Começa por aqui</p>
            {providerArea ? <>
              <Link href="/prestador/pedidos"><strong>Encontrar pedidos</strong><span>Descobre oportunidades na tua zona.</span></Link>
              <Link href="/prestador/servicos"><strong>Gerir os teus serviços</strong><span>Mantém o teu catálogo atualizado.</span></Link>
              <Link href="/perfil"><strong>Perfil e verificação</strong><span>Revê a apresentação da tua atividade.</span></Link>
              <Link href="/empresa"><strong>Perfil empresarial</strong><span>Regista ou actualiza os dados comerciais da empresa.</span></Link>
              <Link href="/empresa/produtos"><strong>Gerir produtos</strong><span>Adiciona preços e stock ao catálogo.</span></Link>
              <Link href="/empresa/encomendas"><strong>Encomendas recebidas</strong><span>Revê e responde aos pedidos de compra.</span></Link>
            </> : <>
              <Link href="/pedidos/novo"><strong>Precisas de um serviço?</strong><span>Conta o que precisas e recebe propostas.</span></Link>
              <Link href="/perfil"><strong>Completa o teu perfil</strong><span>Ajuda os profissionais a conhecerem-te.</span></Link>
              <Link href="/prestador"><strong>És profissional?</strong><span>Gere os teus serviços e propostas.</span></Link>
            </>}
          </section>
          <p className={styles.workspaceFootnote}>Uma comunidade de serviços feita para Angola.</p>
        </aside>
      </div>
      {nav(true)}
    </main>
  );
}
