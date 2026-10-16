"use client";

import { useEffect } from "react";

const alvosDeAnimacao = "main section, main article";

export default function ObservadorDeScroll() {
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const raiz = document.documentElement;
    raiz.dataset.scrollReveal = "enabled";

    const observados = new WeakSet<Element>();
    const observador = new IntersectionObserver(
      (entradas, instancia) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;

          const elemento = entrada.target as HTMLElement;
          elemento.dataset.scrollReveal = "visible";
          instancia.unobserve(elemento);

          window.setTimeout(() => {
            if (elemento.dataset.scrollReveal === "visible") {
              delete elemento.dataset.scrollReveal;
              elemento.style.removeProperty("--scroll-reveal-delay");
            }
          }, 1_100);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -48px 0px" },
    );

    function observar(elemento: Element) {
      if (observados.has(elemento)) return;
      observados.add(elemento);
      elemento.setAttribute("data-scroll-reveal", "pending");

      if (elemento.tagName === "ARTICLE" && elemento.parentElement) {
        const artigos = Array.from(elemento.parentElement.children).filter(
          (filho) => filho.tagName === "ARTICLE",
        );
        const indice = artigos.indexOf(elemento);
        if (indice > 0) {
          (elemento as HTMLElement).style.setProperty(
            "--scroll-reveal-delay",
            `${Math.min(indice, 4) * 70}ms`,
          );
        }
      }

      observador.observe(elemento);
    }

    function procurarAlvos(no: Node) {
      if (!(no instanceof Element)) return;
      if (no.matches(alvosDeAnimacao)) observar(no);
      no.querySelectorAll(alvosDeAnimacao).forEach(observar);
    }

    procurarAlvos(document.body);

    const mutacoes = new MutationObserver((registos) => {
      for (const registo of registos) {
        registo.addedNodes.forEach(procurarAlvos);
      }
    });
    mutacoes.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutacoes.disconnect();
      observador.disconnect();
      delete raiz.dataset.scrollReveal;
    };
  }, []);

  return null;
}
