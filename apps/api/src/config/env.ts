import dotenv from "dotenv";
dotenv.config();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "4000", 10),
  MONGO_URI: required("MONGO_URI"),
  DB_NAME: required("DB_NAME"),
  JWT_SECRET: required("JWT_SECRET"),
} as const;
