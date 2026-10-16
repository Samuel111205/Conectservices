import { Link, router, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, apiRequest } from "@/lib/api";
import { useSession } from "@/providers/SessionProvider";

export default function SignInScreen() {
  const { signIn } = useSession();
  const params = useLocalSearchParams<{ "check-email"?: string; email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      router.replace("/(tabs)/conta");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Não foi possível iniciar sessão.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendVerification() {
    setResendMessage("");
    try {
      const response = await apiRequest<{ detail: string }>("/auth/verify-email/resend/", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setResendMessage(response.detail);
    } catch (reason) {
      setResendMessage(reason instanceof ApiError ? reason.message : "Tenta novamente mais tarde.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>BEM-VINDO DE VOLTA</Text>
        <Text style={styles.title}>Entra na tua conta</Text>
        <Text style={styles.subtitle}>Acede aos teus pedidos e conversas.</Text>
        {params["check-email"] === "1" ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>Se os dados forem válidos, enviámos uma ligação para confirmar o email. Confirma-o antes de iniciar sessão.</Text>
            <Pressable disabled={!email.trim()} onPress={() => void resendVerification()}><Text style={styles.resend}>Reenviar ligação</Text></Pressable>
            {resendMessage ? <Text accessibilityLiveRegion="polite" style={styles.successText}>{resendMessage}</Text> : null}
          </View>
        ) : null}
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="nome@exemplo.com"
          style={styles.input}
        />
        <Text style={styles.label}>Palavra-passe</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="current-password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => void submit()}
          placeholder="A tua palavra-passe"
          style={styles.input}
        />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting || !email.trim() || !password}
          onPress={() => void submit()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed, (isSubmitting || !email.trim() || !password) && styles.disabled]}
        >
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
        </Pressable>
        <Link href={"/recuperar-acesso" as Href} style={styles.link}>Esqueceste-te da palavra-passe?</Link>
        <View style={styles.footer}>
          <Text style={styles.subtitle}>Ainda não tens conta? </Text>
          <Link href="/registar" style={styles.link}>Criar conta</Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#fffdf8", flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 34 },
  eyebrow: { color: "#0a7563", fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "#183d35", fontSize: 29, fontWeight: "800", marginTop: 10 },
  subtitle: { color: "#61716b", fontSize: 14, lineHeight: 21, marginTop: 6 },
  label: { color: "#28493f", fontSize: 14, fontWeight: "700", marginTop: 22, marginBottom: 8 },
  input: { backgroundColor: "#ffffff", borderColor: "#dce6df", borderRadius: 13, borderWidth: 1, color: "#183d35", fontSize: 15, paddingHorizontal: 14, paddingVertical: 14 },
  error: { color: "#a12f37", fontSize: 14, lineHeight: 20, marginTop: 14 },
  successBox: { backgroundColor: "#e6f4eb", borderRadius: 12, marginTop: 16, padding: 12 },
  successText: { color: "#176653", fontSize: 14, lineHeight: 20 },
  resend: { color: "#08755f", fontSize: 13, fontWeight: "800", marginTop: 10 },
  button: { alignItems: "center", backgroundColor: "#0a7563", borderRadius: 13, marginTop: 24, paddingVertical: 15 },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  footer: { alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: 22 },
  link: { color: "#08755f", fontSize: 14, fontWeight: "800" },
});
