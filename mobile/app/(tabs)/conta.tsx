import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  registerPushNotifications,
  unregisterPushNotifications,
} from "@/lib/push-notifications";
import { readPushToken } from "@/lib/session-store";
import { useSession } from "@/providers/SessionProvider";

export default function AccountScreen() {
  const { account, isLoading, signOut } = useSession();
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    void readPushToken().then((token) => {
      if (mounted) setPushEnabled(Boolean(token));
    });
    return () => {
      mounted = false;
    };
  }, [account?.id]);

  async function handleEnablePush() {
    setIsEnablingPush(true);
    try {
      await registerPushNotifications();
      setPushEnabled(true);
      Alert.alert("Notificações ativadas", "Vamos avisar-te quando receberes uma mensagem.");
    } catch (reason) {
      Alert.alert(
        "Não foi possível ativar",
        reason instanceof Error ? reason.message : "Tenta novamente mais tarde.",
      );
    } finally {
      setIsEnablingPush(false);
    }
  }

  async function handleDisablePush() {
    setIsEnablingPush(true);
    try {
      await unregisterPushNotifications();
      setPushEnabled(false);
      Alert.alert("Notificações desativadas", "Deixaste de receber avisos neste dispositivo.");
    } catch (reason) {
      Alert.alert(
        "Não foi possível desativar",
        reason instanceof Error ? reason.message : "Tenta novamente mais tarde.",
      );
    } finally {
      setIsEnablingPush(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      Alert.alert("Sessão terminada", "Não foi possível contactar a API para revogar a sessão.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>CONECT SERVICES</Text>
        <Text style={styles.title}>A tua conta</Text>
        {isLoading ? (
          <Text style={styles.muted}>A carregar a sessão…</Text>
        ) : account ? (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{account.email.slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text style={styles.email}>{account.email}</Text>
            {account.phone ? <Text style={styles.muted}>{account.phone}</Text> : null}
            <Text style={styles.note}>
              Acompanha os pedidos no separador Pedidos e gere aqui as definições da tua conta.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={isEnablingPush}
              onPress={() => void (pushEnabled ? handleDisablePush() : handleEnablePush())}
              style={[styles.secondaryButton, isEnablingPush && styles.disabled]}
            >
              <Text style={styles.secondaryButtonText}>
                {isEnablingPush
                  ? "A ativar…"
                  : pushEnabled
                    ? "Desativar notificações"
                    : "Ativar notificações"}
              </Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => void handleSignOut()}>
              <Text style={styles.secondaryButtonText}>Terminar sessão</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Entra para acompanhar os teus serviços.</Text>
            <Text style={styles.muted}>
              Guarda os teus prestadores favoritos e gere os teus pedidos num só lugar.
            </Text>
            <Link href="/entrar" asChild>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Entrar</Text>
              </Pressable>
            </Link>
            <Link href="/registar" asChild>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Criar conta</Text>
              </Pressable>
            </Link>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#fffdf8", flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 28 },
  eyebrow: { color: "#0a7563", fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "#183d35", fontSize: 30, fontWeight: "800", marginTop: 8, marginBottom: 22 },
  card: { backgroundColor: "#ffffff", borderColor: "#e7ece8", borderRadius: 20, borderWidth: 1, padding: 20 },
  avatar: { alignItems: "center", backgroundColor: "#dff2e9", borderRadius: 28, height: 56, justifyContent: "center", width: 56 },
  avatarText: { color: "#176653", fontSize: 22, fontWeight: "800" },
  email: { color: "#183d35", fontSize: 17, fontWeight: "700", marginTop: 14 },
  cardTitle: { color: "#183d35", fontSize: 18, fontWeight: "800" },
  muted: { color: "#61716b", fontSize: 14, lineHeight: 21, marginTop: 6 },
  note: { backgroundColor: "#f1f7f3", borderRadius: 12, color: "#49665a", fontSize: 13, lineHeight: 19, marginTop: 18, padding: 12 },
  primaryButton: { alignItems: "center", backgroundColor: "#0a7563", borderRadius: 13, marginTop: 22, paddingVertical: 14 },
  primaryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  secondaryButton: { alignItems: "center", borderColor: "#dbe5df", borderRadius: 13, borderWidth: 1, marginTop: 12, paddingVertical: 13 },
  secondaryButtonText: { color: "#176653", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.55 },
});
