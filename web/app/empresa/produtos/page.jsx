"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Link from "@/lib/link";
import { useRouter } from "@/lib/navigation";
import { useCallback, useEffect, useState } from "react";
import EstruturaAutenticacao from "../../auth-shell";
import accountStyles from "../../auth.module.css";
import styles from "../commerce.module.css";
const emptyForm = {
    category: 0,
    name: "",
    description: "",
    price: "",
    stock_quantity: 0,
    image: "",
    image_url: "",
    is_active: true,
};
function errorMessage(data) {
    if (data && typeof data === "object") {
        const values = Object.values(data).flatMap((value) => Array.isArray(value) ? value : [value]);
        const message = values.find((value) => typeof value === "string");
        if (typeof message === "string")
            return message;
    }
    return "Não foi possível concluir a operação.";
}
export default function GerirProdutos() {
    const router = useRouter();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [workingId, setWorkingId] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const loadData = useCallback(async () => {
        const [productResponse, categoryResponse] = await Promise.all([
            fetchApi("/api/auth/products", { cache: "no-store" }),
            fetchApi("/api/public/categories", { cache: "no-store" }),
        ]);
        if (productResponse.status === 401) {
            router.replace("/entrar?next=%2Fempresa%2Fprodutos");
            return { products: [], categories: [] };
        }
        const [productData, categoryData] = await Promise.all([
            productResponse.json(),
            categoryResponse.json(),
        ]);
        if (!productResponse.ok)
            throw new Error(errorMessage(productData));
        if (!categoryResponse.ok)
            throw new Error(errorMessage(categoryData));
        return {
            products: productData.results ?? [],
            categories: categoryData.results ?? [],
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
            .catch((reason) => {
            if (active)
                setError(reason instanceof Error ? reason.message : "Não foi possível carregar os produtos.");
        })
            .finally(() => {
            if (active)
                setLoading(false);
        });
        return () => { active = false; };
    }, [loadData]);
    function editProduct(product) {
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
    function selectProductImage(file) {
        setError("");
        setImageFile(file);
        setImagePreview("");
        if (!file)
            return;
        if (file.size > 5 * 1024 * 1024) {
            setImageFile(null);
            setError("A imagem deve ter no máximo 5 MB.");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setImagePreview(String(reader.result ?? ""));
        reader.readAsDataURL(file);
    }
    async function saveProduct(event) {
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
            let body = JSON.stringify(payload);
            if (imageFile) {
                const multipart = new FormData();
                Object.entries(payload).forEach(([key, value]) => multipart.append(key, String(value)));
                multipart.append("image", imageFile);
                body = multipart;
            }
            const response = await fetchApi(editingId ? `/api/auth/products/${editingId}` : "/api/auth/products", {
                method: editingId ? "PATCH" : "POST",
                ...(!imageFile ? { headers: { "Content-Type": "application/json" } } : {}),
                body,
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401) {
                router.replace("/entrar?next=%2Fempresa%2Fprodutos");
                return;
            }
            if (!response.ok)
                throw new Error(errorMessage(data));
            const loaded = await loadData();
            setProducts(loaded.products);
            setCategories(loaded.categories);
            setForm(emptyForm);
            setEditingId(null);
            setImageFile(null);
            setImagePreview("");
            setNotice("Produto guardado.");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Não foi possível guardar o produto.");
        }
        finally {
            setSaving(false);
        }
    }
    async function deactivateProduct(product) {
        setWorkingId(product.id);
        setError("");
        setNotice("");
        try {
            const response = await fetchApi(`/api/auth/products/${product.id}`, { method: "DELETE" });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401) {
                router.replace("/entrar?next=%2Fempresa%2Fprodutos");
                return;
            }
            if (!response.ok)
                throw new Error(errorMessage(data));
            const loaded = await loadData();
            setProducts(loaded.products);
            setCategories(loaded.categories);
            setNotice("Produto desativado. Podes voltar a ativá-lo ao editar.");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Não foi possível desativar o produto.");
        }
        finally {
            setWorkingId(null);
        }
    }
    return (_jsxs(EstruturaAutenticacao, { account: true, children: [_jsx("p", { className: accountStyles.eyebrow, children: "\u00C1rea empresarial" }), _jsx("h1", { children: "Produtos da empresa" }), _jsx("p", { className: accountStyles.intro, children: "Publica artigos com pre\u00E7o e stock. Indica um email ou telefone comercial no perfil da empresa para os clientes combinarem pagamento e entrega." }), _jsxs("div", { className: styles.commerceLinks, children: [_jsx(Link, { href: "/empresa", children: "Perfil da empresa" }), _jsx(Link, { href: "/empresa/encomendas", children: "Encomendas recebidas" }), _jsx(Link, { href: "/produtos", children: "Ver cat\u00E1logo p\u00FAblico" })] }), error && _jsx("p", { className: styles.inlineError, role: "alert", children: error }), notice && _jsx("p", { className: styles.inlineMessage, role: "status", children: notice }), _jsxs("section", { className: styles.commerceSection, "aria-labelledby": "formulario-produto", children: [_jsx("div", { className: styles.commerceHeading, children: _jsxs("div", { children: [_jsx("h2", { id: "formulario-produto", children: editingId ? "Editar produto" : "Adicionar produto" }), _jsx("p", { children: "Os pre\u00E7os s\u00E3o apresentados em kwanzas (AOA)." })] }) }), _jsxs("form", { className: styles.commerceForm, onSubmit: (event) => void saveProduct(event), children: [_jsxs("label", { children: ["Nome do produto", _jsx("input", { required: true, maxLength: 160, value: form.name, onChange: (event) => setForm((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { children: ["Categoria", _jsxs("select", { required: true, value: form.category || "", onChange: (event) => setForm((current) => ({ ...current, category: Number(event.target.value) })), children: [_jsx("option", { value: "", children: "Escolhe uma categoria" }), categories.map((category) => _jsx("option", { value: category.id, children: category.name }, category.id))] })] }), _jsxs("label", { className: styles.wide, children: ["Descri\u00E7\u00E3o", _jsx("textarea", { maxLength: 5000, value: form.description, onChange: (event) => setForm((current) => ({ ...current, description: event.target.value })) })] }), _jsxs("label", { children: ["Pre\u00E7o (AOA)", _jsx("input", { required: true, type: "number", min: "0.01", step: "0.01", value: form.price, onChange: (event) => setForm((current) => ({ ...current, price: event.target.value })) })] }), _jsxs("label", { children: ["Quantidade em stock", _jsx("input", { required: true, type: "number", min: "0", step: "1", value: form.stock_quantity, onChange: (event) => setForm((current) => ({ ...current, stock_quantity: Number(event.target.value) })) })] }), _jsxs("label", { className: styles.wide, children: ["Imagem do produto ", _jsx("span", { children: "(JPEG, PNG ou WebP, m\u00E1ximo 5 MB)" }), _jsx("input", { type: "file", accept: "image/jpeg,image/png,image/webp", onChange: (event) => selectProductImage(event.target.files?.[0] ?? null) })] }), (imagePreview || form.image) && (_jsx("div", { className: `${styles.productImagePreview} ${styles.wide}`, role: "img", "aria-label": `Pré-visualização da imagem de ${form.name || "produto"}`, style: { backgroundImage: `url("${imagePreview || form.image}")` } })), _jsxs("label", { className: styles.wide, children: ["URL da imagem (opcional)", _jsx("input", { type: "url", maxLength: 1000, value: form.image_url, onChange: (event) => setForm((current) => ({ ...current, image_url: event.target.value })), placeholder: "https://\u2026" })] }), _jsxs("label", { className: styles.checkboxLabel, children: [_jsx("input", { type: "checkbox", checked: form.is_active, onChange: (event) => setForm((current) => ({ ...current, is_active: event.target.checked })) }), "Publicar no cat\u00E1logo"] }), _jsxs("div", { className: `${styles.formActions} ${styles.wide}`, children: [_jsx("button", { type: "submit", disabled: saving, children: saving ? "A guardar…" : editingId ? "Guardar alterações" : "Publicar produto" }), editingId && _jsx("button", { type: "button", disabled: saving, onClick: () => { setEditingId(null); setForm(emptyForm); setImageFile(null); setImagePreview(""); }, children: "Cancelar edi\u00E7\u00E3o" })] })] })] }), _jsxs("section", { className: styles.commerceSection, "aria-labelledby": "produtos-publicados", children: [_jsx("div", { className: styles.commerceHeading, children: _jsxs("div", { children: [_jsx("h2", { id: "produtos-publicados", children: "O teu cat\u00E1logo" }), _jsxs("p", { children: [products.length, " produtos registados"] })] }) }), loading ? _jsx("p", { className: accountStyles.intro, role: "status", children: "A carregar cat\u00E1logo\u2026" }) : products.length ? (_jsx("div", { className: styles.productList, children: products.map((product) => (_jsxs("article", { className: styles.productRow, children: [_jsx("div", { className: styles.productThumb, role: "img", "aria-label": product.image || product.image_url ? `Imagem de ${product.name}` : `Sem imagem para ${product.name}`, style: product.image || product.image_url ? { backgroundImage: `url("${product.image || product.image_url}")` } : undefined, children: !product.image && !product.image_url && _jsx("span", { "aria-hidden": "true", children: "\u2726" }) }), _jsxs("div", { children: [_jsx("h3", { children: product.name }), _jsxs("p", { children: [product.category_name, " \u00B7 ", Number(product.price).toLocaleString("pt-AO"), " AOA \u00B7 ", product.stock_quantity, " em stock"] }), _jsx("span", { className: styles.status, "data-active": String(product.is_active), children: product.is_active ? "Publicado" : "Rascunho" })] }), _jsxs("div", { className: styles.productActions, children: [_jsx("button", { type: "button", onClick: () => editProduct(product), children: "Editar" }), product.is_active && _jsx("button", { type: "button", disabled: workingId === product.id, onClick: () => void deactivateProduct(product), children: workingId === product.id ? "A desativar…" : "Desativar" })] })] }, product.id))) })) : _jsx("div", { className: styles.emptyState, children: "Ainda n\u00E3o adicionaste produtos. Preenche o formul\u00E1rio acima para os disponibilizar no cat\u00E1logo." })] })] }));
}
