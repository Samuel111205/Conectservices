import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";

import { SessionProvider } from "@/providers/SessionProvider";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  return (
    <SessionProvider>
      <Stack screenOptions={{ headerTintColor: "#123c35" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="entrar" options={{ title: "Entrar" }} />
        <Stack.Screen name="registar" options={{ title: "Criar conta" }} />
        <Stack.Screen name="recuperar-acesso" options={{ title: "Recuperar acesso" }} />
        <Stack.Screen name="pedidos/novo" options={{ title: "Novo pedido" }} />
        <Stack.Screen
          name="prestador/[id]"
          options={{ title: "Prestador", headerBackTitle: "Voltar" }}
        />
      </Stack>
    </SessionProvider>
  );
}
