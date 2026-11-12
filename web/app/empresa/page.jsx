"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import BusinessLogo from "@/app/components/business-logo";
import AnalyticsPanel from "@/app/components/analytics-panel";
import { BriefcaseBusiness, MessageCircle, ShoppingBag, Star } from "lucide-react";
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
    commercial_name: "",
    description: "",
    business_phone: "",
    business_email: "",
    registered_name: "",
    website: "",
    address: "",
};
function extrairErros(value) {
    if (!value || typeof value !== "object") {
        return { detail: ["Não foi possível concluir o pedido."] };
    }
    return Object.fromEntries(Object.entries(value).map(([key, message]) => [
        key,
        Array.isArray(message) ? message.map(String) : [String(message)],
    ]));
}
function primeiraMensagem(value) {
    if (value && typeof value === "object" && "detail" in value) {
        const detail = value.detail;
        if (typeof detail === "string")
            return detail;
    }
    return Object.values(extrairErros(value))[0]?.[0] ?? "Não foi possível concluir o pedido.";
}
export default function PaginaEmpresa() {
    const router = useRouter();
    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [hours, setHours] = useState({
        monday: "",
        tuesday: "",
        wednesday: "",
        thursday: "",
        friday: "",
        saturday: "",
        sunday: "",
    });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [metrics, setMetrics] = useState(null);
    useEffect(() => {
        if (!profile)
            return;
        Promise.all([
            fetchApi("/api/auth/dashboard/", { cache: "no-store" }),
            fetchApi("/api/auth/product-orders/", { cache: "no-store" }),
            fetchApi("/api/auth/conversations/", { cache: "no-store" }),
        ]).then(async ([dashboardResponse, ordersResponse, contactsResponse]) => {
            const dashboard = dashboardResponse.ok ? await dashboardResponse.json() : null;
            const orders = ordersResponse.ok ? await ordersResponse.json() : null;
            const contacts = contactsResponse.ok ? await contactsResponse.json() : null;
            const provider = dashboard?.provider;
            setMetrics({
                services: provider?.services?.active ?? 0,
                orders: orders?.count ?? orders?.results?.filter((item) => item.is_provider).length ?? 0,
                contacts: contacts?.count ?? contacts?.results?.length ?? 0,
                rating: provider?.reviews?.average_rating ?? null,
                reviews: provider?.reviews?.count ?? 0,
            });
        }).catch(() => undefined);
    }, [profile]);
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
                    if (active)
                        setProfile(null);
                    return;
                }
                const data = await response.json();
                if (!response.ok)
                    throw new Error(primeiraMensagem(data));
                const business = data;
                if (!active)
                    return;
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
                    ...Object.fromEntries(days.map(({ key }) => [key, business.opening_hours?.[key] ?? ""])),
                }));
            }
            catch (reason) {
                if (active) {
                    setError(reason instanceof Error
                        ? reason.message
                        : "Não foi possível carregar o perfil empresarial.");
                }
            }
            finally {
                if (active)
                    setLoading(false);
            }
        }
        void loadProfile();
        return () => {
            active = false;
        };
    }, [router]);
    function updateField(field, value) {
        setForm((current) => ({ ...current, [field]: value }));
    }
    function selectLogo(file) {
        setError("");
        setLogoFile(file);
        setLogoPreview("");
        if (!file)
            return;
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
        const openingHours = Object.fromEntries(days
            .map(({ key }) => [key, hours[key].trim()])
            .filter(([, value]) => value));
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
            const response = await fetchApi(profile ? "/api/auth/businesses/me/" : "/api/auth/businesses/", {
                method: profile ? "PATCH" : "POST",
                ...(logoFile ? {} : { headers: { "Content-Type": "application/json" } }),
                body,
            });
            const data = await response.json();
            if (response.status === 401) {
                router.replace("/entrar?next=%2Fempresa");
                return;
            }
            if (!response.ok) {
                setError(primeiraMensagem(data));
                return;
            }
            setProfile(data);
            setLogoFile(null);
            setLogoPreview("");
            setSuccess("Perfil empresarial guardado.");
        }
        catch {
            setError("Não foi possível contactar o serviço. Tenta novamente.");
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs(EstruturaAutenticacao, { account: true, profileName: profile?.commercial_name, children: [_jsx("p", { className: styles.eyebrow, children: "\u00C1rea empresarial" }), _jsx("h1", { children: profile ? "Perfil da empresa" : "Apresente a sua empresa" }), _jsx("p", { className: styles.intro, children: "Partilhe os dados comerciais da empresa e mantenha o contacto e o hor\u00E1rio actualizados." }), loading ? (_jsx("p", { className: styles.profileHint, role: "status", children: "A carregar o perfil empresarial\u2026" })) : (_jsxs(_Fragment, { children: [profile && _jsxs(_Fragment, { children: [_jsxs("section", { className: styles.companyWelcome, children: [_jsx(BusinessLogo, { className: styles.companyWelcomeLogo, companyName: profile.commercial_name, logoUrl: profile.logo, width: 58, height: 58 }), _jsxs("div", { children: [_jsx("span", { children: "Perfil da empresa" }), _jsx("strong", { children: profile.commercial_name }), _jsx("small", { children: profile.address || "Luanda · Angola" })] }), _jsx("span", { className: styles.profileBadge, children: profile.verification_status === "VERIFIED" ? "Verificada" : profile.verification_status === "SUSPENDED" ? "Suspensa" : profile.verification_status === "REJECTED" ? "Requer atenção" : "Em análise" }), _jsx(Link, { className: commerceStyles.primaryLink, href: "/empresa/produtos#formulario-produto", children: "Adicionar servi\u00E7o" })] }), _jsxs("div", { className: styles.dashboardStats, "aria-label": "Indicadores da empresa", children: [_jsxs("div", { className: styles.metricCard, children: [_jsx("span", { className: styles.metricIcon, "data-tone": "blue", children: _jsx(BriefcaseBusiness, { size: 19, "aria-hidden": "true" }) }), _jsx("strong", { children: metrics?.services ?? "—" }), _jsx("span", { children: "Servi\u00E7os publicados" })] }), _jsxs("div", { className: styles.metricCard, children: [_jsx("span", { className: styles.metricIcon, "data-tone": "violet", children: _jsx(ShoppingBag, { size: 19, "aria-hidden": "true" }) }), _jsx("strong", { children: metrics?.orders ?? "—" }), _jsx("span", { children: "Encomendas recebidas" })] }), _jsxs("div", { className: styles.metricCard, children: [_jsx("span", { className: styles.metricIcon, "data-tone": "blue", children: _jsx(MessageCircle, { size: 19, "aria-hidden": "true" }) }), _jsx("strong", { children: metrics?.contacts ?? "—" }), _jsx("span", { children: "Contactos e conversas" })] }), _jsxs("div", { className: styles.metricCard, children: [_jsx("span", { className: styles.metricIcon, "data-tone": "amber", children: _jsx(Star, { size: 19, "aria-hidden": "true" }) }), _jsx("strong", { children: metrics?.rating ?? "—" }), _jsxs("span", { children: ["Avalia\u00E7\u00E3o m\u00E9dia \u00B7 ", metrics?.reviews ?? 0, " avalia\u00E7\u00F5es"] })] })] }), _jsx(AnalyticsPanel, {}), _jsxs("section", { className: styles.companyPanels, children: [_jsxs("article", { className: styles.companyPanel, children: [_jsxs("div", { className: styles.feedHeading, children: [_jsxs("div", { children: [_jsx("p", { className: styles.eyebrow, children: "Desempenho" }), _jsx("h2", { children: "Actividade da empresa" })] }), _jsx("span", { children: "Dados dispon\u00EDveis" })] }), _jsx("div", { className: styles.companyChart, "aria-label": "Resumo de atividade", children: [
                                                    { label: "Serviços", value: metrics?.services ?? 0 },
                                                    { label: "Encomendas", value: metrics?.orders ?? 0 },
                                                    { label: "Contactos", value: metrics?.contacts ?? 0 },
                                                    { label: "Avaliações", value: metrics?.reviews ?? 0 },
                                                ].map((item) => _jsxs("div", { className: styles.companyBarRow, children: [_jsx("small", { children: item.label }), _jsx("span", { children: _jsx("i", { style: { width: `${Math.max(2, Math.min(100, item.value * 8))}%` } }) }), _jsx("strong", { children: item.value })] }, item.label)) }), _jsx("small", { children: "Consulta a evolu\u00E7\u00E3o di\u00E1ria das visualiza\u00E7\u00F5es, publica\u00E7\u00F5es e encomendas na an\u00E1lise abaixo." })] }), _jsxs("article", { className: styles.companyPanel, children: [_jsx("div", { className: styles.feedHeading, children: _jsxs("div", { children: [_jsx("p", { className: styles.eyebrow, children: "Gest\u00E3o r\u00E1pida" }), _jsx("h2", { children: "Atalhos da empresa" })] }) }), _jsxs("div", { className: styles.companyQuickLinks, children: [_jsxs(Link, { href: "/prestador/servicos", children: ["Gerir servi\u00E7os ", _jsx("span", { children: "Publicar e actualizar servi\u00E7os" })] }), _jsxs(Link, { href: "/empresa/encomendas", children: ["Pedidos recebidos ", _jsx("span", { children: "Consultar encomendas e pedidos" })] }), _jsxs(Link, { href: "/mensagens", children: ["Contactos e mensagens ", _jsx("span", { children: "Continuar conversas com clientes" })] })] })] })] }), _jsxs("section", { className: styles.companyPanel, children: [_jsxs("div", { className: styles.feedHeading, children: [_jsxs("div", { children: [_jsx("p", { className: styles.eyebrow, children: "Cat\u00E1logo" }), _jsx("h2", { children: "Os teus servi\u00E7os" })] }), _jsx(Link, { href: "/prestador/servicos", children: "Ver servi\u00E7os" })] }), _jsx("p", { className: styles.profileHint, children: metrics?.services ? `${metrics.services} serviços activos no teu perfil.` : "Adiciona serviços para que os clientes encontrem a tua empresa." })] })] }), _jsxs("section", { className: styles.profileSection, id: "perfil-empresa", children: [profile && (_jsxs("div", { className: commerceStyles.commerceLinks, children: [_jsx(Link, { className: commerceStyles.primaryLink, href: "/empresa/produtos#formulario-produto", children: "Adicionar produto" }), _jsx(Link, { href: "/empresa/produtos", children: "Gerir produtos" }), _jsx(Link, { href: "/empresa/encomendas", children: "Ver encomendas recebidas" })] })), profile && (_jsxs("div", { className: styles.profileHeading, children: [_jsx("h2", { children: "Dados comerciais" }), _jsx("span", { className: styles.profileBadge, children: profile.verification_status === "VERIFIED"
                                            ? "Prestador verificado"
                                            : profile.verification_status === "REJECTED"
                                                ? "Verificação necessita de ajustes"
                                                : profile.verification_status === "SUSPENDED"
                                                    ? "Conta suspensa"
                                                    : "Verificação pendente" })] })), _jsxs("form", { className: styles.form, onSubmit: saveProfile, children: [_jsxs("label", { className: styles.field, children: ["Nome comercial", _jsx("input", { required: true, maxLength: 160, value: form.commercial_name, onChange: (event) => updateField("commercial_name", event.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Nome legal ", _jsx("span", { children: "(opcional)" }), _jsx("input", { maxLength: 160, value: form.registered_name, onChange: (event) => updateField("registered_name", event.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Descri\u00E7\u00E3o ", _jsx("span", { children: "(opcional)" }), _jsx("textarea", { maxLength: 5000, rows: 4, value: form.description, onChange: (event) => updateField("description", event.target.value) })] }), _jsxs("div", { className: styles.formRow, children: [_jsxs("label", { className: styles.field, children: ["Telefone comercial ", _jsx("span", { children: "(opcional)" }), _jsx("input", { type: "tel", maxLength: 32, value: form.business_phone, onChange: (event) => updateField("business_phone", event.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Email comercial ", _jsx("span", { children: "(opcional)" }), _jsx("input", { type: "email", value: form.business_email, onChange: (event) => updateField("business_email", event.target.value) })] })] }), _jsxs("label", { className: styles.field, children: ["Website ", _jsx("span", { children: "(opcional)" }), _jsx("input", { type: "url", placeholder: "https://", value: form.website, onChange: (event) => updateField("website", event.target.value) })] }), _jsxs("label", { className: styles.field, children: ["Morada comercial ", _jsx("span", { children: "(opcional, vis\u00EDvel apenas nesta conta)" }), _jsx("input", { maxLength: 250, value: form.address, onChange: (event) => updateField("address", event.target.value) })] }), _jsxs("fieldset", { className: styles.companyHours, children: [_jsxs("legend", { children: ["Hor\u00E1rio de funcionamento ", _jsx("span", { children: "(opcional)" })] }), _jsx("div", { className: styles.companyHoursGrid, children: days.map(({ key, label }) => (_jsxs("label", { className: styles.field, children: [label, _jsx("input", { maxLength: 120, placeholder: "08:00\u201317:00 ou Fechado", value: hours[key], onChange: (event) => setHours((current) => ({ ...current, [key]: event.target.value })) })] }, key))) })] }), _jsxs("div", { className: commerceStyles.profileImagePanel, children: [_jsx(BusinessLogo, { className: commerceStyles.profileLogoPreview, companyName: form.commercial_name || "A sua empresa", logoUrl: logoPreview || profile?.logo, width: 112, height: 112 }), _jsxs("div", { children: [_jsx("strong", { children: "Imagem de perfil da empresa" }), _jsx("p", { children: "Esta imagem identifica a empresa no cat\u00E1logo. Pode ser alterada quando quiser." })] })] }), _jsxs("label", { className: styles.field, children: ["Escolher imagem ", _jsx("span", { children: "(JPEG, PNG ou WebP, m\u00E1ximo 5 MB)" }), _jsx("input", { type: "file", accept: "image/jpeg,image/png,image/webp", onChange: (event) => selectLogo(event.target.files?.[0] ?? null) })] }), error && _jsx("p", { className: styles.notice, role: "alert", children: error }), success && _jsx("p", { className: `${styles.notice} ${styles.success}`, role: "status", children: success }), _jsx("button", { className: styles.submit, type: "submit", disabled: saving, children: saving ? "A guardar…" : profile ? "Guardar alterações" : "Criar perfil empresarial" })] }), _jsx("p", { className: styles.profileHint, children: "A cria\u00E7\u00E3o deste perfil n\u00E3o verifica automaticamente o registo legal da empresa. A verifica\u00E7\u00E3o do prestador continua sujeita \u00E0 revis\u00E3o administrativa." })] })] }))] }));
}
