import { notFound } from "next/navigation";
import { ServiceDetails } from "../../marketplace-details";

export default async function ServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  if (!/^\d+$/.test(serviceId)) notFound();
  return <ServiceDetails serviceId={serviceId} />;
}
