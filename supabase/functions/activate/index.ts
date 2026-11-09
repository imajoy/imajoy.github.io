// Wrapline Pro (the paid toolkit): checks a Premium access code or a Basic email and, if it is allowed, returns a
// short-lived download link for the latest package. Also handles {"action": "deactivate"} when a computer uninstalls.
//
// Premium: "code" is a license key (stored only as a hash in the licenses table).
// Basic:   "code" is the email the customer registered on the website. The website's Google Sheet (Apps Script,
//          action "maya_access", signed with COMMERCE_SECRET) says whether that email has a running Basic trial or
//          subscription. A licenses row (label "basic:<email>", mode online) keeps the computer limit (= licenses
//          bought) and the last known end date, so a short Sheet outage never takes the tools away early.
// Messages use "[word](https://...)": Setup shows the word as a clickable link, Maya shows the word plain.
//
// Deploy:  supabase functions deploy activate --no-verify-jwt
// Secrets: CODE_PEPPER, COMMERCE_SECRET and SHEET_WEB_APP_URL (the last two are shared with the commerce function).
// --no-verify-jwt is intentional: this function does its own authentication.
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "releases";
const LINK_SECONDS = 900;  // long enough for a slow download to resume after a dropped connection
const MAX_FAILURES = 8;          // failed codes allowed per IP ...
const WINDOW_MINUTES = 10;       // ... within this many minutes
const SHEET_TIMEOUT_MS = 20000;  // how long to wait for the website's Sheet (Apps Script)
const SITE = "https://imajoy.github.io/";
const PRICING = "https://imajoy.github.io/wrapline.html#pricing";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

// Same normalisation as admin/manage_codes.py: upper-case letters and digits only.
const normalise = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(secret: string, text: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}
const codeHash = (code: string, pepper: string) => hmac(pepper, code);

const clip = (value: unknown, max: number) =>
  typeof value === "string" ? value.slice(0, max) : "";

// Which build fits the caller's Maya: the Python version it reports (cp39, cp310, cp311),
// or, for older installers that do not send it, the Maya version.
function pythonTag(python: string, maya: string): string {
  if (/^cp3\d{1,2}$/.test(python)) return python;
  const year = parseInt((maya.match(/20\d\d/) ?? ["0"])[0], 10);
  if (year >= 2025) return "cp311";
  if (year === 2024) return "cp310";
  if (year === 2023) return "cp39";
  return "";
}

// The public address the request came from, as seen by the server. The guess limit above is counted per address, so the
// address must be one a caller cannot invent: the edge network's own header, or the LAST entry of the forwarding chain
// (added by the nearest trusted proxy). The FIRST entry is written by the caller and could be changed on every try.
const clientIp = (req: Request) => {
  const edge = (req.headers.get("cf-connecting-ip") ?? "").trim();
  if (edge) return edge.slice(0, 64);
  const chain = (req.headers.get("x-forwarded-for") ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  return (chain[chain.length - 1] ?? "unknown").slice(0, 64);
};

// Ask the website's Sheet about a Basic email. Returns its answer, or null when it could not be asked.
async function sheetAccess(email: string): Promise<Record<string, unknown> | null> {
  const secret = Deno.env.get("COMMERCE_SECRET") ?? "", script = Deno.env.get("SHEET_WEB_APP_URL") ?? "";
  if (secret.length < 32 || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(script)) return null;
  const packed = JSON.stringify({ action: "maya_access", email });
  const timestamp = String(Date.now()), nonce = crypto.randomUUID();
  const signature = await hmac(secret, timestamp + "." + nonce + "." + packed);
  try {
    const response = await fetch(script, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ type: "commerce", payload: packed, timestamp, nonce, signature }),
      signal: AbortSignal.timeout(SHEET_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const answer = await response.json();
    return answer && answer.ok === true ? answer : null;
  } catch {
    return null;
  }
}

function endedMessage(reason: string, premium: boolean): string {
  if (reason === "trial_ended") {
    return "Your 4-day Wrapline Pro free trial has ended. To keep using Wrapline Pro, [choose a Basic plan](" + PRICING + ").";
  }
  if (reason === "subscription_ended") {
    return "Your Wrapline Pro Basic subscription has ended. [Renew it](" + PRICING + ") to keep using Wrapline Pro.";
  }
  if (premium) {
    return "This email has a Wrapline Pro Premium plan. Premium uses a license key: choose Premium in Setup and " +
      "enter the key you received.";
  }
  return "This email has no Wrapline Pro Basic plan yet. [Start your 4-day free trial](" + PRICING + "), then click Install again.";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  const pepper = Deno.env.get("CODE_PEPPER");
  if (!pepper) return reply(500, { error: "Server is not configured" });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return reply(400, { error: "Invalid request" });
  }

  const deactivating = input.action === "deactivate";
  // Spaces, line breaks and invisible characters (copied from an email or chat) are never part of a code or email.
  const raw = clip(input.code, 200).replace(/[\s\u200b-\u200d\u2060\ufeff]/g, "").slice(0, 160);
  const isEmail = raw.includes("@");
  const email = isEmail ? raw.toLowerCase() : "";
  const code = isEmail ? "" : normalise(raw.slice(0, 64));
  const machineId = clip(input.machine_id, 128);
  if (!machineId || (isEmail ? (email.length > 120 || !EMAIL.test(email)) : code.length < 8)) {
    return reply(400, {
      error: isEmail ? "Enter the email address you registered on the Wrapline website." : "Invalid request",
    });
  }

  // ---- slow down guessing ------------------------------------------------------------------
  const ip = clientIp(req);
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await db.from("auth_attempts")
    .select("id", { count: "exact", head: true }).eq("ip", ip).gte("at", since);
  if ((count ?? 0) >= MAX_FAILURES) {
    return reply(429, { error: "Too many attempts. Try again in a few minutes." });
  }

  const noteFailure = async () => {
    await db.from("auth_attempts").insert({ ip });
    // Housekeeping: forget attempts older than a day.
    if (Math.random() < 0.05) {
      await db.from("auth_attempts").delete()
        .lt("at", new Date(Date.now() - 86_400_000).toISOString());
    }
  };
  const fail = async () => {
    await noteFailure();
    // One message for every kind of rejection, so a guesser learns nothing.
    return reply(401, { error: "That access code is not valid." });
  };

  const hash = await codeHash(isEmail ? "BASIC:" + email : code, pepper);

  // ---- uninstall: close this computer's record ----------------------------------------------
  if (deactivating) {
    const { data: known } = await db.from("licenses").select("id").eq("code_hash", hash).maybeSingle();
    if (!known) return isEmail ? reply(200, { ok: true }) : await fail();
    const { error: deactError } = await db.rpc("deactivate_device", { p_license: known.id, p_machine: machineId });
    if (deactError) return reply(500, { error: "Server error. Please try again." });
    return reply(200, { ok: true });
  }

  let license: { id: string; active: boolean; expires_at: string | null; mode: string | null; max_devices?: number } | null = null;
  let extra: Record<string, unknown> = {};

  if (isEmail) {
    // ---- Basic: ask the website's Sheet ----------------------------------------------------
    const { data: saved, error: savedError } = await db.from("licenses")
      .select("id, active, expires_at, mode, max_devices").eq("code_hash", hash).maybeSingle();
    if (savedError) return reply(500, { error: "Server error. Please try again." });
    const answer = await sheetAccess(email);
    if (!answer) {
      // The Sheet could not be asked. Never take the tools away for that: a computer that was allowed before
      // keeps working until its last known end date; anyone else is asked to try again.
      if (saved && saved.active && saved.expires_at && new Date(saved.expires_at).getTime() > Date.now()) {
        license = saved;
        extra = { plan: "basic", ends_at: saved.expires_at, checked: "cached" };
      } else {
        return reply(503, { error: "Your Wrapline Pro subscription could not be checked right now. Please try again in a few minutes." });
      }
    } else if (answer.registered !== true && saved && saved.active && saved.expires_at &&
               new Date(saved.expires_at).getTime() > Date.now()) {
      // The website said "not registered" for an email that had a running plan on its last check. That is a
      // website glitch (for example a Sheet being edited), not an ended plan: keep it working on the saved answer.
      license = saved;
      extra = { plan: "basic", ends_at: saved.expires_at, checked: "cached" };
    } else if (answer.registered !== true) {
      await noteFailure();
      return reply(404, {
        // "#register=<email>" opens the website's Register / Login window with this email filled in.
        error: "This email is not registered yet. [Register](" + SITE + "#register=" + encodeURIComponent(email).replace(/[()]/g, escape) +
          ") for free on the Wrapline website with this email, then click Install again.",
        reason: "not_registered", link: SITE + "#register",
      });
    } else if (answer.entitled !== true) {
      const reason = String(answer.reason || "no_plan");
      if (saved) await db.from("licenses").update({ active: false, expires_at: new Date().toISOString() }).eq("id", saved.id);
      return reply(403, { error: endedMessage(reason, answer.premium === true), reason, link: PRICING });
    } else if (saved && !saved.active && saved.expires_at && new Date(saved.expires_at).getTime() > Date.now()) {
      // Blocked by the owner (Wrapline.bat > Access codes > block): a plan that ended is stored with a past date.
      return reply(403, { error: "This Wrapline Pro Basic sign-in has been blocked. Please contact support.", reason: "blocked" });
    } else {
      const seats = Math.min(Math.max(Number(answer.seats) || 1, 1), 100);
      // Known end of access (+1 day), used only when the Sheet cannot be reached later.
      const ends = Date.parse(String(answer.endsAt || ""));
      const expires = new Date((Number.isFinite(ends) ? ends : Date.now() + 3 * 86_400_000) + 86_400_000).toISOString();
      const row = { label: "basic:" + email, code_hash: hash, mode: "online", max_devices: seats, active: true, expires_at: expires };
      const { data: upserted, error: upsertError } = await db.from("licenses")
        .upsert(row, { onConflict: "code_hash" }).select("id, active, expires_at, mode, max_devices").single();
      if (upsertError || !upserted) return reply(500, { error: "Server error. Please try again." });
      license = upserted;
      extra = { plan: "basic", trial: answer.trial === true, ends_at: String(answer.endsAt || ""), renews: answer.renews === true };
    }
  } else {
    // ---- Premium: check the license key ----------------------------------------------------
    const { data: found, error: licenseError } = await db.from("licenses")
      .select("id, active, expires_at, mode").eq("code_hash", hash).maybeSingle();
    // A database problem must never look like a wrong code: installed tools treat a rejected code as revoked.
    if (licenseError) return reply(500, { error: "Server error. Please try again." });
    if (!found) return await fail();
    if (!found.active) return await fail();
    if (found.expires_at && new Date(found.expires_at).getTime() < Date.now()) return await fail();
    license = found;
  }

  if (!license) return reply(500, { error: "Server error. Please try again." });

  // ---- device limit and who is using it ----------------------------------------------------
  const { data: registered, error: regError } = await db.rpc("register_device", {
    p_license: license.id,
    p_machine: machineId,
    p_name: clip(input.machine_name, 128),
    p_maya: clip(input.maya_version, 64),
    p_user: clip(input.username, 128),
    p_local_ip: clip(input.local_ip, 64),
    p_ip: ip,
  });
  if (regError) return reply(500, { error: "Server error. Please try again." });
  if (registered !== "ok") {
    return reply(403, {
      error: isEmail
        ? "Your Basic plan is already in use on " + (license.max_devices ?? 1) + " computer(s), the number of " +
          "licenses on your plan. Uninstall Wrapline Pro on another computer, or [add licenses](" + PRICING + ")."
        : "This code has reached its computer limit. Contact support to reset it.",
      reason: "computer_limit",
    });
  }

  // ---- hand out the latest package ---------------------------------------------------------
  const tag = pythonTag(clip(input.python, 16), clip(input.maya_version, 64));
  const { data: releases } = await db.from("releases")
    .select("version, storage_path, sha256, python_tag").eq("is_latest", true)
    .in("python_tag", tag ? [tag, "any"] : ["any"]);
  const release = (releases ?? []).find((r) => r.python_tag === tag) ??
    (releases ?? []).find((r) => r.python_tag === "any");
  if (!release) {
    return reply(503, { error: "No version of Wrapline Pro is published for this Maya version yet." });
  }

  // Basic (online) gets a package with Wrapline Pro only. Premium (offline) gets the full package, which also holds
  // the free Wrapline. The Pro-only copy is described by a small file next to the full one; if it is missing, the full
  // package is used.
  let packagePath: string = release.storage_path;
  let packageSha: string = release.sha256;
  if ((license.mode ?? "offline") === "online") {
    try {
      const { data: side } = await db.storage.from(BUCKET).download(release.storage_path + ".pro.json");
      if (side) {
        const info = JSON.parse(await side.text());
        if (info && typeof info.path === "string" && typeof info.sha256 === "string") {
          packagePath = info.path;
          packageSha = info.sha256;
        }
      }
    } catch (_) { /* use the full package */ }
  }

  const { data: signed, error: signError } = await db.storage
    .from(BUCKET).createSignedUrl(packagePath, LINK_SECONDS);
  if (signError || !signed) return reply(500, { error: "Could not prepare the download." });

  return reply(200, {
    version: release.version,
    sha256: packageSha,
    url: signed.signedUrl,
    mode: license.mode ?? "offline",
    build: release.python_tag,
    ...extra,
  });
});
