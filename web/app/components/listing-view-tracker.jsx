"use client";
import { fetchApi } from "@/lib/api-client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
function obterChaveSessao() {
    const storageKey = "conect-services-view-session";
    try {
        const atual = window.sessionStorage.getItem(storageKey);
        if (atual)
            return atual;
        const nova = window.crypto.randomUUID();
        window.sessionStorage.setItem(storageKey, nova);
        return nova;
    }
    catch {
        return window.crypto.randomUUID();
    }
}
export default function ListingViewTracker({ listingType, listingId, }) {
    const target = useRef(null);
    useEffect(() => {
        const element = target.current;
        if (!element || !("IntersectionObserver" in window))
            return;
        let sent = false;
        const observer = new IntersectionObserver((entries) => {
            if (sent || !entries.some((entry) => entry.isIntersecting))
                return;
            sent = true;
            observer.disconnect();
            fetchApi("/api/public/analytics/views", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    listing_type: listingType,
                    listing_id: listingId,
                    session_key: obterChaveSessao(),
                }),
                keepalive: true,
            })
                .then((response) => {
                if (!response.ok) {
                    console.error(`Não foi possível registar a visualização (${response.status}).`);
                }
            })
                .catch((error) => {
                console.error("Falha ao registar a visualização da publicação.", error);
            });
        }, { threshold: 0.1 });
        observer.observe(element);
        return () => observer.disconnect();
    }, [listingId, listingType]);
    return (_jsx("span", { ref: target, "aria-hidden": "true", style: { display: "block", width: 1, height: 1, pointerEvents: "none" } }));
}
