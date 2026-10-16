import { Link, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, apiRequest } from "@/lib/api";
import { useSession } from "@/providers/SessionProvider";

type ServiceOrder = {
  id: number;
  title: string;
  description: string;
  status: string;
  municipality_name: string;
  province_name: string;
  created_at: string;
};
type Page<T> = { results: T[] };

const statusLabels: Record<string, string> = {
  OPEN: "Aberto",
  NEGOTIATING: "Em negociação",
  AWARDED: "Contratado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

export default function OrdersScreen() {
  const { account } = useSession();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!account) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const page = await apiRequest<Page<ServiceOrder>>("/orders/");
      setOrders(page.results ?? []);
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Não foi possível carregar os pedidos.",
      );
    } finally {
      setLoading(false);
    }
  }, [account]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function cancel(id: number) {
    try {
      await apiRequest(`/orders/${id}/cancel/`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load();
    } catch (reason) {
      Alert.alert(
        "Não foi possível cancelar",
        reason instanceof Error ? reason.message : "Tenta novamente.",
      );
    }
  }

  function askToCancel(id: number) {
    Alert.alert("Cancelar pedido", "Queres cancelar este pedido?", [
      { text: "Manter", style: "cancel" },
      {
        text: "Cancelar pedido",
        style: "destructive",
        onPress: () => void cancel(id),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor="#0a7563"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>CONECT SERVICES</Text>
            <Text style={styles.title}>Os meus pedidos</Text>
            <Text style={styles.subtitle}>
              Acompanha os pedidos e as respostas dos prestadores.
            </Text>
            {account ? (
              <Link href={"/pedidos/novo" as Href} asChild>
                <Pressable style={styles.primary}>
                  <Text style={styles.primaryText}>Criar pedido</Text>
                </Pressable>
              </Link>
            ) : (
              <Link href="/entrar" style={styles.link}>
                Inicia sessão para veres os teus pedidos
              </Link>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loader} color="#0a7563" />
          ) : error ? (
            <View style={styles.card}>
              <Text style={styles.error}>{error}</Text>
              <Pressable onPress={() => void load()}>
                <Text style={styles.link}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : account ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ainda não tens pedidos.</Text>
              <Text style={styles.subtitle}>
                Cria um pedido para receber propostas de prestadores.
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Entra na tua conta para acompanhar pedidos.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.badge}>
                {statusLabels[item.status] ?? item.status}
              </Text>
            </View>
            <Text style={styles.location}>
              {item.municipality_name}, {item.province_name}
            </Text>
            <Text style={styles.description} numberOfLines={3}>
              {item.description}
            </Text>
            {["OPEN", "NEGOTIATING"].includes(item.status) && (
              <Pressable onPress={() => askToCancel(item.id)}>
                <Text style={styles.cancel}>Cancelar pedido</Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fffdf8" },
  content: { padding: 18, paddingBottom: 30 },
  header: { paddingVertical: 18 },
  eyebrow: {
    color: "#0a7563",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: { color: "#183d35", fontSize: 29, fontWeight: "800", marginTop: 8 },
  subtitle: { color: "#61716b", fontSize: 14, lineHeight: 21, marginTop: 6 },
  primary: {
    alignSelf: "flex-start",
    backgroundColor: "#0a7563",
    borderRadius: 12,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryText: { color: "white", fontWeight: "800" },
  card: {
    backgroundColor: "white",
    borderColor: "#e2e9e3",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  row: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  cardTitle: { color: "#183d35", flex: 1, fontSize: 16, fontWeight: "800" },
  badge: {
    backgroundColor: "#e5f3ed",
    borderRadius: 8,
    color: "#176653",
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  location: { color: "#61716b", fontSize: 12, marginTop: 8 },
  description: { color: "#28493f", fontSize: 14, lineHeight: 20, marginTop: 10 },
  cancel: { color: "#a12f37", fontSize: 13, fontWeight: "700", marginTop: 14 },
  loader: { margin: 30 },
  error: { color: "#a12f37", marginBottom: 10 },
  link: { color: "#08755f", fontWeight: "700", marginTop: 14 },
});
