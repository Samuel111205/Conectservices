"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Image from "@/lib/image";
import Link from "@/lib/link";
import { useEffect, useState } from "react";
import { useRouter } from "@/lib/navigation";
import { ArrowRight, BriefcaseBusiness, PackageCheck, Pause, Play, Search, ShoppingBag, Sparkles, Store } from "lucide-react";
import ListingViewTracker from "@/app/components/listing-view-tracker";
import styles from "./products.module.css";
function mensagemDoErro(data) {
    if (data && typeof data === "object") {
        const values = Object.values(data).flatMap((value) => Array.isArray(value) ? value : [value]);
        const message = values.find((value) => typeof value === "string");
        if (typeof message === "string")
            return message;
    }
    return "Não foi possível concluir a encomenda.";
}
export default function PaginaProdutos() {
    const router = useRouter();
    const [products, setProducts] = useState([]);
    const [searchDraft, setSearchDraft] = useState("");
    const [search, setSearch] = useState("");
    const [refreshSequence, setRefreshSequence] = useState(0);
    const [quantities, setQuantities] = useState({});
    const [deliveryNotes, setDeliveryNotes] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [orderingId, setOrderingId] = useState(null);
    const [carouselPaused, setCarouselPaused] = useState(false);
    const heroProducts = products
        .filter((product) => product.image || product.image_url)
        .slice(0, 4);
    const renderCarouselProducts = (copy = false) => products.slice(0, 8).map((product) => {
        const imageSource = product.image || product.image_url;
        return (_jsxs("article", { className: styles.productSlideCard, role: "listitem", children: [_jsx("div", { className: styles.productSlideImage, children: imageSource ? (_jsx(Image, { src: imageSource, alt: `Produto: ${product.name}`, fill: true, sizes: "280px", unoptimized: true })) : (_jsx("span", { "aria-hidden": "true", children: _jsx(ShoppingBag, { size: 30, strokeWidth: 1.5 }) })) }), _jsxs("div", { className: styles.productSlideCopy, children: [_jsx("span", { children: product.category_name }), _jsx("strong", { children: product.name }), _jsxs("small", { children: [Number(product.price).toLocaleString("pt-AO"), " ", product.currency] })] })] }, `${copy ? "copy-" : ""}${product.id}`));
    });
    useEffect(() => {
        let active = true;
        const query = search ? `?search=${encodeURIComponent(search)}` : "";
        fetchApi(`/api/public/products${query}`, { cache: "no-store" })
            .then(async (response) => {
            const data = await response.json();
            if (!response.ok)
                throw new Error(mensagemDoErro(data));
            if (active)
                setProducts(data.results ?? []);
        })
            .catch((reason) => {
            if (active)
                setError(reason instanceof Error ? reason.message : "Não foi possível carregar os produtos.");
        })
            .finally(() => {
            if (active)
                setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [refreshSequence, search]);
    async function encomendar(product) {
        setOrderingId(product.id);
        setError("");
        setNotice("");
        try {
            const response = await fetchApi("/api/auth/product-orders/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: [{ product_id: product.id, quantity: quantities[product.id] ?? 1 }],
                    delivery_notes: deliveryNotes[product.id] ?? "",
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401) {
                router.push("/entrar?next=%2Fprodutos");
                return;
            }
            if (!response.ok)
                throw new Error(mensagemDoErro(data));
            const quantity = quantities[product.id] ?? 1;
            setProducts((current) => current
                .map((item) => item.id === product.id ? { ...item, stock_quantity: item.stock_quantity - quantity } : item)
                .filter((item) => item.stock_quantity > 0));
            setNotice(`Encomenda #${data.id} enviada à ${product.provider_name}. Combina o pagamento e a entrega diretamente com a empresa.`);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Não foi possível enviar a encomenda.");
        }
        finally {
            setOrderingId(null);
        }
    }
    return (_jsxs("main", { className: styles.page, children: [_jsxs("header", { className: styles.header, children: [_jsxs(Link, { href: "/", className: styles.brand, "aria-label": "Conect Services \u2014 in\u00EDcio", children: [_jsx("span", { className: styles.brandMark, children: "C" }), _jsxs("span", { className: styles.brandName, children: ["conect", _jsx("span", { children: "services" })] })] }), _jsxs("nav", { "aria-label": "Navega\u00E7\u00E3o principal", children: [_jsx(Link, { href: "/", children: "In\u00EDcio" }), _jsx(Link, { href: "/produtos", "aria-current": "page", children: "Produtos" }), _jsx(Link, { href: "/explorar", children: "Servi\u00E7os" }), _jsx(Link, { href: "/compras", children: "As minhas encomendas" })] }), _jsxs("div", { className: styles.headerActions, children: [_jsx(Link, { className: styles.headerLogin, href: "/entrar", children: "Entrar" }), _jsxs(Link, { className: styles.headerCta, href: "/registar", children: ["Criar conta ", _jsx(ArrowRight, { size: 15, "aria-hidden": "true" })] })] })] }), _jsx("section", { className: styles.hero, children: _jsxs("div", { className: styles.heroInner, children: [_jsxs("div", { className: styles.heroCopy, children: [_jsxs("p", { className: styles.eyebrow, children: [_jsx(Sparkles, { size: 15, "aria-hidden": "true" }), " O melhor da comunidade, num s\u00F3 lugar"] }), _jsxs("h1", { children: ["Encontra o que procuras. ", _jsx("span", { children: "Descobre o que precisas." })] }), _jsx("p", { className: styles.heroDescription, children: "Explora produtos de empresas angolanas e encontra profissionais para os teus pr\u00F3ximos projetos." }), _jsxs("form", { className: styles.search, onSubmit: (event) => {
                                        event.preventDefault();
                                        setError("");
                                        setLoading(true);
                                        setSearch(searchDraft.trim());
                                        setRefreshSequence((current) => current + 1);
                                    }, children: [_jsx(Search, { size: 20, "aria-hidden": "true" }), _jsx("label", { className: styles.srOnly, htmlFor: "pesquisa-produtos", children: "Pesquisar produtos e empresas" }), _jsx("input", { id: "pesquisa-produtos", value: searchDraft, onChange: (event) => setSearchDraft(event.target.value), placeholder: "O que procuras hoje?" }), _jsx("button", { type: "submit", children: "Pesquisar" })] }), _jsxs("div", { className: styles.heroLinks, children: [_jsxs(Link, { href: "#catalogo", children: [_jsx(ShoppingBag, { size: 16, "aria-hidden": "true" }), " Ver produtos"] }), _jsxs(Link, { href: "/explorar", children: [_jsx(BriefcaseBusiness, { size: 16, "aria-hidden": "true" }), " Encontrar servi\u00E7os ", _jsx(ArrowRight, { size: 15, "aria-hidden": "true" })] })] })] }), _jsxs("div", { className: styles.heroArtwork, "aria-hidden": "true", children: [_jsx("div", { className: styles.artHalo }), heroProducts.map((product, index) => (_jsx("span", { className: styles.heroProductPhoto, "data-photo-index": index, children: _jsx(Image, { src: product.image || product.image_url, alt: "", fill: true, sizes: "(max-width: 680px) 105px, 180px", unoptimized: true }) }, product.id))), _jsxs("div", { className: styles.artCard, children: [_jsx("span", { className: styles.artCardIcon, children: _jsx(PackageCheck, { size: 25 }) }), _jsx("span", { className: styles.artCardLabel, children: "A tua pr\u00F3xima descoberta" }), _jsxs("strong", { children: ["Feito perto.", _jsx("br", {}), "Escolhido por ti."] }), _jsxs("span", { className: styles.artCardBottom, children: [_jsx(Store, { size: 15 }), " Neg\u00F3cios locais, novas possibilidades"] })] }), _jsxs("span", { className: `${styles.artFloat} ${styles.artFloatProduct}`, children: [_jsx(ShoppingBag, { size: 19 }), _jsx("span", { children: "Produtos" })] }), _jsxs("span", { className: `${styles.artFloat} ${styles.artFloatService}`, children: [_jsx(BriefcaseBusiness, { size: 19 }), _jsx("span", { children: "Servi\u00E7os" })] }), _jsx("span", { className: styles.artSparkle, children: _jsx(Sparkles, { size: 20 }) })] })] }) }), _jsxs("section", { className: styles.benefits, "aria-label": "Descubra na Conect Services", children: [_jsxs("div", { children: [_jsx("span", { children: _jsx(Store, { size: 19, "aria-hidden": "true" }) }), _jsxs("p", { children: [_jsx("strong", { children: "Apoia neg\u00F3cios locais" }), _jsx("small", { children: "Conhece produtos de empresas da comunidade." })] })] }), _jsxs("div", { children: [_jsx("span", { children: _jsx(BriefcaseBusiness, { size: 19, "aria-hidden": "true" }) }), _jsxs("p", { children: [_jsx("strong", { children: "Encontra profissionais" }), _jsx("small", { children: "Descobre servi\u00E7os para as tuas necessidades." })] })] }), _jsxs("div", { children: [_jsx("span", { children: _jsx(PackageCheck, { size: 19, "aria-hidden": "true" }) }), _jsxs("p", { children: [_jsx("strong", { children: "Contacta diretamente" }), _jsx("small", { children: "Combina os detalhes com quem oferece." })] })] })] }), notice && _jsxs("p", { className: styles.success, role: "status", children: [notice, " ", _jsx(Link, { href: "/compras", children: "Ver encomendas" })] }), error && _jsx("p", { className: styles.error, role: "alert", children: error }), _jsxs("section", { className: styles.catalog, id: "catalogo", "aria-labelledby": "catalogo-title", children: [_jsxs("div", { className: styles.catalogHeading, children: [_jsxs("div", { children: [_jsx("p", { className: styles.eyebrow, children: "Vitrine da comunidade" }), _jsx("h2", { id: "catalogo-title", children: "Produtos em destaque" }), _jsx("p", { children: "Encontra algo para ti e encomenda diretamente \u00E0 empresa." })] }), _jsxs("span", { children: [_jsx(ShoppingBag, { size: 16, "aria-hidden": "true" }), " ", products.length, " ", products.length === 1 ? "produto" : "produtos"] })] }), loading ? _jsx("p", { className: styles.message, role: "status", children: "A carregar produtos\u2026" }) : products.length ? (_jsx("div", { className: styles.grid, children: products.map((product) => {
                            const imageSource = product.image || product.image_url;
                            return (_jsxs("article", { className: styles.card, children: [_jsx(ListingViewTracker, { listingType: "PRODUCT", listingId: product.id }), _jsxs("div", { className: `${styles.productImage} ${imageSource ? styles.hasImage : ""}`, children: [imageSource && (_jsx(Image, { className: styles.productPhoto, src: imageSource, alt: `Produto: ${product.name}`, fill: true, sizes: "(max-width: 680px) 100vw, (max-width: 1200px) 50vw, 320px", unoptimized: true })), !imageSource && _jsx("span", { "aria-hidden": "true", children: _jsx(ShoppingBag, { size: 43, strokeWidth: 1.4 }) }), _jsxs("span", { className: styles.imageBadge, "aria-hidden": "true", children: [_jsx(Sparkles, { size: 13 }), " Da comunidade"] })] }), _jsxs("div", { className: styles.cardBody, children: [_jsx("p", { className: styles.category, children: product.category_name }), _jsx("h3", { children: product.name }), _jsxs("p", { className: styles.company, children: [_jsx(Store, { size: 14, "aria-hidden": "true" }), " ", product.provider_name] }), product.description && _jsx("p", { className: styles.description, children: product.description }), _jsxs("div", { className: styles.priceRow, children: [_jsxs("strong", { children: [Number(product.price).toLocaleString("pt-AO"), " ", product.currency] }), _jsxs("span", { children: [product.stock_quantity, " em stock"] })] }), _jsxs("label", { className: styles.quantity, htmlFor: `quantidade-${product.id}`, children: ["Quantidade", _jsx("input", { id: `quantidade-${product.id}`, type: "number", min: 1, max: Math.min(product.stock_quantity, 99), value: quantities[product.id] ?? 1, onChange: (event) => setQuantities((current) => ({
                                                            ...current,
                                                            [product.id]: Math.min(product.stock_quantity, 99, Math.max(1, Number(event.target.value) || 1)),
                                                        })) })] }), _jsxs("label", { className: styles.deliveryNotes, htmlFor: `observacoes-${product.id}`, children: ["Observa\u00E7\u00F5es de entrega (opcional)", _jsx("textarea", { id: `observacoes-${product.id}`, maxLength: 5000, value: deliveryNotes[product.id] ?? "", onChange: (event) => setDeliveryNotes((current) => ({ ...current, [product.id]: event.target.value })) })] }), _jsxs("button", { className: styles.orderButton, type: "button", disabled: orderingId === product.id, onClick: () => void encomendar(product), children: [orderingId === product.id ? "A enviar…" : "Encomendar", orderingId !== product.id && _jsx(ArrowRight, { size: 16, "aria-hidden": "true" })] })] })] }, product.id));
                        }) })) : (_jsxs("div", { className: styles.empty, children: [_jsx("h3", { children: "Ainda n\u00E3o h\u00E1 produtos publicados" }), _jsx("p", { children: "As empresas podem entrar na \u00E1rea empresarial para adicionar produtos, pre\u00E7os e stock." }), _jsx(Link, { href: "/empresa/produtos", children: "Gerir produtos da empresa" })] }))] }), !loading && products.length > 1 && (_jsxs("section", { className: `${styles.productCarousel} ${carouselPaused ? styles.productCarouselPaused : ""}`, "aria-labelledby": "product-carousel-title", children: [_jsxs("div", { className: styles.productCarouselHeading, children: [_jsxs("div", { children: [_jsx("p", { className: styles.eyebrow, children: "Mais para descobrir" }), _jsx("h2", { id: "product-carousel-title", children: "Produtos da comunidade" })] }), _jsxs("button", { className: styles.carouselToggle, type: "button", "aria-label": carouselPaused ? "Retomar animação dos produtos" : "Pausar animação dos produtos", "aria-pressed": carouselPaused, onClick: () => setCarouselPaused((paused) => !paused), children: [carouselPaused
                                        ? _jsx(Play, { size: 15, "aria-hidden": "true" })
                                        : _jsx(Pause, { size: 15, "aria-hidden": "true" }), carouselPaused ? "Retomar" : "Pausar"] })] }), _jsx("div", { className: styles.productSlideViewport, children: _jsxs("div", { className: styles.productSlideTrack, children: [_jsx("div", { className: styles.productSlideGroup, role: "list", "aria-label": "Produtos em destaque", children: renderCarouselProducts() }), _jsx("div", { className: styles.productSlideGroup, role: "list", "aria-hidden": "true", children: renderCarouselProducts(true) })] }) })] })), _jsxs("section", { className: styles.servicesCallout, children: [_jsx("span", { className: styles.servicesIcon, children: _jsx(BriefcaseBusiness, { size: 23, "aria-hidden": "true" }) }), _jsxs("div", { children: [_jsx("p", { className: styles.eyebrow, children: "Tamb\u00E9m precisas de ajuda especializada?" }), _jsx("h2", { children: "H\u00E1 um profissional certo para o teu pr\u00F3ximo projeto." }), _jsx("p", { children: "Explora servi\u00E7os e liga-te a prestadores e empresas em Angola." })] }), _jsxs(Link, { href: "/explorar", children: ["Descobrir servi\u00E7os ", _jsx(ArrowRight, { size: 17, "aria-hidden": "true" })] })] }), _jsxs("footer", { className: styles.footer, children: [_jsx("p", { children: "O pagamento e a entrega dos produtos s\u00E3o combinados diretamente com cada empresa." }), _jsxs(Link, { href: "/empresa/produtos", children: ["Tens uma empresa? Divulga os teus produtos ", _jsx(ArrowRight, { size: 15, "aria-hidden": "true" })] })] })] }));
}
