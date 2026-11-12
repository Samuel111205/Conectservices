import { Navigate, useParams } from "react-router-dom";
import { ProviderDetails } from "../../marketplace-details";

export default function ProviderPage() {
  const { providerId } = useParams();
  if (!/^\d+$/.test(providerId || "")) {
    return <Navigate to="/not-found" replace />;
  }
  return <ProviderDetails providerId={providerId} />;
}
