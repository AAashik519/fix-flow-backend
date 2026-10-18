export function validateEnv(config: Record<string, unknown>) {
  const required = ['MONGODB_URI', 'JWT_SECRET'];
  for (const key of required) {
    if (!config[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  if (String(config.JWT_SECRET).length < 16) {
    throw new Error('JWT_SECRET must be at least 16 characters');
  }
  return config;
}
