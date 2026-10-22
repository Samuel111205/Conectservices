"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
        <Link href="/" className={styles.brand}>Conect <span>Services</span></Link>
        <nav aria-label="Navegação principal">
          <Link href="/">Início</Link>
          <Link href="/explorar">Serviços</Link>
          <Link href="/compras">As minhas encomendas</Link>
          <Link href="/entrar">Entrar</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Lojas e empresas locais</p>
        <h1>Produtos de empresas angolanas</h1>
        <p>Encomenda diretamente às empresas. Depois, combina com elas o pagamento e a entrega.</p>
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
          <label className={styles.srOnly} htmlFor="pesquisa-produtos">Pesquisar produtos e empresas</label>
          <input
            id="pesquisa-produtos"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Pesquisar produtos ou empresas"
          />
          <button type="submit">Pesquisar</button>
        </form>
      </section>

      {notice && <p className={styles.success} role="status">{notice} <Link href="/compras">Ver encomendas</Link></p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <section className={styles.catalog} aria-labelledby="catalogo-title">
        <div className={styles.catalogHeading}>
          <div><p className={styles.eyebrow}>Catálogo</p><h2 id="catalogo-title">Produtos disponíveis</h2></div>
          <span>{products.length} produtos</span>
        </div>
        {loading ? <p className={styles.message} role="status">A carregar produtos…</p> : products.length ? (
          <div className={styles.grid}>
            {products.map((product) => {
              const imageSource = product.image || product.image_url;
              return (
                <article className={styles.card} key={product.id}>
                  <div
                    className={`${styles.productImage} ${imageSource ? styles.hasImage : ""}`}
                    style={imageSource ? { backgroundImage: `url("${imageSource}")` } : undefined}
                    role="img"
                    aria-label={imageSource ? `Imagem de ${product.name}` : `Sem imagem para ${product.name}`}
                  >
                    {!imageSource && <span aria-hidden="true">✦</span>}
                  </div>
                  <div className={styles.cardBody}>
                    <p className={styles.category}>{product.category_name}</p>
                    <h3>{product.name}</h3>
                    <p className={styles.company}>{product.provider_name}</p>
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
      <footer className={styles.footer}>O pagamento e a entrega são combinados diretamente com cada empresa.</footer>
    </main>
  );
}
