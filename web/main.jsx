import { StrictMode, Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./app/globals.css";

const PaginaInicial = lazy(() => import("./app/home-gate"));
const Administracao = lazy(() => import("./app/admin/page"));
const Categorias = lazy(() => import("./app/categorias/page"));
const Casos = lazy(() => import("./app/casos/page"));
const ConfirmarEmail = lazy(() => import("./app/confirmar-email/page"));
const Conta = lazy(() => import("./app/conta/page"));
const Contratacoes = lazy(() => import("./app/contratacoes/page"));
const Empresa = lazy(() => import("./app/empresa/page"));
const EncomendasEmpresa = lazy(() => import("./app/empresa/encomendas/page"));
const ProdutosEmpresa = lazy(() => import("./app/empresa/produtos/page"));
const Entrar = lazy(() => import("./app/entrar/page"));
const Explorar = lazy(() => import("./app/explorar/page"));
const Favoritos = lazy(() => import("./app/favoritos/page"));
const Mensagens = lazy(() => import("./app/mensagens/page"));
const Perfil = lazy(() => import("./app/perfil/page"));
const Pedidos = lazy(() => import("./app/pedidos/page"));
const NovoPedido = lazy(() => import("./app/pedidos/novo/page"));
const Prestador = lazy(() => import("./app/prestador/page"));
const PedidosPrestador = lazy(() => import("./app/prestador/pedidos/page"));
const ServicosPrestador = lazy(() => import("./app/prestador/servicos/page"));
const Produtos = lazy(() => import("./app/produtos/page"));
const Compras = lazy(() => import("./app/compras/page"));
const RecuperarAcesso = lazy(() => import("./app/recuperar-acesso/page"));
const RedefinirPalavraPasse = lazy(() => import("./app/redefinir-palavra-passe/page"));
const Registar = lazy(() => import("./app/registar/page"));
const PrestadorDetalhe = lazy(() => import("./app/prestadores/[providerId]/page"));
const ServicoDetalhe = lazy(() => import("./app/servicos/[serviceId]/page"));
const Diretorio = lazy(() => import("./app/directory-page"));

function RestaurarScroll() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, location.search, location.hash]);

  return null;
}

function PaginaNaoEncontrada() {
  return (
    <main className="not-found-page">
      <h1>Página não encontrada</h1>
      <p>A página que procuras não existe ou foi movida.</p>
      <a href="/">Voltar ao início</a>
    </main>
  );
}

function Aplicacao() {
  return (
    <BrowserRouter>
      <RestaurarScroll />
      <Suspense fallback={<p className="app-loading" role="status">A carregar…</p>}>
        <Routes>
          <Route path="/" element={<PaginaInicial />} />
          <Route path="/admin" element={<Administracao />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/casos" element={<Casos />} />
          <Route path="/confirmar-email" element={<ConfirmarEmail />} />
          <Route path="/empreendedores" element={<Diretorio audience="entrepreneurs" />} />
          <Route path="/empresas" element={<Diretorio audience="companies" />} />
          <Route path="/conta" element={<Conta />} />
          <Route path="/contratacoes" element={<Contratacoes />} />
          <Route path="/empresa" element={<Empresa />} />
          <Route path="/empresa/encomendas" element={<EncomendasEmpresa />} />
          <Route path="/empresa/produtos" element={<ProdutosEmpresa />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/explorar" element={<Explorar />} />
          <Route path="/favoritos" element={<Favoritos />} />
          <Route path="/mensagens" element={<Mensagens />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/pedidos/novo" element={<NovoPedido />} />
          <Route path="/prestador" element={<Prestador />} />
          <Route path="/prestador/pedidos" element={<PedidosPrestador />} />
          <Route path="/prestador/servicos" element={<ServicosPrestador />} />
          <Route path="/prestadores" element={<Diretorio audience="providers" />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/compras" element={<Compras />} />
          <Route path="/recuperar-acesso" element={<RecuperarAcesso />} />
          <Route path="/redefinir-palavra-passe" element={<RedefinirPalavraPasse />} />
          <Route path="/registar" element={<Registar />} />
          <Route path="/prestadores/:providerId" element={<PrestadorDetalhe />} />
          <Route path="/servicos/:serviceId" element={<ServicoDetalhe />} />
          <Route path="/not-found" element={<PaginaNaoEncontrada />} />
          <Route path="*" element={<PaginaNaoEncontrada />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Aplicacao />
  </StrictMode>,
);
