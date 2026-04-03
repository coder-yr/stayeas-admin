import "dotenv/config";

const getEnv = (key: string, required = true): string => {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Environment variable ${key} is required but missing`);
  }
  return value || "";
};

export const env = {
  NODE_ENV: getEnv("NODE_ENV", false) || "development",
  PORT: parseInt(getEnv("PORT", false) || "4001", 10),
  DATABASE_URL: getEnv("DATABASE_URL"),
  ADMIN_COOKIE_SECRET: getEnv("ADMIN_COOKIE_SECRET"),
  ADMIN_SESSION_SECRET: getEnv("ADMIN_SESSION_SECRET"),
  ADMIN_DEFAULT_EMAIL: getEnv("ADMIN_DEFAULT_EMAIL", false) || "admin@stayease.com",
  ADMIN_DEFAULT_PASSWORD: getEnv("ADMIN_DEFAULT_PASSWORD", false) || "StayEase@2026",
};
