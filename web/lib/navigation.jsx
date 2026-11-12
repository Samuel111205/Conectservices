import { useCallback, useMemo } from "react";
import { useLocation, useNavigate, useParams as useRouterParams } from "react-router-dom";

export function useRouter() {
  const navigate = useNavigate();
  const push = useCallback((path, options) => navigate(path, options), [navigate]);
  const replace = useCallback(
    (path, options = {}) => navigate(path, { ...options, replace: true }),
    [navigate],
  );
  const router = useMemo(
    () => ({
      push,
      replace,
      back: () => navigate(-1),
      forward: () => navigate(1),
      refresh: () => window.location.reload(),
      prefetch: () => Promise.resolve(),
    }),
    [navigate, push, replace],
  );
  return router;
}

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  return new URLSearchParams(useLocation().search);
}

export function useParams() {
  return useRouterParams();
}

export function redirect(path) {
  window.location.replace(path);
}

export function notFound() {
  return null;
}
