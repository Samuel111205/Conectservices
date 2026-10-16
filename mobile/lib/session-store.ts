import * as SecureStore from "expo-secure-store";

export type SessionTokens = { access: string; refresh: string };

const ACCESS_KEY = "conect_access";
const REFRESH_KEY = "conect_refresh";
const PUSH_TOKEN_KEY = "conect_push_token";

export async function readPushToken() {
  return SecureStore.getItemAsync(PUSH_TOKEN_KEY);
}

export async function savePushToken(token: string) {
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
}

export async function clearPushToken() {
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}

export async function readTokens(): Promise<SessionTokens | null> {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  return access && refresh ? { access, refresh } : null;
}

export async function saveTokens(tokens: SessionTokens) {
  try {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, tokens.access),
      SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh),
    ]);
  } catch (error) {
    await clearTokens();
    throw error;
  }
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}
