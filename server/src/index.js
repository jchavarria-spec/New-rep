import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config, emailMockMode, socialMockMode } from "./config.js";
import { startScheduler } from "./services/scheduler.js";

import authRoutes from "./routes/auth.js";
import contactRoutes from "./routes/contacts.js";
import templateRoutes from "./routes/templates.js";
import campaignRoutes from "./routes/campaigns.js";
import socialRoutes from "./routes/social.js";
import sequenceRoutes from "./routes/sequences.js";
import analyticsRoutes from "./routes/analytics.js";
import webhookRoutes from "./routes/webhooks.js";
import { notFound, errorHandler } from "./middleware/error.js";

const app = express();

app.use(cors({ origin: config.clientUrl === "*" ? true : [config.clientUrl, "http://localhost:5173"] }));
app.use(express.json({ limit: "2mb" }));
if (config.env !== "test") app.use(morgan("dev"));

app.get("/api/health", (req, res) =>
  res.json({
    ok: true,
    env: config.env,
    emailMockMode,
    socialMockMode,
    time: new Date().toISOString(),
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/sequences", sequenceRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/webhooks", webhookRoutes);

app.use("/api", notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`\n🏡 Reltor API running on http://localhost:${config.port}`);
  console.log(`   email: ${emailMockMode ? "MOCK (set SENDGRID_API_KEY to send live)" : "SendGrid live"}`);
  console.log(`   social: ${socialMockMode ? "MOCK (set META tokens to post live)" : "Meta Graph live"}`);
  startScheduler();
});
