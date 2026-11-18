import { Stack, useRouter, type Href } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";

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
      <NotificationRouteHandler />
      <Stack screenOptions={{ headerTintColor: "#123B72" }}>
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

function NotificationRouteHandler() {
  const router = useRouter();

  useEffect(() => {
    const listener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      if (typeof data.disputeId === "number" || typeof data.refundRequestId === "number") {
        router.push({
          pathname: "/(tabs)/casos",
          params: {
            ...(typeof data.disputeId === "number" ? { disputa: String(data.disputeId) } : {}),
            ...(typeof data.refundRequestId === "number" ? { reembolso: String(data.refundRequestId) } : {}),
          },
        } as unknown as Href);
      } else if (typeof data.conversationId === "number") {
        router.push("/(tabs)/conta");
      }
    });
    return () => listener.remove();
  }, [router]);

  return null;
}
