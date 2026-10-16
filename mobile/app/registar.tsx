import { Link, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiRequest, ApiError } from "@/lib/api";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await apiRequest<{ detail: string }>("/auth/register/", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), phone: phone.trim() || null, password }),
      });
      router.replace({ pathname: "/entrar", params: { "check-email": "1", email: email.trim() } });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Não foi possível criar a conta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>CONECT SERVICES</Text>
        <Text style={styles.title}>Cria a tua conta</Text>
        <Text style={styles.subtitle}>Começa a encontrar serviços e profissionais.</Text>
        <Text style={styles.label}>Email</Text>
        <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="nome@exemplo.com" style={styles.input} />
        <Text style={styles.label}>Telefone <Text style={styles.optional}>(opcional)</Text></Text>
        <TextInput autoComplete="tel" keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="+244 9XX XXX XXX" style={styles.input} />
        <Text style={styles.label}>Palavra-passe</Text>
        <TextInput autoCapitalize="none" autoComplete="new-password" secureTextEntry value={password} onChangeText={setPassword} placeholder="Cria uma palavra-passe segura" style={styles.input} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={isSubmitting || !email.trim() || !password} onPress={() => void submit()} style={({ pressed }) => [styles.button, pressed && styles.pressed, (isSubmitting || !email.trim() || !password) && styles.disabled]}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Criar conta</Text>}
        </Pressable>
        <View style={styles.footer}>
          <Text style={styles.subtitle}>Já tens conta? </Text>
          <Link href="/entrar" style={styles.link}>Entrar</Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#fffdf8", flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 30 },
  eyebrow: { color: "#0a7563", fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "#183d35", fontSize: 29, fontWeight: "800", marginTop: 10 },
  subtitle: { color: "#61716b", fontSize: 14, lineHeight: 21, marginTop: 6 },
  label: { color: "#28493f", fontSize: 14, fontWeight: "700", marginTop: 20, marginBottom: 8 },
  optional: { color: "#718079", fontSize: 12, fontWeight: "400" },
  input: { backgroundColor: "#ffffff", borderColor: "#dce6df", borderRadius: 13, borderWidth: 1, color: "#183d35", fontSize: 15, paddingHorizontal: 14, paddingVertical: 14 },
  error: { color: "#a12f37", fontSize: 14, lineHeight: 20, marginTop: 14 },
  button: { alignItems: "center", backgroundColor: "#0a7563", borderRadius: 13, marginTop: 24, paddingVertical: 15 },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  footer: { alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: 22 },
  link: { color: "#08755f", fontSize: 14, fontWeight: "800" },
});
