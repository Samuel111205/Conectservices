"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, MessageCircle, ShoppingBag, Star } from "lucide-react";
import { fetchApi } from "@/lib/api-client";
import { useRouter } from "@/lib/navigation";
import BusinessLogo from "@/app/components/business-logo";
import AnalyticsPanel from "@/app/components/analytics-panel";
import Link from "@/lib/link";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";
import commerceStyles from "./commerce.module.css";

const days = [
  { key: "monday", label: "Segunda-feira" },
  { key: "tuesday", label: "Terça-feira" },
  { key: "wednesday", label: "Quarta-feira" },
  { key: "thursday", label: "Quinta-feira" },
  { key: "friday", label: "Sexta-feira" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

const emptyForm = {
  business_type: "COMPANY",
  commercial_name: "",
  description: "",
  business_phone: "",
  business_email: "",
  registered_name: "",
  website: "",
  address: "",
};

function firstMessage(value) {
  if (value && typeof value === "object" && "detail" in value) {
    const detail = value.detail;
    if (typeof detail === "string") return detail;
  }
  if (value && typeof value === "object") {
    const message = Object.values(value).flat()[0];
    if (message) return String(message);
  }
  return "Não foi possível concluir o pedido. Tenta novamente.";
}

export default function PaginaEmpresa() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [hours, setHours] = useState(Object.fromEntries(days.map(({ key }) => [key, ""])));
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [metricsError, setMetricsError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetchApi("/api/auth/businesses/me/", {
          cache: "no-store",
        });
        if (response.status === 401) {
          router.replace("/registar?next=%2Fempresa");
          return;
        }
        if (response.status === 404) {
          if (active) setProfile(null);
          return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(firstMessage(data));
        if (!active) return;

        setProfile(data);
        setForm({
          business_type: data.business_type || "COMPANY",
          commercial_name: data.commercial_name,
          description: data.description,
          business_phone: data.business_phone,
          business_email: data.business_email,
          registered_name: data.registered_name,
          website: data.website,
          address: data.address,
        });
        setHours((current) => ({
          ...current,
          ...Object.fromEntries(days.map(({ key }) => [key, data.opening_hours?.[key] ?? ""])),
        }));
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error
            ? reason.message
            : "Não foi possível carregar o perfil.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!profile) return undefined;
    let active = true;

    async function loadMetrics() {
      try {
        const responses = await Promise.all([
          fetchApi("/api/auth/dashboard/", { cache: "no-store" }),
          fetchApi("/api/auth/product-orders/", { cache: "no-store" }),
          fetchApi("/api/auth/conversations/", { cache: "no-store" }),
        ]);
        const payloads = await Promise.all(responses.map((response) => response.json()));
        const failed = responses.findIndex((response) => !response.ok);
        if (failed >= 0) throw new Error(firstMessage(payloads[failed]));
        if (!active) return;

        const [dashboard, orders, conversations] = payloads;
        const provider = dashboard?.provider;
        setMetrics({
          services: provider?.services?.active ?? 0,
          orders: orders?.count ?? orders?.results?.filter((item) => item.is_provider).length ?? 0,
          contacts: conversations?.count ?? conversations?.results?.length ?? 0,
          rating: provider?.reviews?.average_rating ?? null,
        });
        setMetricsError("");
      } catch (reason) {
        if (active) {
          setMetricsError(reason instanceof Error
            ? reason.message
            : "Não foi possível carregar as métricas.");
        }
      }
    }

    void loadMetrics();
    return () => { active = false; };
  }, [profile]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectLogo(file) {
    setError("");
    setLogoFile(file);
    setLogoPreview("");
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setLogoFile(null);
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const openingHours = Object.fromEntries(
      days
        .map(({ key }) => [key, hours[key].trim()])
        .filter(([, value]) => value),
    );
    const payload = { ...form, opening_hours: openingHours };

    try {
      const body = logoFile
        ? (() => {
            const data = new FormData();
            Object.entries(form).forEach(([key, value]) => data.set(key, value));
            data.set("opening_hours", JSON.stringify(openingHours));
            data.set("logo", logoFile);
            return data;
          })()
        : JSON.stringify(payload);
      const response = await fetchApi(
        profile ? "/api/auth/businesses/me/" : "/api/auth/businesses/",
        {
          method: profile ? "PATCH" : "POST",
          ...(logoFile ? {} : { headers: { "Content-Type": "application/json" } }),
          body,
        },
      );
      const data = await response.json();
      if (response.status === 401) {
        router.replace("/entrar?next=%2Fempresa");
        return;
      }
      if (!response.ok) {
        setError(firstMessage(data));
        return;
      }
      setProfile(data);
      setForm((current) => ({ ...current, business_type: data.business_type }));
      setLogoFile(null);
      setLogoPreview("");
      setSuccess("Perfil guardado. A verificação continua sujeita à revisão da plataforma.");
    } catch (reason) {
      setError(reason instanceof Error
        ? reason.message
        : "Não foi possível contactar o serviço. Tenta novamente.");
    } finally {
      setSaving(false);
    }
  }

  const audiencePath = form.business_type === "ENTREPRENEUR"
    ? "/empreendedores"
    : "/empresas";

  return (
    <EstruturaAutenticacao
      account
      profileName={profile?.commercial_name}
    >
      <section className={commerceStyles.commerceSection} id="perfil-empresa">
        <div className={commerceStyles.commerceHeading}>
          <div>
            <p className={styles.eyebrow}>Área profissional</p>
            <h1>{profile ? "Apresente o seu negócio" : "Crie o perfil do seu negócio"}</h1>
            <p>Escolha como quer aparecer nas vitrines públicas da Conect Services.</p>
          </div>
          {profile?.verification_status === "VERIFIED" && (
            <Link href={audiencePath}>Ver a sua vitrine pública →</Link>
          )}
        </div>

        <div className={commerceStyles.commerceLinks}>
          <Link className={commerceStyles.primaryLink} href="/prestador/servicos">Gerir serviços</Link>
          <Link href="/empresa/produtos">Gerir produtos</Link>
          <Link href="/empresa/encomendas">Ver encomendas</Link>
        </div>

        {profile && (
          <div className={commerceStyles.businessMetrics} aria-label="Resumo da atividade">
            {[
              { label: "Serviços ativos", value: metrics?.services, icon: BriefcaseBusiness },
              { label: "Encomendas", value: metrics?.orders, icon: ShoppingBag },
              { label: "Contactos", value: metrics?.contacts, icon: MessageCircle },
              { label: "Avaliação", value: metrics?.rating ?? "Novo", icon: Star },
            ].map(({ label, value, icon: Icon }) => (
              <article key={label}>
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                <strong>{loading || metrics === null ? "—" : value}</strong>
              </article>
            ))}
          </div>
        )}

        {metricsError && <p className={commerceStyles.inlineError} role="status">{metricsError}</p>}

        {loading ? (
          <p role="status">A carregar o perfil…</p>
        ) : (
          <form className={commerceStyles.commerceForm} onSubmit={saveProfile}>
            <label>
              Tipo de perfil
              <select
                required
                value={form.business_type}
                onChange={(event) => updateField("business_type", event.target.value)}
              >
                <option value="COMPANY">Empresa</option>
                <option value="ENTREPRENEUR">Empreendedor ou trabalhador por conta própria</option>
              </select>
            </label>
            <label>
              Nome comercial
              <input
                required
                maxLength={160}
                value={form.commercial_name}
                onChange={(event) => updateField("commercial_name", event.target.value)}
              />
            </label>
            <label>
              Nome legal <span>(opcional)</span>
              <input
                maxLength={160}
                value={form.registered_name}
                onChange={(event) => updateField("registered_name", event.target.value)}
              />
            </label>
            <label className={commerceStyles.wide}>
              Descrição <span>(opcional)</span>
              <textarea
                maxLength={5000}
                rows={4}
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
              />
            </label>
            <label>
              Telefone comercial <span>(opcional)</span>
              <input
                type="tel"
                maxLength={32}
                value={form.business_phone}
                onChange={(event) => updateField("business_phone", event.target.value)}
              />
            </label>
            <label>
              Email comercial <span>(opcional)</span>
              <input
                type="email"
                value={form.business_email}
                onChange={(event) => updateField("business_email", event.target.value)}
              />
            </label>
            <label>
              Website <span>(opcional)</span>
              <input
                type="url"
                placeholder="https://"
                value={form.website}
                onChange={(event) => updateField("website", event.target.value)}
              />
            </label>
            <label>
              Morada comercial <span>(opcional, visível apenas nesta conta)</span>
              <input
                maxLength={250}
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
              />
            </label>

            <fieldset className={`${commerceStyles.wide} ${styles.companyHours}`}>
              <legend>Horário de funcionamento <span>(opcional)</span></legend>
              <div className={styles.companyHoursGrid}>
                {days.map(({ key, label }) => (
                  <label className={styles.field} key={key}>
                    {label}
                    <input
                      maxLength={120}
                      placeholder="08:00–17:00 ou Fechado"
                      value={hours[key]}
                      onChange={(event) => setHours((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))}
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={`${commerceStyles.profileImagePanel} ${commerceStyles.wide}`}>
              <BusinessLogo
                className={commerceStyles.profileLogoPreview}
                companyName={form.commercial_name || "O seu negócio"}
                logoUrl={logoPreview || profile?.logo}
                width={88}
                height={88}
              />
              <div>
                <strong>Imagem do perfil</strong>
                <p>Uma imagem simples ajuda as pessoas a reconhecerem o seu negócio.</p>
              </div>
            </div>
            <label className={commerceStyles.wide}>
              Escolher imagem <span>(JPEG, PNG ou WebP, máximo 5 MB)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => selectLogo(event.target.files?.[0] ?? null)}
              />
            </label>

            {error && <p className={`${commerceStyles.inlineError} ${commerceStyles.wide}`} role="alert">{error}</p>}
            {success && <p className={`${commerceStyles.inlineMessage} ${commerceStyles.wide}`} role="status">{success}</p>}
            <div className={`${commerceStyles.formActions} ${commerceStyles.wide}`}>
              <button type="submit" disabled={saving}>
                {saving ? "A guardar…" : profile ? "Guardar alterações" : "Criar perfil"}
              </button>
              {profile?.verification_status === "VERIFIED" && (
                <Link href={audiencePath}>Abrir vitrine pública</Link>
              )}
            </div>
          </form>
        )}

        <p className={styles.profileHint}>
          O tipo de perfil define a vitrine onde o seu negócio aparece. A verificação continua
          sujeita à revisão administrativa.
        </p>
      </section>
      {profile && <AnalyticsPanel />}
    </EstruturaAutenticacao>
  );
}
