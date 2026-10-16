export type ActiveArea = "client" | "provider";

const activeAreaStorageKey = "conect-services:active-area";

export function readActiveArea(): ActiveArea | null {
  if (typeof window === "undefined") return null;
  const area = window.localStorage.getItem(activeAreaStorageKey);
  return area === "client" || area === "provider" ? area : null;
}

export function rememberActiveArea(area: ActiveArea) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(activeAreaStorageKey, area);
  }
}
