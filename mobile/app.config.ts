import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const baseConfig = config as ExpoConfig;

  return {
    ...baseConfig,
    extra: {
      ...baseConfig.extra,
      ...(projectId
        ? { eas: { ...baseConfig.extra?.eas, projectId } }
        : {}),
    },
  };
};
