"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import EstruturaAutenticacao from "../auth-shell";
import styles from "../auth.module.css";

type Profile = {
  id: number;
  full_name: string;
  biography: string;
  birth_date: string | null;
};

type Provider = {
  id: number;
  commercial_name: string;
  description: string;
  business_phone: string;
  business_email: string;
  verification_status: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";
  verification_submitted_at: string | null;
  verification_feedback: string;
};

type VerificationDocument = {
  id: number;
  document_type: string;
  uploaded_at: string;
};

type ApiPage<T> = { results: T[] };
type FormErrors = Record<string, string[]>;

const tiposDocumento = [
  { value: "IDENTITY", label: "Documento de identificação" },
  { value: "BUSINESS_REGISTRATION", label: "Registo comercial" },
  { value: "PROFESSIONAL_CERTIFICATE", label: "Certificação profissional" },
  { value: "OTHER", label: "Outro comprovativo" },
];

function extrairErros(dadosRecebidos: unknown): FormErrors {
  if (!dadosRecebidos || typeof dadosRecebidos !== "object") {
    return { detail: ["Não foi possível concluir o pedido."] };
  }
  return Object.fromEntries(
    Object.entries(dadosRecebidos).map(([chave, valor]) => [
      chave,
      Array.isArray(valor) ? valor.map(String) : [String(valor)],
    ]),
  );
}

function primeiroErro(erros: FormErrors) {
  return Object.values(erros)[0]?.[0] ?? "Não foi possível concluir o pedido.";
}

async function lerRecurso<T>(endereco: string): Promise<T | null> {
  const respostaHttp = await fetch(endereco, { cache: "no-store" });
  if (respostaHttp.status === 404) return null;
  if (respostaHttp.status === 401) throw new Error("UNAUTHENTICATED");
  const dadosRecebidos = await respostaHttp.json();
  if (!respostaHttp.ok) {
    throw new Error(
      typeof dadosRecebidos?.detail === "string"
        ? dadosRecebidos.detail
        : "Não foi possível carregar os dados do perfil.",
    );
  }
  return dadosRecebidos as T;
}

export default function PaginaPerfil() {
  const navegador = useRouter();
  const [perfilAtual, definirPerfilAtual] = useState<Profile | null>(null);
  const [prestador, definirPrestador] = useState<Provider | null>(null);
  const [estaCarregando, definirCarregamento] = useState(true);
  const [erro, definirErro] = useState("");
  const [erroPerfil, definirErroPerfil] = useState("");
  const [erroPrestador, definirErroPrestador] = useState("");
  const [documentos, definirDocumentos] = useState<VerificationDocument[]>([]);
  const [erroDocumentos, definirErroDocumentos] = useState("");
  const [tipoDocumento, definirTipoDocumento] = useState("IDENTITY");
  const [aEnviarDocumento, definirEnvioDocumento] = useState(false);
  const [aSubmeterVerificacao, definirEnvioVerificacao] = useState(false);
  const [idDocumentoRemovido, definirIdDocumentoRemovido] = useState<number | null>(null);
  const [aGuardarPerfil, definirGravacaoPerfil] = useState(false);
  const [aGuardarPrestador, definirGravacaoPrestador] = useState(false);
  const [nomeCompleto, definirNomeCompleto] = useState("");
  const [biografia, definirBiografia] = useState("");
  const [dataNascimento, definirDataNascimento] = useState("");
  const [nomeComercial, definirNomeComercial] = useState("");
  const [descricao, definirDescricao] = useState("");
  const [telefoneEmpresa, definirTelefoneEmpresa] = useState("");
  const [emailEmpresa, definirEmailEmpresa] = useState("");

  useEffect(() => {
    let ativo = true;
    Promise.all([
      lerRecurso<Profile>("/api/auth/profiles/me/"),
      lerRecurso<Provider>("/api/auth/providers/me/"),
    ])
      .then(async ([perfilAtual, prestadorAtual]) => {
        if (!ativo) return;
        definirPerfilAtual(perfilAtual);
        definirPrestador(prestadorAtual);
        if (perfilAtual) {
          definirNomeCompleto(perfilAtual.full_name);
          definirBiografia(perfilAtual.biography);
          definirDataNascimento(perfilAtual.birth_date ?? "");
        }
        if (prestadorAtual) {
          definirNomeComercial(prestadorAtual.commercial_name);
          definirDescricao(prestadorAtual.description);
          definirTelefoneEmpresa(prestadorAtual.business_phone);
          definirEmailEmpresa(prestadorAtual.business_email);
          try {
            const respostaDocumentos = await fetch(
              "/api/auth/provider-verification-documents/",
              { cache: "no-store" },
            );
            if (!ativo) return;
            if (respostaDocumentos.status === 401) {
              navegador.replace("/entrar?next=%2Fperfil");
              return;
            }
            if (!respostaDocumentos.ok) {
              const dados = await respostaDocumentos.json();
              definirErroDocumentos(primeiroErro(extrairErros(dados)));
            } else {
              const paginaDocumentos =
                (await respostaDocumentos.json()) as ApiPage<VerificationDocument>;
              definirDocumentos(paginaDocumentos.results);
            }
          } catch {
            if (ativo) {
              definirErroDocumentos(
                "Não foi possível carregar os documentos de verificação.",
              );
            }
          }
        }
      })
      .catch((motivo: unknown) => {
        if (!ativo) return;
        if (motivo instanceof Error && motivo.message === "UNAUTHENTICATED") {
          navegador.replace("/entrar?next=%2Fperfil");
        } else {
          definirErro(
            motivo instanceof Error
              ? motivo.message
              : "Não foi possível carregar os perfis.",
          );
        }
      })
      .finally(() => {
        if (ativo) definirCarregamento(false);
      });

    return () => {
      ativo = false;
    };
  }, [navegador]);

  async function guardarPerfil(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirGravacaoPerfil(true);
    definirErroPerfil("");
    try {
      const respostaHttp = await fetch(
        perfilAtual ? "/api/auth/profiles/me/" : "/api/auth/profiles/",
        {
          method: perfilAtual ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: nomeCompleto,
            biography: biografia,
            birth_date: dataNascimento || null,
          }),
        },
      );
      const dadosRecebidos = await respostaHttp.json();
      if (!respostaHttp.ok) {
        definirErroPerfil(primeiroErro(extrairErros(dadosRecebidos)));
        return;
      }
      definirPerfilAtual(dadosRecebidos as Profile);
    } catch {
      definirErroPerfil("Não foi possível contactar o serviço.");
    } finally {
      definirGravacaoPerfil(false);
    }
  }

  async function guardarPrestador(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirGravacaoPrestador(true);
    definirErroPrestador("");
    try {
      const respostaHttp = await fetch(
        prestador ? "/api/auth/providers/me/" : "/api/auth/providers/",
        {
          method: prestador ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commercial_name: nomeComercial,
            description: descricao,
            business_phone: telefoneEmpresa,
            business_email: emailEmpresa,
          }),
        },
      );
      const dadosRecebidos = await respostaHttp.json();
      if (!respostaHttp.ok) {
        definirErroPrestador(primeiroErro(extrairErros(dadosRecebidos)));
        return;
      }
      definirPrestador(dadosRecebidos as Provider);
    } catch {
      definirErroPrestador("Não foi possível contactar o serviço.");
    } finally {
      definirGravacaoPrestador(false);
    }
  }

  async function enviarDocumento(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const dadosFormulario = new FormData(formulario);
    definirErroDocumentos("");
    definirEnvioDocumento(true);
    try {
      const respostaHttp = await fetch(
        "/api/auth/provider-verification-documents/",
        { method: "POST", body: dadosFormulario },
      );
      const dadosRecebidos: unknown = await respostaHttp.json();
      if (respostaHttp.status === 401) {
        navegador.replace("/entrar?next=%2Fperfil");
        return;
      }
      if (!respostaHttp.ok) {
        definirErroDocumentos(primeiroErro(extrairErros(dadosRecebidos)));
        return;
      }
      definirDocumentos((atuais) => [...atuais, dadosRecebidos as VerificationDocument]);
      formulario.reset();
      definirTipoDocumento("IDENTITY");
    } catch {
      definirErroDocumentos("Não foi possível contactar o serviço.");
    } finally {
      definirEnvioDocumento(false);
    }
  }

  async function removerDocumento(documento: VerificationDocument) {
    definirErroDocumentos("");
    definirIdDocumentoRemovido(documento.id);
    try {
      const respostaHttp = await fetch(
        `/api/auth/provider-verification-documents/${documento.id}/`,
        { method: "DELETE" },
      );
      if (respostaHttp.status === 401) {
        navegador.replace("/entrar?next=%2Fperfil");
        return;
      }
      if (!respostaHttp.ok) {
        const dadosRecebidos = await respostaHttp.json();
        definirErroDocumentos(primeiroErro(extrairErros(dadosRecebidos)));
        return;
      }
      definirDocumentos((atuais) =>
        atuais.filter((item) => item.id !== documento.id),
      );
    } catch {
      definirErroDocumentos("Não foi possível contactar o serviço.");
    } finally {
      definirIdDocumentoRemovido(null);
    }
  }

  async function submeterVerificacao() {
    definirErroDocumentos("");
    definirEnvioVerificacao(true);
    try {
      const respostaHttp = await fetch(
        "/api/auth/providers/me/submit-verification/",
        { method: "POST" },
      );
      const dadosRecebidos: unknown = await respostaHttp.json();
      if (respostaHttp.status === 401) {
        navegador.replace("/entrar?next=%2Fperfil");
        return;
      }
      if (!respostaHttp.ok) {
        definirErroDocumentos(primeiroErro(extrairErros(dadosRecebidos)));
        return;
      }
      definirPrestador(dadosRecebidos as Provider);
    } catch {
      definirErroDocumentos("Não foi possível contactar o serviço.");
    } finally {
      definirEnvioVerificacao(false);
    }
  }

  function textoEstadoVerificacao(provider: Provider) {
    if (provider.verification_status === "VERIFIED") return "Verificado";
    if (provider.verification_status === "REJECTED") return "Precisa de ajustes";
    if (provider.verification_status === "SUSPENDED") return "Suspenso";
    return provider.verification_submitted_at ? "Em análise" : "Rascunho";
  }

  const podeEnviarDocumentos =
    prestador?.verification_status === "PENDING" ||
    prestador?.verification_status === "REJECTED";
  const podeSubmeterVerificacao =
    Boolean(podeEnviarDocumentos) &&
    (prestador?.verification_status === "REJECTED" ||
      !prestador?.verification_submitted_at) &&
    documentos.length > 0;

  return (
    <EstruturaAutenticacao account>
      <p className={styles.eyebrow}>Personalização</p>
      <h1>Os teus perfis</h1>
      <p className={styles.intro}>
        Cria o teu perfil pessoal, o teu perfil profissional, ou ambos. Podes
        atualizar estes dados mais tarde.
      </p>
      {estaCarregando ? (
        <p className={styles.intro} aria-live="polite">
          A carregar os teus perfis…
        </p>
      ) : erro ? (
        <p className={styles.notice} role="alert">
          {erro}
        </p>
      ) : (
        <div className={styles.profileSections}>
          <section className={styles.profileSection}>
            <div className={styles.profileHeading}>
              <h2>Perfil pessoal</h2>
              {perfilAtual && <span className={styles.profileBadge}>Criado</span>}
            </div>
            <form className={styles.form} onSubmit={guardarPerfil}>
              <label className={styles.field}>
                Nome completo
                <input
                  name="full_name"
                  autoComplete="name"
                  required
                  maxLength={160}
                  value={nomeCompleto}
                  onChange={(evento) => definirNomeCompleto(evento.target.value)}
                />
              </label>
              <label className={styles.field}>
                Sobre ti <span>(opcional)</span>
                <textarea
                  name="biography"
                  maxLength={2000}
                  rows={3}
                  value={biografia}
                  onChange={(evento) => definirBiografia(evento.target.value)}
                />
              </label>
              <label className={styles.field}>
                Data de nascimento <span>(opcional)</span>
                <input
                  type="date"
                  name="birth_date"
                  value={dataNascimento}
                  onChange={(evento) => definirDataNascimento(evento.target.value)}
                />
              </label>
              {erroPerfil && (
                <p className={styles.notice} role="alert">
                  {erroPerfil}
                </p>
              )}
              <button
                className={styles.submit}
                type="submit"
                disabled={aGuardarPerfil}
              >
                {aGuardarPerfil
                  ? "A guardar…"
                  : perfilAtual
                    ? "Guardar perfil pessoal"
                    : "Criar perfil pessoal"}
              </button>
            </form>
          </section>

          <section className={styles.profileSection}>
            <div className={styles.profileHeading}>
              <h2>Perfil profissional</h2>
              {prestador && (
                <span className={styles.profileBadge}>
                  {textoEstadoVerificacao(prestador)}
                </span>
              )}
            </div>
            <p className={styles.profileHint}>
              Para apresentar os teus serviços como profissional ou empresa.
            </p>
            <form className={styles.form} onSubmit={guardarPrestador}>
              <label className={styles.field}>
                Nome profissional ou comercial
                <input
                  name="commercial_name"
                  required
                  maxLength={160}
                  value={nomeComercial}
                  onChange={(evento) => definirNomeComercial(evento.target.value)}
                />
              </label>
              <label className={styles.field}>
                Descrição <span>(opcional)</span>
                <textarea
                  name="description"
                  maxLength={5000}
                  rows={3}
                  value={descricao}
                  onChange={(evento) => definirDescricao(evento.target.value)}
                />
              </label>
              <label className={styles.field}>
                Telefone profissional <span>(opcional)</span>
                <input
                  type="tel"
                  name="business_phone"
                  maxLength={32}
                  value={telefoneEmpresa}
                  onChange={(evento) => definirTelefoneEmpresa(evento.target.value)}
                />
              </label>
              <label className={styles.field}>
                Email profissional <span>(opcional)</span>
                <input
                  type="email"
                  name="business_email"
                  value={emailEmpresa}
                  onChange={(evento) => definirEmailEmpresa(evento.target.value)}
                />
              </label>
              {erroPrestador && (
                <p className={styles.notice} role="alert">
                  {erroPrestador}
                </p>
              )}
              <button
                className={styles.submit}
                type="submit"
                disabled={aGuardarPrestador}
              >
                {aGuardarPrestador
                  ? "A guardar…"
                  : prestador
                    ? "Guardar perfil profissional"
                    : "Criar perfil profissional"}
              </button>
            </form>
            {prestador && (
              <div className={styles.verificationPanel}>
                <div>
                  <h3>Verificação profissional</h3>
                  <p>
                    Envia comprovativos em PDF, JPEG ou PNG (máximo 10 MB por
                    ficheiro). Os documentos ficam privados e só podem ser
                    consultados por administradores durante a revisão.
                  </p>
                </div>
                {prestador.verification_feedback && (
                  <p className={styles.verificationFeedback} role="status">
                    {prestador.verification_feedback}
                  </p>
                )}
                {documentos.length > 0 && (
                  <ul className={styles.verificationDocumentList}>
                    {documentos.map((documento) => (
                      <li key={documento.id}>
                        <span>
                          {tiposDocumento.find(
                            (tipo) => tipo.value === documento.document_type,
                          )?.label ?? "Comprovativo"}
                          <small>
                            Enviado em{" "}
                            {new Date(documento.uploaded_at).toLocaleDateString("pt-AO")}
                          </small>
                        </span>
                        {podeEnviarDocumentos &&
                          (prestador.verification_status === "REJECTED" ||
                            !prestador.verification_submitted_at) && (
                          <button
                            className={styles.documentRemove}
                            type="button"
                            disabled={idDocumentoRemovido === documento.id}
                            onClick={() => void removerDocumento(documento)}
                          >
                            {idDocumentoRemovido === documento.id
                              ? "A remover…"
                              : "Remover"}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {podeEnviarDocumentos &&
                  (prestador.verification_status === "REJECTED" ||
                    !prestador.verification_submitted_at) && (
                  <>
                    <form className={styles.verificationUploadForm} onSubmit={enviarDocumento}>
                      <label className={styles.field}>
                        Tipo de documento
                        <select
                          name="document_type"
                          value={tipoDocumento}
                          onChange={(evento) => definirTipoDocumento(evento.target.value)}
                        >
                          {tiposDocumento.map((tipo) => (
                            <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        Ficheiro
                        <input
                          name="file"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          required
                        />
                      </label>
                      <button
                        className={styles.secondary}
                        type="submit"
                        disabled={aEnviarDocumento}
                      >
                        {aEnviarDocumento ? "A enviar…" : "Adicionar documento"}
                      </button>
                    </form>
                    <button
                      className={styles.submit}
                      type="button"
                      disabled={!podeSubmeterVerificacao || aSubmeterVerificacao}
                      onClick={() => void submeterVerificacao()}
                    >
                      {aSubmeterVerificacao
                        ? "A submeter…"
                        : prestador.verification_status === "REJECTED"
                          ? "Submeter novamente para revisão"
                          : "Enviar candidatura para revisão"}
                    </button>
                  </>
                )}
                {prestador.verification_status === "PENDING" &&
                  prestador.verification_submitted_at && (
                    <p className={styles.profileHint}>
                      Candidatura enviada em{" "}
                      {new Date(prestador.verification_submitted_at).toLocaleDateString("pt-AO")}.
                      Aguarda a revisão administrativa.
                    </p>
                  )}
                {erroDocumentos && (
                  <p className={styles.notice} role="alert">{erroDocumentos}</p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
      <div className={styles.accountActions}>
        <a className={styles.secondary} href="/prestador/servicos">
          Gerir os meus serviços
        </a>
        <a className={styles.secondary} href="/prestador/pedidos">
          Ver pedidos disponíveis
        </a>
        <a className={styles.secondary} href="/contratacoes">
          Ver contratações
        </a>
        <a className={styles.secondary} href="/conta">
          Voltar à área pessoal
        </a>
      </div>
    </EstruturaAutenticacao>
  );
}
