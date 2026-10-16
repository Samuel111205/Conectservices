import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiRequest } from "@/lib/api";
import { unregisterPushNotifications } from "@/lib/push-notifications";
import {
  clearPushToken,
  clearTokens,
  readTokens,
  saveTokens,
  type SessionTokens,
} from "@/lib/session-store";

export type Account = { id: number; email: string; phone: string | null };
type SessionContextValue = {
  account: Account | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: React.PropsWithChildren) {
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAccount = useCallback(async () => {
    const current = await apiRequest<Account>("/auth/me/");
    setAccount(current);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        if (await readTokens()) {
          const current = await apiRequest<Account>("/auth/me/");
          if (mounted) setAccount(current);
        }
      } catch {
        await clearTokens();
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const tokens = await apiRequest<SessionTokens>("/auth/token/", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), password }),
    });
    await saveTokens(tokens);
    const current = await apiRequest<Account>("/auth/me/");
    setAccount(current);
  }, []);

  const signOut = useCallback(async () => {
    try {
      try {
        await unregisterPushNotifications();
      } catch {
        // A sign-out should still complete if push-token cleanup cannot reach the API.
      } finally {
        await clearPushToken();
      }
      const tokens = await readTokens();
      if (tokens) {
        await apiRequest<void>("/auth/logout/", {
          method: "POST",
          body: JSON.stringify({ refresh: tokens.refresh }),
        });
      }
    } finally {
      await clearTokens();
      setAccount(null);
    }
  }, []);

  const value = useMemo(
    () => ({ account, isLoading, signIn, signOut, refreshAccount }),
    [account, isLoading, signIn, signOut, refreshAccount],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession tem de ser usado dentro de SessionProvider.");
  return context;
}
