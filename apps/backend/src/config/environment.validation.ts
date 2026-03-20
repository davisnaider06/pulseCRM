const requiredVariables = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

export function validateEnvironment(config: Record<string, unknown>) {
  for (const key of requiredVariables) {
    if (!config[key]) {
      throw new Error(`Environment variable ${key} is required.`);
    }
  }

  return config;
}
