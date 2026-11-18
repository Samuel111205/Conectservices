const activeAreaStorageKey = "conect-services:active-area";
export function readActiveArea() {
    if (typeof window === "undefined")
        return null;
    const area = window.localStorage.getItem(activeAreaStorageKey);
    return area === "client" || area === "provider" || area === "company" ? area : null;
}
export function rememberActiveArea(area) {
    if (typeof window !== "undefined" && ["client", "provider", "company"].includes(area)) {
        window.localStorage.setItem(activeAreaStorageKey, area);
    }
}
