export const configuration = () => ({
  app: {
    port: parseInt(process.env.BACKEND_PORT ?? '3001', 10),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  },
  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
});
