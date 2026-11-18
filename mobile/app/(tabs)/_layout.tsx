import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerTintColor: "#123B72",
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: "#2563EB",
        tabBarStyle: { backgroundColor: "#FFFFFF" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Explorar", tabBarLabel: "Explorar" }} />
      <Tabs.Screen name="pedidos" options={{ title: "Os meus pedidos", tabBarLabel: "Pedidos" }} />
      <Tabs.Screen name="casos" options={{ title: "Disputas e reembolsos", tabBarLabel: "Apoio" }} />
      <Tabs.Screen name="conta" options={{ title: "A minha conta", tabBarLabel: "Conta" }} />
    </Tabs>
  );
}
