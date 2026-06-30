import sgMail from "@sendgrid/mail";
import { config, emailMockMode } from "../config.js";

if (!emailMockMode) {
  sgMail.setApiKey(config.sendgrid.apiKey);
}

/**
 * Send a single email. Returns { messageId, mock }.
 * In mock mode (no SENDGRID_API_KEY) it logs and returns a synthetic id so the
 * whole app — campaigns, sequences, analytics — works end to end for a demo.
 */
export async function sendEmail({ to, subject, html, customArgs = {} }) {
  if (emailMockMode) {
    const messageId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[email:mock] -> ${to} | ${subject} | id=${messageId}`);
    return { messageId, mock: true };
  }

  const [response] = await sgMail.send({
    to,
    from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
    subject,
    html,
    customArgs,
    trackingSettings: {
      clickTracking: { enable: true, enableText: false },
      openTracking: { enable: true },
    },
  });

  const messageId =
    response?.headers?.["x-message-id"] || `sg-${Date.now()}`;
  return { messageId, mock: false };
}
