import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#fffdf8" },
        headerTintColor: "#123c35",
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: "#0a7563",
        tabBarStyle: { backgroundColor: "#fffdf8" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Explorar", tabBarLabel: "Explorar" }} />
      <Tabs.Screen name="pedidos" options={{ title: "Os meus pedidos", tabBarLabel: "Pedidos" }} />
      <Tabs.Screen name="conta" options={{ title: "A minha conta", tabBarLabel: "Conta" }} />
    </Tabs>
  );
}
