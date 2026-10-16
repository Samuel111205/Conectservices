import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Página não encontrada" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Não encontrámos esta página.</Text>
        <Text style={styles.description}>Volta à pesquisa para descobrires serviços disponíveis.</Text>
        <Link href="/" style={styles.link}>Voltar ao início</Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", backgroundColor: "#fffdf8", flex: 1, justifyContent: "center", padding: 24 },
  title: { color: "#183d35", fontSize: 21, fontWeight: "800", textAlign: "center" },
  description: { color: "#61716b", fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: "center" },
  link: { color: "#08755f", fontSize: 15, fontWeight: "800", marginTop: 20 },
});
