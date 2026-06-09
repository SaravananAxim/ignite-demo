#!/usr/bin/env node
/**
 * Sync auth email templates from supabase/auth-email-templates/*.html
 * to your hosted Supabase project via the Management API.
 *
 * Requires:
 *   SUPABASE_ACCESS_TOKEN - from https://supabase.com/dashboard/account/tokens
 *   PROJECT_REF           - your project ref (e.g. yghkpvxrxxbiqmrknmxf) or set in supabase/config.toml
 *
 * Run: SUPABASE_ACCESS_TOKEN=xxx PROJECT_REF=yyy node scripts/sync-auth-email-templates.mjs
 * Or:  npm run sync-email-templates  (after setting env in .env or shell)
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TEMPLATES_DIR = join(ROOT, "supabase", "auth-email-templates");

const AUTH_TEMPLATES = [
  {
    key: "confirmation",
    file: "confirm-signup.html",
    subject: "Confirm your email – Ignite Franchise Portal",
  },
  {
    key: "invite",
    file: "invite.html",
    subject: "You're invited – Ignite Franchise Portal",
  },
  {
    key: "recovery",
    file: "recovery.html",
    subject: "Reset your password – Ignite Franchise Portal",
  },
  {
    key: "magic_link",
    file: "magic-link.html",
    subject: "Your sign-in link – Ignite Franchise Portal",
  },
  {
    key: "email_change",
    file: "email-change.html",
    subject: "Confirm email change – Ignite Franchise Portal",
  },
  {
    key: "reauthentication",
    file: "reauthentication.html",
    subject: "Your verification code – Ignite Franchise Portal",
  },
];

const NOTIFICATION_TEMPLATES = [
  {
    key: "password_changed_notification",
    file: "password-changed.html",
    subject: "Your password was changed – Ignite Franchise Portal",
    enabledKey: "mailer_notifications_password_changed_enabled",
  },
  {
    key: "email_changed_notification",
    file: "email-changed.html",
    subject: "Your email was changed – Ignite Franchise Portal",
    enabledKey: "mailer_notifications_email_changed_enabled",
  },
];

function loadHtml(name) {
  const path = join(TEMPLATES_DIR, name);
  if (!existsSync(path)) {
    throw new Error(`Template file not found: ${path}`);
  }
  return readFileSync(path, "utf8");
}

function getProjectRef() {
  const ref = process.env.PROJECT_REF;
  if (ref) return ref;
  const configPath = join(ROOT, "supabase", "config.toml");
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, "utf8");
    const m = content.match(/project_id\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  }
  return null;
}

async function main() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = getProjectRef();

  if (!accessToken) {
    console.error("Missing SUPABASE_ACCESS_TOKEN. Get one at: https://supabase.com/dashboard/account/tokens");
    process.exit(1);
  }
  if (!projectRef) {
    console.error("Missing PROJECT_REF. Set env PROJECT_REF or add project_id in supabase/config.toml");
    process.exit(1);
  }

  const body = {};

  for (const t of AUTH_TEMPLATES) {
    const html = loadHtml(t.file);
    body[`mailer_subjects_${t.key}`] = t.subject;
    body[`mailer_templates_${t.key}_content`] = html;
  }

  for (const t of NOTIFICATION_TEMPLATES) {
    const html = loadHtml(t.file);
    body[`mailer_subjects_${t.key}`] = t.subject;
    body[`mailer_templates_${t.key}_content`] = html;
    body[t.enabledKey] = true;
  }

  const url = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Management API error:", res.status, text);
    if (res.status === 403) {
      console.error("\n403 means your token's account is not allowed to update auth config.");
      console.error("You need Supabase platform Owner or Administrator (not app admin).");
      console.error("See: https://supabase.com/docs/guides/platform/access-control");
      console.error("\nAlternative: paste each HTML file into Dashboard → Authentication → Email Templates.");
    }
    process.exit(1);
  }

  console.log("Auth email templates synced successfully to project", projectRef);
  console.log("Updated: confirmation, invite, recovery, magic_link, email_change, reauthentication, password_changed, email_changed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
