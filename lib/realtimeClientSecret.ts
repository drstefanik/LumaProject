export type ClientSecretMetadata = {
  candidateId?: string;
  candidateEmail?: string;
};

export async function createRealtimeClientSecret({
  apiKey,
  metadata,
  ttlSeconds = 3600,
}: {
  apiKey: string;
  metadata?: ClientSecretMetadata;
  ttlSeconds?: number;
}): Promise<string> {
  const metadataPayload = metadata
    ? Object.fromEntries(
        Object.entries(metadata).filter(([, value]) => value !== undefined && value !== "")
      )
    : undefined;

  const response = await fetch("https://api.openai.com/v1/client/secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ttl: ttlSeconds,
      metadata: metadataPayload,
    }),
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    const message =
      (errorBody as { error?: { message?: string } })?.error?.message ??
      (typeof errorBody === "string" ? errorBody : "Unknown error creating client secret");

    throw new Error(`OpenAI client secret request failed (${response.status}): ${message}`);
  }

  const json = (await response.json()) as { client_secret?: string };
  if (!json.client_secret) {
    throw new Error("OpenAI response did not include client_secret");
  }

  return json.client_secret;
}
