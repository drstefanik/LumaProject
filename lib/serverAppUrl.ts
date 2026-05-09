export function getServerAppUrl() {
  if (process.env.NODE_ENV === "production") {
    const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (vercelProd) return `https://${vercelProd}`;
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) return `https://${vercelUrl}`;
    throw new Error("Missing VERCEL_PROJECT_PRODUCTION_URL/VERCEL_URL in production");
  }
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function fetchWithServerLogging(input: string, init?: RequestInit) {
  console.log("[server-fetch]", {
    targetUrl: input,
    nodeEnv: process.env.NODE_ENV,
    hasVercelUrl: Boolean(process.env.VERCEL_URL),
  });
  return fetch(input, init);
}
