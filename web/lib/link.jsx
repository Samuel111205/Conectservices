import { Link as RouterLink } from "react-router-dom";

function urlForHref(href) {
  if (typeof href !== "string") return href;
  if (href.startsWith("/api/admin/")) {
    return href.replace(/^\/api\/admin\//, "/admin/");
  }
  return href;
}

export default function Link({ href, prefetch, scroll, ...properties }) {
  const destination = urlForHref(href);
  if (
    typeof destination !== "string" ||
    destination.startsWith("#") ||
    destination.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(destination) ||
    destination.startsWith("/admin/")
  ) {
    return <a href={destination} {...properties} />;
  }
  return <RouterLink to={destination} {...properties} />;
}
