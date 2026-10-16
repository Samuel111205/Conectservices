import { Link } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiRequest, ApiError } from "@/lib/api";

type Provider = {
  id: number;
  commercial_name: string;
  description: string;
  active_service_count: number;
  average_rating: string | null;
  review_count: number;
};
type Page<T> = { results: T[] };

export default function ExploreScreen() {
  const [search, setSearch] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  async function loadProviders(query = search) {
    const version = ++requestVersion.current;
    setError(null);
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      const queryString = params.toString();
      const suffix = queryString ? `?${queryString}` : "";
      const page = await apiRequest<Page<Provider>>(`/providers/discover/${suffix}`);
      if (version === requestVersion.current) setProviders(page.results ?? []);
    } catch (reason) {
      if (version === requestVersion.current) {
        setProviders([]);
        setError(
          reason instanceof ApiError
            ? reason.message
            : "Não foi possível carregar prestadores agora.",
        );
      }
    } finally {
      if (version === requestVersion.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => void loadProviders(search), search ? 300 : 0);
    return () => clearTimeout(timeout);
    // Search is intentionally debounced to limit API requests while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <FlatList
        data={providers}
        keyExtractor={(provider) => String(provider.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              void loadProviders();
            }}
            tintColor="#0a7563"
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.brand}>CONECT SERVICES</Text>
              <Text style={styles.heroTitle}>Encontra quem resolve.</Text>
              <Text style={styles.heroSubtitle}>
                Descobre profissionais e serviços perto de ti.
              </Text>
              <TextInput
                accessibilityLabel="Pesquisar serviços ou prestadores"
                placeholder="Ex.: canalizador, fotografia…"
                placeholderTextColor="#75847e"
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                style={styles.search}
              />
            </View>
            <Text style={styles.sectionTitle}>Prestadores em destaque</Text>
            {isLoading ? <ActivityIndicator color="#0a7563" style={styles.loader} /> : null}
            {error ? (
              <View style={styles.messageCard}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => void loadProviders()}>
                  <Text style={styles.linkText}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}
            {!isLoading && !error && providers.length === 0 ? (
              <View style={styles.messageCard}>
                <Text style={styles.emptyTitle}>Ainda não encontrámos resultados.</Text>
                <Text style={styles.mutedText}>Experimenta outra pesquisa.</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Link
            href={{
              pathname: "/prestador/[id]",
              params: {
                id: String(item.id),
                name: item.commercial_name,
                rating: item.average_rating ?? "",
                reviews: String(item.review_count),
              },
            }}
            asChild
          >
            <Pressable style={styles.providerCard} accessibilityRole="button">
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.commercial_name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.providerDetails}>
                <Text style={styles.providerName}>{item.commercial_name}</Text>
                <Text style={styles.providerDescription} numberOfLines={2}>
                  {item.description || "Profissional disponível para novos serviços."}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.rating}>
                    {item.average_rating ? `★ ${item.average_rating}` : "Nova conta"}
                  </Text>
                  <Text style={styles.metaText}>· {item.review_count} avaliações</Text>
                  <Text style={styles.metaText}>· {item.active_service_count} serviços</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </Link>
        )}
        ListFooterComponent={<View style={styles.footer} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fffdf8" },
  listContent: { paddingBottom: 24 },
  hero: {
    backgroundColor: "#123c35",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 28,
  },
  brand: { color: "#9adbc7", fontSize: 12, fontWeight: "800", letterSpacing: 1.6 },
  heroTitle: { color: "#fffdf8", fontSize: 32, fontWeight: "800", marginTop: 12 },
  heroSubtitle: { color: "#d5e7df", fontSize: 15, lineHeight: 22, marginTop: 6 },
  search: {
    backgroundColor: "#fffdf8",
    borderRadius: 14,
    color: "#183d35",
    fontSize: 15,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: { color: "#183d35", fontSize: 20, fontWeight: "800", marginHorizontal: 20, marginTop: 24, marginBottom: 12 },
  loader: { marginVertical: 22 },
  providerCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e7ece8",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 15,
  },
  avatar: { alignItems: "center", backgroundColor: "#dff2e9", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  avatarText: { color: "#176653", fontSize: 18, fontWeight: "800" },
  providerDetails: { flex: 1, marginLeft: 12 },
  providerName: { color: "#183d35", fontSize: 16, fontWeight: "800" },
  providerDescription: { color: "#61716b", fontSize: 13, lineHeight: 19, marginTop: 4 },
  metaRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", marginTop: 9 },
  rating: { color: "#9a6a12", fontSize: 12, fontWeight: "700" },
  metaText: { color: "#718079", fontSize: 11, marginLeft: 5 },
  chevron: { color: "#70847b", fontSize: 26, marginLeft: 8 },
  messageCard: { backgroundColor: "#ffffff", borderRadius: 16, marginHorizontal: 18, padding: 18 },
  emptyTitle: { color: "#183d35", fontSize: 15, fontWeight: "700" },
  mutedText: { color: "#61716b", fontSize: 14, marginTop: 6 },
  errorText: { color: "#9f3434", fontSize: 14, marginBottom: 10 },
  linkText: { color: "#08755f", fontSize: 14, fontWeight: "700" },
  footer: { height: 12 },
});
