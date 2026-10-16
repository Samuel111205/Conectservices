import { Link, type Href } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, apiRequest } from "@/lib/api";

export default function RecoverAccountScreen() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setError(""); setMessage("");
    try { const result = await apiRequest<{ detail: string }>("/auth/password-reset/", { method: "POST", body: JSON.stringify({ email: email.trim() }) }); setMessage(result.detail); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Não foi possível processar o pedido."); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.safe}><View style={styles.content}><Text style={styles.eyebrow}>CONECT SERVICES</Text><Text style={styles.title}>Recuperar acesso</Text><Text style={styles.subtitle}>Se existir uma conta associada, enviaremos uma ligação para redefinir a palavra-passe.</Text><Text style={styles.label}>Email</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} placeholder="nome@exemplo.com" />{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}<Pressable disabled={busy || !email.trim()} onPress={() => void submit()} style={[styles.button, (busy || !email.trim()) && styles.disabled]}>{busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Enviar ligação</Text>}</Pressable><Link href={"/entrar" as Href} style={styles.link}>Voltar a entrar</Link></View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { backgroundColor: "#fffdf8", flex: 1 }, content: { padding: 24, paddingTop: 34 }, eyebrow: { color: "#0a7563", fontSize: 12, fontWeight: "800", letterSpacing: 1.4 }, title: { color: "#183d35", fontSize: 29, fontWeight: "800", marginTop: 10 }, subtitle: { color: "#61716b", fontSize: 14, lineHeight: 21, marginTop: 8 }, label: { color: "#28493f", fontSize: 14, fontWeight: "700", marginBottom: 8, marginTop: 22 }, input: { backgroundColor: "white", borderColor: "#dce6df", borderRadius: 13, borderWidth: 1, color: "#183d35", fontSize: 15, padding: 14 }, error: { color: "#a12f37", marginTop: 14 }, success: { backgroundColor: "#e6f4eb", borderRadius: 12, color: "#176653", lineHeight: 20, marginTop: 14, padding: 12 }, button: { alignItems: "center", backgroundColor: "#0a7563", borderRadius: 13, marginTop: 24, paddingVertical: 15 }, buttonText: { color: "white", fontWeight: "800" }, disabled: { opacity: 0.5 }, link: { alignSelf: "center", color: "#08755f", fontWeight: "700", marginTop: 20 } });
