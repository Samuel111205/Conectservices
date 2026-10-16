import Constants from "expo-constants";
import { isRunningInExpoGo } from "expo";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiRequest } from "@/lib/api";
import { clearPushToken, readPushToken, savePushToken } from "@/lib/session-store";

export async function registerPushNotifications() {
  if (Platform.OS === "web") {
    throw new Error("As notificações push só estão disponíveis na app móvel.");
  }
  if (isRunningInExpoGo()) {
    throw new Error(
      "O Expo Go não recebe notificações push remotas. Instala uma development build da Conect Services para ativar esta opção.",
    );
  }
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (typeof projectId !== "string" || !projectId) {
    throw new Error(
      "Falta configurar o ID do projeto Expo. Define EXPO_PUBLIC_EAS_PROJECT_ID e cria uma development build.",
    );
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Mensagens",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0a7563",
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.status === "granted"
      ? existing
      : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Ativa as notificações nas definições do telemóvel para continuar.");
  }
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    throw new Error(
      "Não foi possível obter o token de notificações. Confirma as credenciais push da development build.",
    );
  }
  await apiRequest("/push-tokens/", {
    method: "POST",
    body: JSON.stringify({ token, platform: Platform.OS === "ios" ? "IOS" : "ANDROID" }),
  });
  await savePushToken(token);
  return token;
}

export async function unregisterPushNotifications() {
  const token = await readPushToken();
  if (!token) return;
  await apiRequest("/push-tokens/deactivate/", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  await clearPushToken();
}
