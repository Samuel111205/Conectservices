"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, PackageCheck, Pause, Play, Search, ShoppingBag, Sparkles, Store } from "lucide-react";
import ListingViewTracker from "@/app/components/listing-view-tracker";
import styles from "./products.module.css";

type Product = {
  id: number;
  provider_name: string;
  category_name: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  stock_quantity: number;
  image: string;
  image_url: string;
};

type ProductPage = { count: number; results: Product[] };

function mensagemDoErro(data: unknown) {
  if (data && typeof data === "object") {
    const values = Object.values(data).flatMap((value) =>
      Array.isArray(value) ? value : [value],
    );
    const message = values.find((value) => typeof value === "string");
    if (typeof message === "string") return message;
  }
  return "Não foi possível concluir a encomenda.";
}

export default function PaginaProdutos() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [refreshSequence, setRefreshSequence] = useState(0);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [deliveryNotes, setDeliveryNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [orderingId, setOrderingId] = useState<number | null>(null);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const heroProducts = products
    .filter((product) => product.image || product.image_url)
    .slice(0, 4);

  const renderCarouselProducts = (copy = false) => products.slice(0, 8).map((product) => {
    const imageSource = product.image || product.image_url;
    return (
      <article
        className={styles.productSlideCard}
        key={`${copy ? "copy-" : ""}${product.id}`}
        role="listitem"
      >
        <div className={styles.productSlideImage}>
          {imageSource ? (
            <Image
              src={imageSource}
              alt={`Produto: ${product.name}`}
              fill
              sizes="280px"
              unoptimized
            />
          ) : (
            <span aria-hidden="true"><ShoppingBag size={30} strokeWidth={1.5} /></span>
          )}
        </div>
        <div className={styles.productSlideCopy}>
          <span>{product.category_name}</span>
          <strong>{product.name}</strong>
          <small>{Number(product.price).toLocaleString("pt-AO")} {product.currency}</small>
        </div>
      </article>
    );
  });

  useEffect(() => {
    let active = true;
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/public/products${query}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(mensagemDoErro(data));
        if (active) setProducts((data as ProductPage).results ?? []);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar os produtos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshSequence, search]);

  async function encomendar(product: Product) {
    setOrderingId(product.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/product-orders/", {
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
      if (!response.ok) throw new Error(mensagemDoErro(data));
      const quantity = quantities[product.id] ?? 1;
      setProducts((current) => current
        .map((item) => item.id === product.id ? { ...item, stock_quantity: item.stock_quantity - quantity } : item)
        .filter((item) => item.stock_quantity > 0));
      setNotice(`Encomenda #${data.id} enviada à ${product.provider_name}. Combina o pagamento e a entrega diretamente com a empresa.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar a encomenda.");
    } finally {
      setOrderingId(null);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Conect Services — início">
          <span className={styles.brandMark}>C</span>
          <span className={styles.brandName}>conect<span>services</span></span>
        </Link>
        <nav aria-label="Navegação principal">
          <Link href="/">Início</Link>
          <Link href="/produtos" aria-current="page">Produtos</Link>
          <Link href="/explorar">Serviços</Link>
          <Link href="/compras">As minhas encomendas</Link>
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.headerLogin} href="/entrar">Entrar</Link>
          <Link className={styles.headerCta} href="/registar">Criar conta <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><Sparkles size={15} aria-hidden="true" /> O melhor da comunidade, num só lugar</p>
            <h1>Encontra o que procuras. <span>Descobre o que precisas.</span></h1>
            <p className={styles.heroDescription}>
              Explora produtos de empresas angolanas e encontra profissionais para os teus próximos projetos.
            </p>
            <form
              className={styles.search}
              onSubmit={(event) => {
                event.preventDefault();
                setError("");
                setLoading(true);
                setSearch(searchDraft.trim());
                setRefreshSequence((current) => current + 1);
              }}
            >
              <Search size={20} aria-hidden="true" />
              <label className={styles.srOnly} htmlFor="pesquisa-produtos">Pesquisar produtos e empresas</label>
              <input
                id="pesquisa-produtos"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="O que procuras hoje?"
              />
              <button type="submit">Pesquisar</button>
            </form>
            <div className={styles.heroLinks}>
              <Link href="#catalogo"><ShoppingBag size={16} aria-hidden="true" /> Ver produtos</Link>
              <Link href="/explorar"><BriefcaseBusiness size={16} aria-hidden="true" /> Encontrar serviços <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
          </div>
          <div className={styles.heroArtwork} aria-hidden="true">
            <div className={styles.artHalo} />
            {heroProducts.map((product, index) => (
              <span
                className={styles.heroProductPhoto}
                data-photo-index={index}
                key={product.id}
              >
                <Image
                  src={product.image || product.image_url}
                  alt=""
                  fill
                  sizes="(max-width: 680px) 105px, 180px"
                  unoptimized
                />
              </span>
            ))}
            <div className={styles.artCard}>
              <span className={styles.artCardIcon}><PackageCheck size={25} /></span>
              <span className={styles.artCardLabel}>A tua próxima descoberta</span>
              <strong>Feito perto.<br />Escolhido por ti.</strong>
              <span className={styles.artCardBottom}><Store size={15} /> Negócios locais, novas possibilidades</span>
            </div>
            <span className={`${styles.artFloat} ${styles.artFloatProduct}`}><ShoppingBag size={19} /><span>Produtos</span></span>
            <span className={`${styles.artFloat} ${styles.artFloatService}`}><BriefcaseBusiness size={19} /><span>Serviços</span></span>
            <span className={styles.artSparkle}><Sparkles size={20} /></span>
          </div>
        </div>
      </section>

      <section className={styles.benefits} aria-label="Descubra na Conect Services">
        <div><span><Store size={19} aria-hidden="true" /></span><p><strong>Apoia negócios locais</strong><small>Conhece produtos de empresas da comunidade.</small></p></div>
        <div><span><BriefcaseBusiness size={19} aria-hidden="true" /></span><p><strong>Encontra profissionais</strong><small>Descobre serviços para as tuas necessidades.</small></p></div>
        <div><span><PackageCheck size={19} aria-hidden="true" /></span><p><strong>Contacta diretamente</strong><small>Combina os detalhes com quem oferece.</small></p></div>
      </section>

      {notice && <p className={styles.success} role="status">{notice} <Link href="/compras">Ver encomendas</Link></p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <section className={styles.catalog} id="catalogo" aria-labelledby="catalogo-title">
        <div className={styles.catalogHeading}>
          <div><p className={styles.eyebrow}>Vitrine da comunidade</p><h2 id="catalogo-title">Produtos em destaque</h2><p>Encontra algo para ti e encomenda diretamente à empresa.</p></div>
          <span><ShoppingBag size={16} aria-hidden="true" /> {products.length} {products.length === 1 ? "produto" : "produtos"}</span>
        </div>
        {loading ? <p className={styles.message} role="status">A carregar produtos…</p> : products.length ? (
          <div className={styles.grid}>
            {products.map((product) => {
              const imageSource = product.image || product.image_url;
              return (
                <article className={styles.card} key={product.id}>
                  <ListingViewTracker listingType="PRODUCT" listingId={product.id} />
                  <div
                    className={`${styles.productImage} ${imageSource ? styles.hasImage : ""}`}
                  >
                    {imageSource && (
                      <Image
                        className={styles.productPhoto}
                        src={imageSource}
                        alt={`Produto: ${product.name}`}
                        fill
                        sizes="(max-width: 680px) 100vw, (max-width: 1200px) 50vw, 320px"
                        unoptimized
                      />
                    )}
                    {!imageSource && <span aria-hidden="true"><ShoppingBag size={43} strokeWidth={1.4} /></span>}
                    <span className={styles.imageBadge} aria-hidden="true"><Sparkles size={13} /> Da comunidade</span>
                  </div>
                  <div className={styles.cardBody}>
                    <p className={styles.category}>{product.category_name}</p>
                    <h3>{product.name}</h3>
                    <p className={styles.company}><Store size={14} aria-hidden="true" /> {product.provider_name}</p>
                    {product.description && <p className={styles.description}>{product.description}</p>}
                    <div className={styles.priceRow}>
                      <strong>{Number(product.price).toLocaleString("pt-AO")} {product.currency}</strong>
                      <span>{product.stock_quantity} em stock</span>
                    </div>
                    <label className={styles.quantity} htmlFor={`quantidade-${product.id}`}>
                      Quantidade
                      <input
                        id={`quantidade-${product.id}`}
                        type="number"
                        min={1}
                        max={Math.min(product.stock_quantity, 99)}
                        value={quantities[product.id] ?? 1}
                        onChange={(event) => setQuantities((current) => ({
                          ...current,
                          [product.id]: Math.min(product.stock_quantity, 99, Math.max(1, Number(event.target.value) || 1)),
                        }))}
                      />
                    </label>
                    <label className={styles.deliveryNotes} htmlFor={`observacoes-${product.id}`}>
                      Observações de entrega (opcional)
                      <textarea
                        id={`observacoes-${product.id}`}
                        maxLength={5000}
                        value={deliveryNotes[product.id] ?? ""}
                        onChange={(event) => setDeliveryNotes((current) => ({ ...current, [product.id]: event.target.value }))}
                      />
                    </label>
                    <button
                      className={styles.orderButton}
                      type="button"
                      disabled={orderingId === product.id}
                      onClick={() => void encomendar(product)}
                    >
                      {orderingId === product.id ? "A enviar…" : "Encomendar"}
                      {orderingId !== product.id && <ArrowRight size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <h3>Ainda não há produtos publicados</h3>
            <p>As empresas podem entrar na área empresarial para adicionar produtos, preços e stock.</p>
            <Link href="/empresa/produtos">Gerir produtos da empresa</Link>
          </div>
        )}
      </section>
      {!loading && products.length > 1 && (
        <section
          className={`${styles.productCarousel} ${carouselPaused ? styles.productCarouselPaused : ""}`}
          aria-labelledby="product-carousel-title"
        >
          <div className={styles.productCarouselHeading}>
            <div>
              <p className={styles.eyebrow}>Mais para descobrir</p>
              <h2 id="product-carousel-title">Produtos da comunidade</h2>
            </div>
            <button
              className={styles.carouselToggle}
              type="button"
              aria-label={carouselPaused ? "Retomar animação dos produtos" : "Pausar animação dos produtos"}
              aria-pressed={carouselPaused}
              onClick={() => setCarouselPaused((paused) => !paused)}
            >
              {carouselPaused
                ? <Play size={15} aria-hidden="true" />
                : <Pause size={15} aria-hidden="true" />}
              {carouselPaused ? "Retomar" : "Pausar"}
            </button>
          </div>
          <div className={styles.productSlideViewport}>
            <div className={styles.productSlideTrack}>
              <div className={styles.productSlideGroup} role="list" aria-label="Produtos em destaque">
                {renderCarouselProducts()}
              </div>
              <div className={styles.productSlideGroup} role="list" aria-hidden="true">
                {renderCarouselProducts(true)}
              </div>
            </div>
          </div>
        </section>
      )}
      <section className={styles.servicesCallout}>
        <span className={styles.servicesIcon}><BriefcaseBusiness size={23} aria-hidden="true" /></span>
        <div>
          <p className={styles.eyebrow}>Também precisas de ajuda especializada?</p>
          <h2>Há um profissional certo para o teu próximo projeto.</h2>
          <p>Explora serviços e liga-te a prestadores e empresas em Angola.</p>
        </div>
        <Link href="/explorar">Descobrir serviços <ArrowRight size={17} aria-hidden="true" /></Link>
      </section>
      <footer className={styles.footer}>
        <p>O pagamento e a entrega dos produtos são combinados diretamente com cada empresa.</p>
        <Link href="/empresa/produtos">Tens uma empresa? Divulga os teus produtos <ArrowRight size={15} aria-hidden="true" /></Link>
      </footer>
    </main>
  );
}
