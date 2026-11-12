import { Navigate, useParams } from "react-router-dom";
import { ServiceDetails } from "../../marketplace-details";

export default function ServicePage() {
  const { serviceId } = useParams();
  if (!/^\d+$/.test(serviceId || "")) {
    return <Navigate to="/not-found" replace />;
  }
  return <ServiceDetails serviceId={serviceId} />;
}
