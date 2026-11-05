"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  ClipboardList,
  Compass,
  Heart,
  Home,
  LogOut,
  MessageCircle,
  Package,
  Plus,
  Settings,
  UserRound,
} from "lucide-react";
import { rememberActiveArea } from "@/lib/active-area";
import NotificationCenter from "./notification-center";
import styles from "./auth.module.css";

type ProfileIdentity = {
  full_name: string;
  photo: string | null;
};

type ProviderIdentity = {
  commercial_name: string;
};

type CompanyIdentity = {
  commercial_name: string;
  logo: string | null;
};

async function carregarIdentidade<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Não foi possível carregar os dados do perfil (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

const navigationPorArea = {
  client: [
    { href: "/conta", label: "Dashboard", icon: Home },
    { href: "/explorar", label: "Explorar serviços", icon: Compass },
    { href: "/favoritos", label: "Favoritos", icon: Heart },
    { href: "/pedidos", label: "Meus pedidos", icon: ClipboardList },
    { href: "/mensagens", label: "Mensagens", icon: MessageCircle },
    { href: "#notifications", label: "Notificações", icon: Bell },
    { href: "/perfil", label: "Perfil", icon: UserRound },
    { href: "/perfil#profile-settings", label: "Definições", icon: Settings },
  ],
  provider: [
    { href: "/prestador", label: "Dashboard", icon: Home },
    { href: "/prestador/pedidos", label: "Explorar pedidos", icon: Compass },
    { href: "/prestador/servicos", label: "Serviços", icon: ClipboardList },
    { href: "/mensagens", label: "Mensagens", icon: MessageCircle },
    { href: "#notifications", label: "Notificações", icon: Bell },
    { href: "/contratacoes", label: "Disponibilidade", icon: BriefcaseBusiness },
    { href: "/perfil", label: "Perfil profissional", icon: UserRound },
    { href: "/perfil#profile-settings", label: "Definições", icon: Settings },
  ],
  company: [
    { href: "/empresa", label: "Dashboard", icon: Home },
    { href: "/empresa#perfil-empresa", label: "Perfil da empresa", icon: BriefcaseBusiness },
    { href: "/prestador/servicos", label: "Serviços publicados", icon: ClipboardList },
    { href: "/empresa/produtos", label: "Produtos", icon: Package },
    { href: "/empresa/encomendas", label: "Pedidos recebidos", icon: ClipboardList },
    { href: "/mensagens", label: "Mensagens", icon: MessageCircle },
    { href: "#notifications", label: "Notificações", icon: Bell },
    { href: "/perfil#profile-settings", label: "Definições", icon: Settings },
  ],
} as const;

export default function EstruturaAutenticacao({
  children,
  account = false,
  profileName,
  area,
}: {
  children: ReactNode;
  account?: boolean;
  profileName?: string;
  area?: "client" | "provider" | "company";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const paginaLogin = pathname === "/entrar";
  const areaAtual = area ?? (
    pathname.startsWith("/empresa") ? "company"
      : pathname.startsWith("/prestador") ? "provider"
        : "client"
  );
  const providerArea = areaAtual === "provider" || areaAtual === "company";
  const companyArea = areaAtual === "company";
  const itemsDaArea = navigationPorArea[areaAtual];
  const atalhosProfissionais = [
    {
      href: "/prestador/pedidos",
      label: "Encontrar pedidos",
      description: "Descobre oportunidades na tua zona.",
      icon: Compass,
    },
    {
      href: "/prestador/servicos",
      label: "Gerir serviços",
      description: "Mantém o teu catálogo atualizado.",
      icon: ClipboardList,
    },
    {
      href: "/perfil",
      label: "Perfil e verificação",
      description: "Revê a apresentação da tua atividade.",
      icon: UserRound,
    },
  ];
  const atalhosEmpresa = [
    {
      href: "/empresa",
      label: "Perfil empresarial",
      description: "Atualiza os dados comerciais da empresa.",
      icon: BriefcaseBusiness,
    },
    {
      href: "/empresa/produtos",
      label: "Gerir produtos",
      description: "Atualiza preços e stock do catálogo.",
      icon: Package,
    },
    {
      href: "/empresa/encomendas",
      label: "Encomendas recebidas",
      description: "Revê e responde aos pedidos de compra.",
      icon: ClipboardList,
    },
  ];
  const atalhosCliente = [
    {
      href: "/pedidos/novo",
      label: "Pedir um serviço",
      description: "Conta o que precisas e recebe propostas.",
      icon: Plus,
    },
    {
      href: "/perfil",
      label: "Completar perfil",
      description: "Ajuda os profissionais a conhecerem-te.",
      icon: UserRound,
    },
    {
      href: "/prestador",
      label: "Área profissional",
      description: "Gere serviços e propostas.",
      icon: BriefcaseBusiness,
    },
  ];
  const [aTerminarSessao, definirTerminoSessao] = useState(false);
  const [erroSessao, definirErroSessao] = useState("");
  const [perfilIdentidade, definirPerfilIdentidade] = useState<ProfileIdentity | null>(null);
  const [prestadorIdentidade, definirPrestadorIdentidade] = useState<ProviderIdentity | null>(null);
  const [empresaIdentidade, definirEmpresaIdentidade] = useState<CompanyIdentity | null>(null);
  const [erroPerfilIdentidade, definirErroPerfilIdentidade] = useState("");
  const [imagemPerfilFalhou, definirImagemPerfilFalhou] = useState(false);
  useEffect(() => {
    if (!account) return;
    let active = true;
    Promise.all([
      carregarIdentidade<ProfileIdentity>("/api/auth/profiles/me/"),
      providerArea
        ? carregarIdentidade<ProviderIdentity>("/api/auth/providers/me/")
        : Promise.resolve(null),
      companyArea
        ? carregarIdentidade<CompanyIdentity>("/api/auth/businesses/me/")
        : Promise.resolve(null),
    ] as const)
      .then(([profile, provider, company]) => {
        if (!active) return;
        definirPerfilIdentidade(profile);
        definirPrestadorIdentidade(provider);
        definirEmpresaIdentidade(company);
      })
      .catch(() => {
        if (active) {
          definirErroPerfilIdentidade("Não foi possível carregar os dados do perfil.");
        }
      });
    return () => {
      active = false;
    };
  }, [account, companyArea, providerArea]);
  const nomeExibido = companyArea
    ? empresaIdentidade?.commercial_name
      || profileName?.trim()
      || perfilIdentidade?.full_name
      || "Área da empresa"
    : providerArea
      ? prestadorIdentidade?.commercial_name
        || profileName?.trim()
        || perfilIdentidade?.full_name
        || "Área profissional"
      : perfilIdentidade?.full_name
        || profileName?.trim()
        || "Área do cliente";
  const imagemPerfil = companyArea
    ? empresaIdentidade?.logo
    : perfilIdentidade?.photo;
  const iniciais = nomeExibido.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("").toLocaleUpperCase("pt-AO");
  useEffect(() => {
    definirImagemPerfilFalhou(false);
  }, [imagemPerfil]);
  useEffect(() => {
    if (providerArea) rememberActiveArea("provider");
    else if (pathname === "/conta") rememberActiveArea("client");
  }, [pathname, providerArea]);
  const brand = (
    <Link
      className={styles.brand}
      href={companyArea ? "/empresa" : providerArea ? "/prestador" : account ? "/conta" : "/"}
      aria-label="Conect Services — início"
    >
      <span className={styles.brandMark} aria-hidden="true">C</span>
      <span className={styles.brandWord}>conect<span>.</span><small>services</small></span>
    </Link>
  );

  if (!account) {
    return (
      <main className={`${styles.page} ${styles.authPage} ${paginaLogin ? styles.loginPage : ""}`}>
        <div className={styles.authLayout}>
          <section className={`${styles.authShowcase} ${paginaLogin ? styles.loginShowcase : ""}`}>
            {paginaLogin && (
              <div className={styles.loginOrbs} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            )}
            {brand}
            <div className={`${styles.authShowcaseCopy} ${paginaLogin ? styles.loginShowcaseCopy : ""}`}>
              <p>Conect Services</p>
              <h2>Conectando pessoas, empresas e serviços em Angola.</h2>
              <span>Encontra serviços e profissionais de confiança, ou faz o teu negócio chegar a novos clientes.</span>
            </div>
            <ul>
              <li><span>✓</span> Encontra serviços e profissionais</li>
              <li><span>✓</span> Divulga o teu negócio</li>
              <li><span>✓</span> Conecta-te com clientes</li>
            </ul>
            <small>Conectando o mundo, movendo o futuro.</small>
          </section>
          <section className={`${styles.authFormPane} ${paginaLogin ? styles.loginFormPane : ""}`}>
            <div className={`${styles.authFormInner} ${paginaLogin ? styles.loginFormInner : ""}`}>
              <div className={styles.authMobileBrand}>{brand}</div>
              {children}
              <Link className={styles.homeLink} href="/">Voltar à página inicial</Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const nav = (mobile = false) => (
    <nav className={mobile ? styles.mobileNav : styles.workspaceNav} aria-label={mobile ? "Navegação móvel" : "Navegação da área pessoal"}>
      {(mobile
        ? areaAtual === "client"
          ? [itemsDaArea[0], itemsDaArea[1], itemsDaArea[3], itemsDaArea[4], itemsDaArea[6]]
          : areaAtual === "provider"
            ? [itemsDaArea[0], itemsDaArea[1], itemsDaArea[2], itemsDaArea[3], itemsDaArea[6]]
            : [itemsDaArea[0], itemsDaArea[1], itemsDaArea[2], itemsDaArea[4], itemsDaArea[7]]
        : itemsDaArea).map((item) => {
        const hrefPath = item.href.split("#")[0];
        const ativo = item.href.includes("#")
          ? false
          : hrefPath === "/conta"
            ? pathname === hrefPath
            : pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
        const Icon = item.icon;
        return (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className={styles.workspaceLink}
            aria-current={ativo ? "page" : undefined}
            onClick={() => {
              if (item.href === "/conta") rememberActiveArea("client");
              if (item.href.startsWith("/prestador")) rememberActiveArea("provider");
            }}
          >
            <span className={`${styles.navLetter} shrink-0`} aria-hidden="true"><Icon size={18} strokeWidth={1.8} /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  async function terminarSessao() {
    definirTerminoSessao(true);
    definirErroSessao("");
    try {
      const resposta = await fetch("/api/auth/logout/", { method: "POST" });
      if (!resposta.ok) {
        const dados: unknown = await resposta.json().catch(() => null);
        const detalhe = dados && typeof dados === "object" && "detail" in dados
          && typeof dados.detail === "string" ? dados.detail : "";
        definirErroSessao(detalhe || "Não foi possível terminar a sessão. Tenta novamente.");
        return;
      }
      router.replace("/");
    } catch {
      definirErroSessao("Não foi possível contactar o serviço para terminar a sessão.");
    } finally {
      definirTerminoSessao(false);
    }
  }

  return (
    <main className={`${styles.page} ${styles.workspacePage} antialiased`}>
      <header className={styles.workspaceHeader}>
        <div className={styles.workspaceHeaderInner}>
          <div className={styles.workspaceGreeting}>
            <span>Área de trabalho</span>
            <strong>{companyArea ? "Painel da empresa" : providerArea ? "Painel do prestador" : "Painel do cliente"}</strong>
          </div>
          <div className={styles.workspaceHeaderActions}>
            <Link
              href={providerArea ? "/conta" : "/prestador"}
              onClick={() => rememberActiveArea(providerArea ? "client" : "provider")}
            >
              {providerArea ? "Área de cliente" : "Área profissional"}
            </Link>
            <span id="notifications"><NotificationCenter /></span>
            <Link href={providerArea ? "/prestador/pedidos" : "/explorar"}>
              {providerArea ? "Ver oportunidades" : "Descobrir serviços"}
            </Link>
            <Link href="/mensagens">Mensagens</Link>
            <Link
              className={styles.createAction}
              href={companyArea ? "/empresa/produtos#formulario-produto" : providerArea ? "/prestador/servicos#formulario-servico" : "/pedidos/novo"}
            >
              <Plus size={16} aria-hidden="true" /> {companyArea ? "Adicionar produto" : providerArea ? "Adicionar serviço" : "Pedir serviço"}
            </Link>
          </div>
        </div>
      </header>
      <div className={`${styles.workspaceLayout} ${styles[`workspaceArea_${areaAtual}`]}`}>
        <aside className={styles.workspaceSidebar}>
          {brand}
          <div className={styles.sidebarProfile}>
            {imagemPerfil && !imagemPerfilFalhou ? (
              <Image
                className={styles.sidebarAvatar}
                src={imagemPerfil}
                alt={`Imagem de perfil de ${nomeExibido}`}
                width={38}
                height={38}
                unoptimized
                onError={() => definirImagemPerfilFalhou(true)}
              />
            ) : (
              <span className={styles.sidebarAvatar} aria-hidden="true">{iniciais || "C"}</span>
            )}
            <span className={styles.sidebarProfileDetails}>
              <strong>{nomeExibido}</strong>
              <small className="truncate">{companyArea ? "Empresa" : providerArea ? "Prestador" : "Cliente"}</small>
            </span>
          </div>
          {erroPerfilIdentidade && <p className={styles.sidebarProfileError} role="status">{erroPerfilIdentidade}</p>}
          <p className={styles.sidebarCaption}>{companyArea ? "Gestão da empresa" : providerArea ? "Gestão profissional" : "Menu principal"}</p>
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
          <div className={styles.sidebarBottom}>
            {erroSessao && <p className={styles.sidebarError} role="alert">{erroSessao}</p>}
            <button type="button" onClick={() => void terminarSessao()} disabled={aTerminarSessao}>
              <LogOut size={17} aria-hidden="true" />
              {aTerminarSessao ? "A terminar sessão…" : "Sair"}
            </button>
          </div>
        </aside>
        <div className={styles.workspaceMain}>
          <section className={`${styles.card} ${styles.accountCard}`}>{children}</section>
        </div>
        <aside className={styles.workspaceAside} aria-label="Atalhos">
          <section className={styles.asideCard}>
            <div className={styles.asideHeading}>
              <p className={styles.sidebarCaption}>Começa por aqui</p>
              <span>Atalhos para chegares mais depressa ao que precisas.</span>
            </div>
            {(companyArea
              ? atalhosEmpresa
              : providerArea
                ? atalhosProfissionais
                : atalhosCliente
            ).map((atalho) => {
              const Icon = atalho.icon;
              return (
                <Link className={styles.asideLink} href={atalho.href} key={atalho.href}>
                  <span className={styles.asideLinkIcon} aria-hidden="true">
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className={styles.asideLinkCopy}>
                    <strong>{atalho.label}</strong>
                    <span>{atalho.description}</span>
                  </span>
                  <ArrowUpRight className={styles.asideLinkArrow} size={15} aria-hidden="true" />
                </Link>
              );
            })}
            {providerArea && !companyArea && (
              <>
                <p className={styles.asideGroupTitle}>Também na tua empresa</p>
                {atalhosEmpresa.map((atalho) => {
                  const Icon = atalho.icon;
                  return (
                    <Link className={styles.asideLink} href={atalho.href} key={atalho.href}>
                      <span className={styles.asideLinkIcon} aria-hidden="true">
                        <Icon size={16} strokeWidth={1.8} />
                      </span>
                      <span className={styles.asideLinkCopy}>
                        <strong>{atalho.label}</strong>
                        <span>{atalho.description}</span>
                      </span>
                      <ArrowUpRight className={styles.asideLinkArrow} size={15} aria-hidden="true" />
                    </Link>
                  );
                })}
              </>
            )}
          </section>
          {!providerArea && (
            <section className={styles.promoCard}>
              <span>Conect para empresas</span>
              <strong>Divulgue o seu negócio</strong>
              <p>Encontre novos clientes e mostre os seus serviços a toda a comunidade.</p>
              <Link href="/empresa">Saiba mais <span aria-hidden="true">→</span></Link>
            </section>
          )}
          <p className={styles.workspaceFootnote}>Uma comunidade de serviços feita para Angola.</p>
        </aside>
      </div>
      {nav(true)}
    </main>
  );
}
