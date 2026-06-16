import dotenv from "dotenv";
import path from "path";
import { defineConfig } from "drizzle-kit";

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL missing");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
