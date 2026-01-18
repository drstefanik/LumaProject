import "server-only";

type AdminSessionPayload = {
  email: string;
  role?: string | null;
  iat?: number;
  exp?: number;
};

const secret = process.env.ADMIN_SESSION_SECRET;

if (!secret) {
  console.warn("Warning: ADMIN_SESSION_SECRET is not set.");
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let keyPromise: Promise<CryptoKey> | null = null;

function toBase64(input: string) {
  if (typeof btoa === "function") {
    return btoa(input);
  }

  return Buffer.from(input, "binary").toString("base64");
}

function fromBase64(input: string) {
  if (typeof atob === "function") {
    return atob(input);
  }

  return Buffer.from(input, "base64").toString("binary");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return toBase64(binary);
}

function base64UrlDecode(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = padded.length % 4 === 0 ? 0 : 4 - (padded.length % 4);
  const base64 = padded + "=".repeat(padLength);
  const binary = fromBase64(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return decoder.decode(bytes);
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  return bytesToBase64(bytes)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlEncodeString(value: string) {
  return base64UrlEncodeBytes(encoder.encode(value));
}

function safeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }

  return diff === 0;
}

async function getSigningKey() {
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is missing.");
  }

  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }

  return keyPromise;
}

async function sign(data: string) {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

export async function signAdminSession(payload: AdminSessionPayload) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24 * 7;

  const tokenPayload = { ...payload, iat: now, exp };
  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(tokenPayload));
  const signature = await sign(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function verifyAdminSession(token: string | undefined | null) {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = await sign(`${encodedHeader}.${encodedPayload}`);

  const signatureBytes = encoder.encode(signature);
  const expectedBytes = encoder.encode(expectedSignature);
  if (!safeEqual(signatureBytes, expectedBytes)) {
    return null;
  }

  const payloadJson = base64UrlDecode(encodedPayload);
  const payload = JSON.parse(payloadJson) as AdminSessionPayload;

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export const adminSessionCookieName = "luma_admin_session";

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}
