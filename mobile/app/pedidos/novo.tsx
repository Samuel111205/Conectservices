import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, apiRequest } from "@/lib/api";
import { useSession } from "@/providers/SessionProvider";

type Option = { id: number; name: string };
type Page<T> = { results: T[] };

export default function NewOrderScreen() {
  const { account } = useSession();
  const [categories, setCategories] = useState<Option[]>([]);
  const [municipalities, setMunicipalities] = useState<Option[]>([]);
  const [category, setCategory] = useState<Option | null>(null);
  const [municipality, setMunicipality] = useState<Option | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void Promise.all([apiRequest<Page<Option>>("/categories/"), apiRequest<Page<Option>>("/municipalities/")]).then(([cats, places]) => { setCategories(cats.results ?? []); setMunicipalities(places.results ?? []); }).catch((reason) => setError(reason instanceof ApiError ? reason.message : "Não foi possível carregar as opções.")).finally(() => setLoading(false)); }, []);
  async function submit() {
    if (!account) { router.push("/entrar"); return; }
    if (!category || !municipality || !title.trim() || !description.trim()) { setError("Preenche o título, a descrição, a categoria e o município."); return; }
    setBusy(true); setError("");
    try { await apiRequest("/orders/", { method: "POST", body: JSON.stringify({ category: category.id, municipality: municipality.id, title: title.trim(), description: description.trim() }) }); Alert.alert("Pedido criado", "O pedido já está disponível para prestadores elegíveis.", [{ text: "Ver pedidos", onPress: () => router.replace("/pedidos" as Href) }]); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Não foi possível criar o pedido."); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>Pede um serviço</Text><Text style={styles.subtitle}>Partilha o que precisas para receber propostas.</Text>{loading ? <ActivityIndicator style={styles.loader} color="#0a7563" /> : <><Text style={styles.label}>Categoria</Text><View style={styles.options}>{categories.map((item) => <Pressable key={item.id} onPress={() => setCategory(item)} style={[styles.option, category?.id === item.id && styles.selected]}><Text style={[styles.optionText, category?.id === item.id && styles.selectedText]}>{item.name}</Text></Pressable>)}</View><Text style={styles.label}>Município</Text><View style={styles.options}>{municipalities.map((item) => <Pressable key={item.id} onPress={() => setMunicipality(item)} style={[styles.option, municipality?.id === item.id && styles.selected]}><Text style={[styles.optionText, municipality?.id === item.id && styles.selectedText]}>{item.name}</Text></Pressable>)}</View><Text style={styles.label}>Título</Text><TextInput maxLength={160} value={title} onChangeText={setTitle} placeholder="Ex.: Reparar canalização" style={styles.input} /><Text style={styles.label}>Descrição</Text><TextInput multiline maxLength={5000} value={description} onChangeText={setDescription} placeholder="Descreve o serviço e o que o prestador deve saber" style={[styles.input, styles.multiline]} /></>}{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Pressable disabled={loading || busy} onPress={() => void submit()} style={[styles.button, (loading || busy) && styles.disabled]}>{busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Publicar pedido</Text>}</Pressable></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { backgroundColor: "#fffdf8", flex: 1 }, content: { padding: 22, paddingBottom: 36 }, title: { color: "#183d35", fontSize: 28, fontWeight: "800" }, subtitle: { color: "#61716b", fontSize: 14, lineHeight: 21, marginTop: 6 }, label: { color: "#28493f", fontSize: 14, fontWeight: "700", marginTop: 20, marginBottom: 8 }, options: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, option: { backgroundColor: "white", borderColor: "#dce6df", borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 }, selected: { backgroundColor: "#0a7563", borderColor: "#0a7563" }, optionText: { color: "#28493f", fontSize: 13 }, selectedText: { color: "white", fontWeight: "700" }, input: { backgroundColor: "white", borderColor: "#dce6df", borderRadius: 12, borderWidth: 1, color: "#183d35", fontSize: 15, padding: 13 }, multiline: { minHeight: 120, textAlignVertical: "top" }, loader: { margin: 30 }, error: { color: "#a12f37", lineHeight: 20, marginTop: 15 }, button: { alignItems: "center", backgroundColor: "#0a7563", borderRadius: 13, marginTop: 24, paddingVertical: 15 }, buttonText: { color: "white", fontSize: 15, fontWeight: "800" }, disabled: { opacity: 0.55 } });
