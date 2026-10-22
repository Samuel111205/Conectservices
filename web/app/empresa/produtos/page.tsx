"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import EstruturaAutenticacao from "../../auth-shell";
import accountStyles from "../../auth.module.css";
import styles from "../commerce.module.css";

type Product = {
  id: number;
  category: number;
  category_name: string;
  name: string;
  description: string;
  price: string;
  stock_quantity: number;
  image: string;
  image_url: string;
  is_active: boolean;
};
type Category = { id: number; name: string };
type Page<T> = { count: number; results: T[] };
type ProductForm = Omit<Product, "id" | "category_name" | "price"> & { price: string };

const emptyForm: ProductForm = {
  category: 0,
  name: "",
  description: "",
  price: "",
  stock_quantity: 0,
  image: "",
  image_url: "",
  is_active: true,
};

function errorMessage(data: unknown) {
  if (data && typeof data === "object") {
    const values = Object.values(data).flatMap((value) => Array.isArray(value) ? value : [value]);
    const message = values.find((value) => typeof value === "string");
    if (typeof message === "string") return message;
  }
  return "Não foi possível concluir a operação.";
}

export default function GerirProdutos() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    const [productResponse, categoryResponse] = await Promise.all([
      fetch("/api/auth/products", { cache: "no-store" }),
      fetch("/api/public/categories", { cache: "no-store" }),
    ]);
    if (productResponse.status === 401) {
      router.replace("/entrar?next=%2Fempresa%2Fprodutos");
      return { products: [] as Product[], categories: [] as Category[] };
    }
    const [productData, categoryData] = await Promise.all([
      productResponse.json(),
      categoryResponse.json(),
    ]);
    if (!productResponse.ok) throw new Error(errorMessage(productData));
    if (!categoryResponse.ok) throw new Error(errorMessage(categoryData));
    return {
      products: (productData as Page<Product>).results ?? [],
      categories: (categoryData as Page<Category>).results ?? [],
    };
  }, [router]);

  useEffect(() => {
    let active = true;
    loadData()
      .then((loaded) => {
        if (active) {
          setProducts(loaded.products);
          setCategories(loaded.categories);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar os produtos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [loadData]);

  function editProduct(product: Product) {
    setEditingId(product.id);
    setForm({
      category: product.category,
      name: product.name,
      description: product.description,
      price: product.price,
      stock_quantity: product.stock_quantity,
      image: product.image,
      image_url: product.image_url,
      is_active: product.is_active,
    });
    setImageFile(null);
    setImagePreview("");
    setNotice("");
    setError("");
    document.getElementById("formulario-produto")?.scrollIntoView({ behavior: "smooth" });
  }

  function selectProductImage(file: File | null) {
    setError("");
    setImageFile(file);
    setImagePreview("");
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setImageFile(null);
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        category: Number(form.category),
        name: form.name,
        description: form.description,
        price: Number(form.price),
        stock_quantity: Number(form.stock_quantity),
        image_url: form.image_url,
        is_active: form.is_active,
      };
      let body: BodyInit = JSON.stringify(payload);
      if (imageFile) {
        const multipart = new FormData();
        Object.entries(payload).forEach(([key, value]) => multipart.append(key, String(value)));
        multipart.append("image", imageFile);
        body = multipart;
      }
      const response = await fetch(editingId ? `/api/auth/products/${editingId}` : "/api/auth/products", {
        method: editingId ? "PATCH" : "POST",
        ...(!imageFile ? { headers: { "Content-Type": "application/json" } } : {}),
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        router.replace("/entrar?next=%2Fempresa%2Fprodutos");
        return;
      }
      if (!response.ok) throw new Error(errorMessage(data));
      const loaded = await loadData();
      setProducts(loaded.products);
      setCategories(loaded.categories);
      setForm(emptyForm);
      setEditingId(null);
      setImageFile(null);
      setImagePreview("");
      setNotice("Produto guardado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível guardar o produto.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateProduct(product: Product) {
    setWorkingId(product.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/auth/products/${product.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        router.replace("/entrar?next=%2Fempresa%2Fprodutos");
        return;
      }
      if (!response.ok) throw new Error(errorMessage(data));
      const loaded = await loadData();
      setProducts(loaded.products);
      setCategories(loaded.categories);
      setNotice("Produto desativado. Podes voltar a ativá-lo ao editar.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível desativar o produto.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <EstruturaAutenticacao account>
      <p className={accountStyles.eyebrow}>Área empresarial</p>
      <h1>Produtos da empresa</h1>
      <p className={accountStyles.intro}>Publica artigos com preço e stock. Indica um email ou telefone comercial no perfil da empresa para os clientes combinarem pagamento e entrega.</p>
      <div className={styles.commerceLinks}>
        <Link href="/empresa">Perfil da empresa</Link>
        <Link href="/empresa/encomendas">Encomendas recebidas</Link>
        <Link href="/produtos">Ver catálogo público</Link>
      </div>

      {error && <p className={styles.inlineError} role="alert">{error}</p>}
      {notice && <p className={styles.inlineMessage} role="status">{notice}</p>}

      <section className={styles.commerceSection} aria-labelledby="formulario-produto">
        <div className={styles.commerceHeading}>
          <div><h2 id="formulario-produto">{editingId ? "Editar produto" : "Adicionar produto"}</h2><p>Os preços são apresentados em kwanzas (AOA).</p></div>
        </div>
        <form className={styles.commerceForm} onSubmit={(event) => void saveProduct(event)}>
          <label>
            Nome do produto
            <input required maxLength={160} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Categoria
            <select required value={form.category || ""} onChange={(event) => setForm((current) => ({ ...current, category: Number(event.target.value) }))}>
              <option value="">Escolhe uma categoria</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className={styles.wide}>
            Descrição
            <textarea maxLength={5000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label>
            Preço (AOA)
            <input required type="number" min="0.01" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
          </label>
          <label>
            Quantidade em stock
            <input required type="number" min="0" step="1" value={form.stock_quantity} onChange={(event) => setForm((current) => ({ ...current, stock_quantity: Number(event.target.value) }))} />
          </label>
          <label className={styles.wide}>
            Imagem do produto <span>(JPEG, PNG ou WebP, máximo 5 MB)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectProductImage(event.target.files?.[0] ?? null)} />
          </label>
          {(imagePreview || form.image) && (
            <div
              className={`${styles.productImagePreview} ${styles.wide}`}
              role="img"
              aria-label={`Pré-visualização da imagem de ${form.name || "produto"}`}
              style={{ backgroundImage: `url("${imagePreview || form.image}")` }}
            />
          )}
          <label className={styles.wide}>
            URL da imagem (opcional)
            <input type="url" maxLength={1000} value={form.image_url} onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))} placeholder="https://…" />
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
            Publicar no catálogo
          </label>
          <div className={`${styles.formActions} ${styles.wide}`}>
            <button type="submit" disabled={saving}>{saving ? "A guardar…" : editingId ? "Guardar alterações" : "Publicar produto"}</button>
            {editingId && <button type="button" disabled={saving} onClick={() => { setEditingId(null); setForm(emptyForm); setImageFile(null); setImagePreview(""); }}>Cancelar edição</button>}
          </div>
        </form>
      </section>

      <section className={styles.commerceSection} aria-labelledby="produtos-publicados">
        <div className={styles.commerceHeading}><div><h2 id="produtos-publicados">O teu catálogo</h2><p>{products.length} produtos registados</p></div></div>
        {loading ? <p className={accountStyles.intro} role="status">A carregar catálogo…</p> : products.length ? (
          <div className={styles.productList}>
            {products.map((product) => (
              <article className={styles.productRow} key={product.id}>
                <div
                  className={styles.productThumb}
                  role="img"
                  aria-label={product.image || product.image_url ? `Imagem de ${product.name}` : `Sem imagem para ${product.name}`}
                  style={product.image || product.image_url ? { backgroundImage: `url("${product.image || product.image_url}")` } : undefined}
                >
                  {!product.image && !product.image_url && <span aria-hidden="true">✦</span>}
                </div>
                <div>
                  <h3>{product.name}</h3>
                  <p>{product.category_name} · {Number(product.price).toLocaleString("pt-AO")} AOA · {product.stock_quantity} em stock</p>
                  <span className={styles.status} data-active={String(product.is_active)}>{product.is_active ? "Publicado" : "Rascunho"}</span>
                </div>
                <div className={styles.productActions}>
                  <button type="button" onClick={() => editProduct(product)}>Editar</button>
                  {product.is_active && <button type="button" disabled={workingId === product.id} onClick={() => void deactivateProduct(product)}>{workingId === product.id ? "A desativar…" : "Desativar"}</button>}
                </div>
              </article>
            ))}
          </div>
        ) : <div className={styles.emptyState}>Ainda não adicionaste produtos. Preenche o formulário acima para os disponibilizar no catálogo.</div>}
      </section>
    </EstruturaAutenticacao>
  );
}
