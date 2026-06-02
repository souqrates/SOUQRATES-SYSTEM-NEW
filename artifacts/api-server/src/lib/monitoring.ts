import * as Sentry from "@sentry/node";
import { logger } from "./logger";

let sentryInitialized = false;

export function initSentry(dsn: string | null | undefined) {
  if (!dsn) return;
  if (sentryInitialized) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env["NODE_ENV"] ?? "production",
  });

  sentryInitialized = true;
  logger.info("Sentry initialized");
}

export function captureException(err: unknown) {
  if (sentryInitialized) {
    Sentry.captureException(err);
  }
}

export async function testSentry(dsn: string): Promise<{ ok: boolean; message: string }> {
  try {
    // Validate DSN format
    const url = new URL(dsn);
    if (!url.hostname.includes("sentry.io") && !url.hostname.includes("ingest.sentry.io")) {
      return { ok: false, message: "Invalid Sentry DSN — hostname must be sentry.io" };
    }
    // Make a request to the Sentry envelope endpoint to verify the DSN is reachable
    const parts = dsn.match(/https:\/\/([^@]+)@([^/]+)\/(\d+)/);
    if (!parts) return { ok: false, message: "Cannot parse Sentry DSN format" };
    const [, key, host, projectId] = parts;
    const envelopeUrl = `https://${host}/api/${projectId}/envelope/`;
    const envelope = `{"event_id":"test","sent_at":"${new Date().toISOString()}","sdk":{"name":"test","version":"0.0.1"}}\n{"type":"event"}\n{"message":"Souqrates DSN test","level":"info"}`;
    const resp = await fetch(envelopeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${key}` },
      body: envelope,
    });
    if (resp.ok || resp.status === 200) {
      return { ok: true, message: "Sentry DSN verified — connection successful" };
    }
    return { ok: false, message: `Sentry returned ${resp.status}: ${await resp.text()}` };
  } catch (err) {
    return { ok: false, message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
