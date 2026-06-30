import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  port: process.env.PORT || 4000,
  env: process.env.NODE_ENV || "development",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/reltor",
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || "",
    fromEmail: process.env.SENDGRID_FROM_EMAIL || "hello@yourbrokerage.com",
    fromName: process.env.SENDGRID_FROM_NAME || "Your Brokerage",
  },
  meta: {
    graphVersion: process.env.META_GRAPH_VERSION || "v19.0",
    facebookPageId: process.env.FACEBOOK_PAGE_ID || "",
    facebookPageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "",
    instagramBusinessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "",
  },
};

export const emailMockMode = !config.sendgrid.apiKey;
export const socialMockMode = !config.meta.facebookPageAccessToken;
