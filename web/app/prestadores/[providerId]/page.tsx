import { notFound } from "next/navigation";
import { ProviderDetails } from "../../marketplace-details";

export default async function ProviderPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  if (!/^\d+$/.test(providerId)) notFound();
  return <ProviderDetails providerId={providerId} />;
}
