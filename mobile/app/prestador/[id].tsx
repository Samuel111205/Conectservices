import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiRequest, ApiError } from "@/lib/api";

type Service = {
  id: number;
  name: string;
  description: string;
  minimum_price: string | null;
  maximum_price: string | null;
  price_type: "FIXED" | "STARTING_AT" | "RANGE" | "ON_REQUEST";
  currency: string;
  duration_minutes: number | null;
};
type Page<T> = { results: T[] };

function priceLabel(service: Service) {
  const min = service.minimum_price;
  const max = service.maximum_price;
  if (service.price_type === "ON_REQUEST") return "Preço sob consulta";
  if (service.price_type === "RANGE" && min && max) return `${min}–${max} ${service.currency}`;
  if (service.price_type === "STARTING_AT" && min) return `A partir de ${min} ${service.currency}`;
  if (min) return `${min} ${service.currency}`;
  return "Pede uma proposta";
}

export default function ProviderScreen() {
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    rating?: string;
    reviews?: string;
  }>();
  const providerId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void apiRequest<Page<Service>>(`/services/?provider=${encodeURIComponent(providerId)}`)
      .then((page) => {
        if (mounted) setServices(page.results ?? []);
      })
      .catch((reason: unknown) => {
        if (mounted) {
          setError(
            reason instanceof ApiError
              ? reason.message
              : "Não foi possível carregar os serviços deste prestador.",
          );
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [providerId]);

  const name = Array.isArray(params.name) ? params.name[0] : params.name;
  const rating = Array.isArray(params.rating) ? params.rating[0] : params.rating;
  const reviews = Array.isArray(params.reviews) ? params.reviews[0] : params.reviews;

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.providerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(name?.slice(0, 1) || "P").toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{name || "Prestador"}</Text>
          <Text style={styles.providerDescription}>Profissional verificado na Conect Services.</Text>
          <Text style={styles.rating}>
            {rating ? `★ ${rating}` : "Ainda sem avaliações"}{reviews ? ` · ${reviews} avaliações` : ""}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Serviços</Text>
        {isLoading ? <ActivityIndicator color="#0a7563" style={styles.loader} /> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {!isLoading && !error && services.length === 0 ? (
          <Text style={styles.muted}>Este prestador ainda não tem serviços publicados.</Text>
        ) : null}
        {services.map((service) => (
          <View key={service.id} style={styles.serviceCard}>
            <Text style={styles.serviceName}>{service.name}</Text>
            {service.description ? <Text style={styles.description}>{service.description}</Text> : null}
            <Text style={styles.price}>{priceLabel(service)}</Text>
            {service.duration_minutes ? (
              <Text style={styles.duration}>Duração aproximada: {service.duration_minutes} min</Text>
            ) : null}
          </View>
        ))}
        <Link href="/(tabs)/conta" style={styles.accountLink}>Entra para gerir os teus pedidos</Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#fffdf8", flex: 1 },
  content: { padding: 18, paddingBottom: 32 },
  providerCard: { alignItems: "center", backgroundColor: "#123c35", borderRadius: 22, padding: 22 },
  avatar: { alignItems: "center", backgroundColor: "#dff2e9", borderRadius: 30, height: 60, justifyContent: "center", width: 60 },
  avatarText: { color: "#176653", fontSize: 24, fontWeight: "800" },
  name: { color: "#fffdf8", fontSize: 23, fontWeight: "800", marginTop: 12, textAlign: "center" },
  description: { color: "#61716b", fontSize: 14, lineHeight: 21, marginTop: 6 },
  providerDescription: { color: "#d5e7df", fontSize: 14, lineHeight: 21, marginTop: 6, textAlign: "center" },
  rating: { color: "#f2ce82", fontSize: 13, fontWeight: "700", marginTop: 12 },
  sectionTitle: { color: "#183d35", fontSize: 20, fontWeight: "800", marginTop: 24, marginBottom: 12 },
  loader: { marginVertical: 22 },
  serviceCard: { backgroundColor: "#ffffff", borderColor: "#e7ece8", borderRadius: 17, borderWidth: 1, marginBottom: 12, padding: 16 },
  serviceName: { color: "#183d35", fontSize: 16, fontWeight: "800" },
  price: { color: "#08755f", fontSize: 15, fontWeight: "800", marginTop: 12 },
  duration: { color: "#718079", fontSize: 12, marginTop: 5 },
  muted: { color: "#61716b", fontSize: 14, lineHeight: 21 },
  error: { color: "#a12f37", fontSize: 14, lineHeight: 20 },
  accountLink: { color: "#08755f", fontSize: 14, fontWeight: "700", marginTop: 16, textAlign: "center" },
});
