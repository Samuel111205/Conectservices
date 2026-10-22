"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiRequestError, requisitarJson } from "@/lib/api-client";
import BusinessLogo from "@/app/components/business-logo";
import styles from "./marketplace-details.module.css";

type ApiPage<T> = { results: T[] };
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
type Service = {
  id: number;
  provider_id: number;
  category: number;
  name: string;
  description: string;
  minimum_price: string | null;
  maximum_price: string | null;
  currency: string;
  price_type: string;
  duration_minutes: number | null;
};
type Category = { id: number; name: string };
type Review = {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
};
type Availability = { id: number; weekday: number; start_time: string; end_time: string };
type PublicData = {
  provider: Provider;
  services: Service[];
  categories: Category[];
  reviews: Review[];
  availability: Availability[];
};

const diasSemana = [
  "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira",
  "Sexta-feira", "Sábado", "Domingo",
];
const nomesDiasEmpresa: Record<string, string> = {
  monday: "Segunda-feira",
  tuesday: "Terça-feira",
  wednesday: "Quarta-feira",
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sábado",
  sunday: "Domingo",
};

function formatarPreco(servico: Service) {
  if (servico.price_type === "ON_REQUEST" || servico.minimum_price === null) {
    return "Preço sob consulta";
  }
  const minimo = Number(servico.minimum_price).toLocaleString("pt-AO");
  if (servico.price_type === "RANGE" && servico.maximum_price !== null) {
    return `${minimo}–${Number(servico.maximum_price).toLocaleString("pt-AO")} ${servico.currency}`;
  }
  if (servico.price_type === "STARTING_AT") return `Desde ${minimo} ${servico.currency}`;
  return `${minimo} ${servico.currency}`;
}

function formatarData(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? ""
    : new Intl.DateTimeFormat("pt-AO", { day: "numeric", month: "long", year: "numeric" }).format(data);
}

function criarUrlPedido(servico: Service, prestador: Provider) {
  const parametros = new URLSearchParams({
    category: String(servico.category),
    title: servico.name,
    description: servico.description,
    source_provider: prestador.commercial_name,
  });
  if (servico.price_type !== "ON_REQUEST" && servico.minimum_price !== null) {
    parametros.set("minimum_budget", servico.minimum_price);
  }
  if (servico.maximum_price !== null) parametros.set("maximum_budget", servico.maximum_price);
  if (servico.duration_minutes !== null) parametros.set("duration", String(servico.duration_minutes));
  return `/pedidos/novo?${parametros.toString()}`;
}

function CabecalhoMarketplace() {
  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/" aria-label="Conect Services — página inicial">
        <span className={styles.brandMark} aria-hidden="true">C</span>
        <span>conect<span className={styles.brandAccent}>.</span><small>services</small></span>
      </Link>
      <nav className={styles.headerLinks} aria-label="Navegação">
        <Link href="/explorar">Explorar serviços</Link>
        <Link href="/entrar">A minha conta</Link>
      </nav>
    </header>
  );
}

function EstadoCarregamento({ texto }: { texto: string }) {
  return <p className={styles.loading} role="status" aria-live="polite">{texto}</p>;
}

function EstadoErro({ mensagem }: { mensagem: string }) {
  return (
    <section className={styles.error} role="alert">
      <h1>Não foi possível abrir esta página</h1>
      <p>{mensagem}</p>
      <Link href="/explorar">Voltar a explorar serviços</Link>
    </section>
  );
}

function PerfilPrestador({ dados }: { dados: PublicData }) {
  const { provider, services, categories, reviews, availability } = dados;
  return (
    <>
      <section className={styles.providerHero}>
        {provider.business_profile ? (
          <BusinessLogo
            className={`${styles.providerAvatar} ${styles.providerAvatarImage}`}
            companyName={provider.commercial_name}
            logoUrl={provider.business_profile.logo}
            width={78}
            height={78}
          />
        ) : (
          <div className={styles.providerAvatar} aria-hidden="true">
            {provider.commercial_name.slice(0, 1).toLocaleUpperCase("pt-AO")}
          </div>
        )}
        <div className={styles.providerIntro}>
          <p className={styles.eyebrow}>
            {provider.business_profile ? "Empresa · prestador verificado" : "Prestador verificado"}
          </p>
          <h1>{provider.commercial_name}</h1>
          <p>{provider.description || "Profissional verificado na comunidade Conect Services."}</p>
          <div className={styles.metrics}>
            <span><strong>★ {provider.average_rating ?? "Novo"}</strong> avaliação média</span>
            <span><strong>{provider.review_count}</strong> {provider.review_count === 1 ? "avaliação" : "avaliações"}</span>
            <span><strong>{provider.active_service_count}</strong> {provider.active_service_count === 1 ? "serviço ativo" : "serviços ativos"}</span>
          </div>
          {provider.business_profile && (
            <div className={styles.businessPublicDetails}>
              {provider.business_profile.website && (
                <a href={provider.business_profile.website} target="_blank" rel="noopener noreferrer">
                  Visitar website da empresa
                </a>
              )}
              {Object.entries(provider.business_profile.opening_hours ?? {}).length > 0 && (
                <dl>
                  {Object.entries(provider.business_profile.opening_hours).map(([day, hours]) => (
                    <div key={day}>
                      <dt>{nomesDiasEmpresa[day] ?? day}</dt>
                      <dd>{hours}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="servicos-do-prestador">
        <div className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>Catálogo profissional</p><h2 id="servicos-do-prestador">Serviços disponíveis</h2></div>
          <span>{services.length} {services.length === 1 ? "serviço" : "serviços"}</span>
        </div>
        {services.length ? (
          <div className={styles.serviceGrid}>
            {services.map((service) => (
              <article className={styles.serviceCard} key={service.id}>
                <div className={styles.serviceMeta}>
                  <span>{categories.find((category) => category.id === service.category)?.name ?? "Serviço profissional"}</span>
                  {service.duration_minutes && <span>{service.duration_minutes} min</span>}
                </div>
                <h3>{service.name}</h3>
                <p>{service.description || "Fala com o prestador para saber mais sobre este serviço."}</p>
                <div className={styles.serviceFooter}>
                  <strong className={styles.price}>{formatarPreco(service)}</strong>
                  <Link className={styles.primaryLink} href={`/servicos/${service.id}`}>Ver detalhes</Link>
                </div>
              </article>
            ))}
          </div>
        ) : <p className={styles.empty}>Este prestador ainda não tem serviços publicados.</p>}
      </section>

      <div className={styles.detailColumns}>
        <section className={styles.section} aria-labelledby="horario-prestador">
          <div className={styles.sectionHeader}><h2 id="horario-prestador">Disponibilidade semanal</h2></div>
          {availability.length ? (
            <ul className={styles.scheduleList}>
              {availability.map((slot) => (
                <li key={slot.id}>
                  <strong>{diasSemana[slot.weekday] ?? "Dia não indicado"}</strong>
                  <span>{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</span>
                </li>
              ))}
            </ul>
          ) : <p className={styles.empty}>O prestador ainda não publicou horários semanais. Envia um pedido para combinar a disponibilidade.</p>}
        </section>

        <section className={styles.section} aria-labelledby="avaliacoes-prestador">
          <div className={styles.sectionHeader}><h2 id="avaliacoes-prestador">Avaliações de clientes</h2></div>
          {reviews.length ? (
            <ul className={styles.reviewList}>
              {reviews.slice(0, 6).map((review) => (
                <li className={styles.reviewCard} key={review.id}>
                  <div className={styles.reviewTop}><strong>Cliente verificado</strong><time dateTime={review.created_at}>{formatarData(review.created_at)}</time></div>
                  <span className={styles.reviewRating} aria-label={`${review.rating} em 5 estrelas`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                  <p>{review.comment || "O cliente deixou uma avaliação sem comentário."}</p>
                </li>
              ))}
            </ul>
          ) : <p className={styles.empty}>Este prestador ainda não recebeu avaliações.</p>}
        </section>
      </div>
    </>
  );
}

export function ProviderDetails({ providerId }: { providerId: string }) {
  const [dados, definirDados] = useState<PublicData | null>(null);
  const [erro, definirErro] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const consulta = new URLSearchParams({ provider: providerId });
    const consultaReviews = new URLSearchParams({ provider_id: providerId, page: "1" });
    Promise.all([
      requisitarJson<Provider>(`/api/public/providers/${providerId}/`, { signal: controller.signal }),
      requisitarJson<ApiPage<Service>>(`/api/public/services/?${consulta}`, { signal: controller.signal }),
      requisitarJson<ApiPage<Category>>("/api/public/categories/", { signal: controller.signal }),
      requisitarJson<ApiPage<Review>>(`/api/public/reviews/?${consultaReviews}`, { signal: controller.signal }),
      requisitarJson<ApiPage<Availability>>(`/api/public/availability/?${consulta}`, { signal: controller.signal }),
    ])
      .then(([provider, servicePage, categoryPage, reviewPage, availabilityPage]) => {
        definirDados({
          provider,
          services: servicePage.results,
          categories: categoryPage.results,
          reviews: reviewPage.results,
          availability: availabilityPage.results,
        });
      })
      .catch((falha: unknown) => {
        if (controller.signal.aborted) return;
        definirErro(falha instanceof ApiRequestError ? falha.message : "Tenta novamente dentro de alguns instantes.");
      });
    return () => controller.abort();
  }, [providerId]);

  return (
    <main className={styles.page}>
      <CabecalhoMarketplace />
      <div className={styles.content}>
        <Link className={styles.breadcrumb} href="/explorar">← Voltar ao marketplace</Link>
        {erro ? <EstadoErro mensagem={erro} /> : dados ? <PerfilPrestador dados={dados} /> : <EstadoCarregamento texto="A carregar perfil, serviços e avaliações…" />}
      </div>
    </main>
  );
}

export function ServiceDetails({ serviceId }: { serviceId: string }) {
  const [service, definirService] = useState<Service | null>(null);
  const [provider, definirProvider] = useState<Provider | null>(null);
  const [categoryName, definirCategoryName] = useState("");
  const [availability, definirAvailability] = useState<Availability[]>([]);
  const [erro, definirErro] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    requisitarJson<Service>(`/api/public/services/${serviceId}/`, { signal: controller.signal })
      .then(async (serviceData) => {
        const consulta = new URLSearchParams({ provider: String(serviceData.provider_id) });
        const [providerData, categories, schedule] = await Promise.all([
          requisitarJson<Provider>(`/api/public/providers/${serviceData.provider_id}/`, { signal: controller.signal }),
          requisitarJson<ApiPage<Category>>("/api/public/categories/", { signal: controller.signal }),
          requisitarJson<ApiPage<Availability>>(`/api/public/availability/?${consulta}`, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        definirService(serviceData);
        definirProvider(providerData);
        definirCategoryName(categories.results.find((category) => category.id === serviceData.category)?.name ?? "Serviço profissional");
        definirAvailability(schedule.results);
      })
      .catch((falha: unknown) => {
        if (controller.signal.aborted) return;
        definirErro(falha instanceof ApiRequestError ? falha.message : "Tenta novamente dentro de alguns instantes.");
      });
    return () => controller.abort();
  }, [serviceId]);

  return (
    <main className={styles.page}>
      <CabecalhoMarketplace />
      <div className={styles.content}>
        <Link className={styles.breadcrumb} href="/explorar">← Voltar ao marketplace</Link>
        {erro ? <EstadoErro mensagem={erro} /> : service && provider ? (
          <>
            <section className={styles.serviceHero}>
              <p className={styles.eyebrow}>{categoryName}</p>
              <h1>{service.name}</h1>
              <p className={styles.serviceDescription}>{service.description || "Fala com o prestador para conhecer os detalhes deste serviço."}</p>
              <div className={styles.serviceHeroFooter}>
                <strong className={styles.price}>{formatarPreco(service)}</strong>
                {service.duration_minutes && <span>Duração prevista: {service.duration_minutes} min</span>}
              </div>
              <Link className={styles.primaryLink} href={criarUrlPedido(service, provider)}>Pedir este serviço</Link>
            </section>
            <section className={styles.providerSummary}>
              <div className={styles.providerAvatar} aria-hidden="true">{provider.commercial_name.slice(0, 1).toLocaleUpperCase("pt-AO")}</div>
              <div>
                <p className={styles.eyebrow}>Prestador verificado</p>
                <h2>{provider.commercial_name}</h2>
                <p>{provider.description || "Profissional verificado na comunidade Conect Services."}</p>
                <span className={styles.summaryRating}>★ {provider.average_rating ?? "Novo"} · {provider.review_count} {provider.review_count === 1 ? "avaliação" : "avaliações"}</span>
              </div>
              <Link className={styles.secondaryLink} href={`/prestadores/${provider.id}`}>Ver perfil completo</Link>
            </section>
            <section className={styles.section} aria-labelledby="horario-servico">
              <div className={styles.sectionHeader}><h2 id="horario-servico">Disponibilidade semanal</h2></div>
              {availability.length ? (
                <ul className={styles.scheduleList}>
                  {availability.map((slot) => <li key={slot.id}><strong>{diasSemana[slot.weekday] ?? "Dia não indicado"}</strong><span>{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</span></li>)}
                </ul>
              ) : <p className={styles.empty}>A disponibilidade é combinada diretamente com o prestador.</p>}
            </section>
          </>
        ) : <EstadoCarregamento texto="A carregar detalhes do serviço…" />}
      </div>
    </main>
  );
}
