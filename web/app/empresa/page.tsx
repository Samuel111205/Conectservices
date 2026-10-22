"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BusinessLogo from "@/app/components/business-logo";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";
import commerceStyles from "./commerce.module.css";

type BusinessProfile = {
  id: number;
  commercial_name: string;
  description: string;
  business_phone: string;
  business_email: string;
  verification_status: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";
  registered_name: string;
  logo: string;
  website: string;
  address: string;
  opening_hours: Record<string, string>;
};

type BusinessForm = Pick<
  BusinessProfile,
  | "commercial_name"
  | "description"
  | "business_phone"
  | "business_email"
  | "registered_name"
  | "website"
  | "address"
>;

type Day =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

type FormErrors = Record<string, string[]>;

const days: { key: Day; label: string }[] = [
  { key: "monday", label: "Segunda-feira" },
  { key: "tuesday", label: "Terça-feira" },
  { key: "wednesday", label: "Quarta-feira" },
  { key: "thursday", label: "Quinta-feira" },
  { key: "friday", label: "Sexta-feira" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

const emptyForm: BusinessForm = {
  commercial_name: "",
  description: "",
  business_phone: "",
  business_email: "",
  registered_name: "",
  website: "",
  address: "",
};

function extrairErros(value: unknown): FormErrors {
  if (!value || typeof value !== "object") {
    return { detail: ["Não foi possível concluir o pedido."] };
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, message]) => [
      key,
      Array.isArray(message) ? message.map(String) : [String(message)],
    ]),
  );
}

function primeiraMensagem(value: unknown) {
  if (value && typeof value === "object" && "detail" in value) {
    const detail = (value as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return Object.values(extrairErros(value))[0]?.[0] ?? "Não foi possível concluir o pedido.";
}

export default function PaginaEmpresa() {
  const router = useRouter();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [form, setForm] = useState<BusinessForm>(emptyForm);
  const [hours, setHours] = useState<Record<Day, string>>({
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/auth/businesses/me/", {
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
        const data: unknown = await response.json();
        if (!response.ok) throw new Error(primeiraMensagem(data));

        const business = data as BusinessProfile;
        if (!active) return;
        setProfile(business);
        setForm({
          commercial_name: business.commercial_name,
          description: business.description,
          business_phone: business.business_phone,
          business_email: business.business_email,
          registered_name: business.registered_name,
          website: business.website,
          address: business.address,
        });
        setHours((current) => ({
          ...current,
          ...Object.fromEntries(
            days.map(({ key }) => [key, business.opening_hours?.[key] ?? ""]),
          ),
        }));
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar o perfil empresarial.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [router]);

  function updateField<Field extends keyof BusinessForm>(
    field: Field,
    value: BusinessForm[Field],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectLogo(file: File | null) {
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

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
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
      const body: BodyInit = logoFile
        ? (() => {
            const data = new FormData();
            Object.entries(form).forEach(([key, value]) => data.set(key, value));
            data.set("opening_hours", JSON.stringify(openingHours));
            data.set("logo", logoFile);
            return data;
          })()
        : JSON.stringify(payload);
      const response = await fetch(
        profile ? "/api/auth/businesses/me/" : "/api/auth/businesses/",
        {
          method: profile ? "PATCH" : "POST",
          ...(logoFile ? {} : { headers: { "Content-Type": "application/json" } }),
          body,
        },
      );
      const data: unknown = await response.json();
      if (response.status === 401) {
        router.replace("/entrar?next=%2Fempresa");
        return;
      }
      if (!response.ok) {
        setError(primeiraMensagem(data));
        return;
      }
      setProfile(data as BusinessProfile);
      setLogoFile(null);
      setLogoPreview("");
      setSuccess("Perfil empresarial guardado.");
    } catch {
      setError("Não foi possível contactar o serviço. Tenta novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EstruturaAutenticacao account>
      <p className={styles.eyebrow}>Área empresarial</p>
      <h1>{profile ? "Perfil da empresa" : "Apresente a sua empresa"}</h1>
      <p className={styles.intro}>
        Partilhe os dados comerciais da empresa e mantenha o contacto e o horário actualizados.
      </p>

      {loading ? (
        <p className={styles.profileHint} role="status">A carregar o perfil empresarial…</p>
      ) : (
        <section className={styles.profileSection}>
          {profile && (
            <div className={commerceStyles.commerceLinks}>
              <Link className={commerceStyles.primaryLink} href="/empresa/produtos#formulario-produto">Adicionar produto</Link>
              <Link href="/empresa/produtos">Gerir produtos</Link>
              <Link href="/empresa/encomendas">Ver encomendas recebidas</Link>
            </div>
          )}
          {profile && (
            <div className={styles.profileHeading}>
              <h2>Dados comerciais</h2>
              <span className={styles.profileBadge}>
                {profile.verification_status === "VERIFIED"
                  ? "Prestador verificado"
                  : profile.verification_status === "REJECTED"
                    ? "Verificação necessita de ajustes"
                    : profile.verification_status === "SUSPENDED"
                      ? "Conta suspensa"
                      : "Verificação pendente"}
              </span>
            </div>
          )}
          <form className={styles.form} onSubmit={saveProfile}>
            <label className={styles.field}>
              Nome comercial
              <input
                required
                maxLength={160}
                value={form.commercial_name}
                onChange={(event) => updateField("commercial_name", event.target.value)}
              />
            </label>
            <label className={styles.field}>
              Nome legal <span>(opcional)</span>
              <input
                maxLength={160}
                value={form.registered_name}
                onChange={(event) => updateField("registered_name", event.target.value)}
              />
            </label>
            <label className={styles.field}>
              Descrição <span>(opcional)</span>
              <textarea
                maxLength={5000}
                rows={4}
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
              />
            </label>
            <div className={styles.formRow}>
              <label className={styles.field}>
                Telefone comercial <span>(opcional)</span>
                <input
                  type="tel"
                  maxLength={32}
                  value={form.business_phone}
                  onChange={(event) => updateField("business_phone", event.target.value)}
                />
              </label>
              <label className={styles.field}>
                Email comercial <span>(opcional)</span>
                <input
                  type="email"
                  value={form.business_email}
                  onChange={(event) => updateField("business_email", event.target.value)}
                />
              </label>
            </div>
            <label className={styles.field}>
              Website <span>(opcional)</span>
              <input
                type="url"
                placeholder="https://"
                value={form.website}
                onChange={(event) => updateField("website", event.target.value)}
              />
            </label>
            <label className={styles.field}>
              Morada comercial <span>(opcional, visível apenas nesta conta)</span>
              <input
                maxLength={250}
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
              />
            </label>
            <fieldset className={styles.companyHours}>
              <legend>Horário de funcionamento <span>(opcional)</span></legend>
              <div className={styles.companyHoursGrid}>
                {days.map(({ key, label }) => (
                  <label className={styles.field} key={key}>
                    {label}
                    <input
                      maxLength={120}
                      placeholder="08:00–17:00 ou Fechado"
                      value={hours[key]}
                      onChange={(event) =>
                        setHours((current) => ({ ...current, [key]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <div className={commerceStyles.profileImagePanel}>
              <BusinessLogo
                className={commerceStyles.profileLogoPreview}
                companyName={form.commercial_name || "A sua empresa"}
                logoUrl={logoPreview || profile?.logo}
                width={112}
                height={112}
              />
              <div>
                <strong>Imagem de perfil da empresa</strong>
                <p>Esta imagem identifica a empresa no catálogo. Pode ser alterada quando quiser.</p>
              </div>
            </div>
            <label className={styles.field}>
              Escolher imagem <span>(JPEG, PNG ou WebP, máximo 5 MB)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => selectLogo(event.target.files?.[0] ?? null)}
              />
            </label>
            {error && <p className={styles.notice} role="alert">{error}</p>}
            {success && <p className={`${styles.notice} ${styles.success}`} role="status">{success}</p>}
            <button className={styles.submit} type="submit" disabled={saving}>
              {saving ? "A guardar…" : profile ? "Guardar alterações" : "Criar perfil empresarial"}
            </button>
          </form>
          <p className={styles.profileHint}>
            A criação deste perfil não verifica automaticamente o registo legal da empresa. A verificação do prestador continua sujeita à revisão administrativa.
          </p>
        </section>
      )}
    </EstruturaAutenticacao>
  );
}
