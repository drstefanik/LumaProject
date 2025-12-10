# LUMA Realtime update

## OpenAI endpoint
- `POST https://api.openai.com/v1/client/secrets` using a plain `fetch` call.

## Payload used
- `ttl`: `3600` seconds.
- `metadata`: `{ candidateId, candidateEmail }` when provided; omitted otherwise.
- No session creation, model, modalities, or audio configuration is sent from the backend.

## Response handling
- The backend returns `{ client_secret: <value> }` on success.
- On errors it surfaces `{ error, details }` with HTTP `502` and logs the upstream message.

## Client usage
- `/luma` requests `POST /api/client-secret` for the token (legacy `/api/voice/client-secret` aliases the same handler).
- After the WebRTC data channel opens, the client sends `session.update` with only:
  - `model: process.env.NEXT_PUBLIC_REALTIME_MODEL`
  - `input_audio_transcription: { enabled: true }`
  - `turn_detection: { type: 'server_vad' }`
- The first `response.create` carries the conversational instructions.

## Environment variables
- `OPENAI_API_KEY` (required, server-side only).
- `NEXT_PUBLIC_REALTIME_MODEL` (required by the client and passed in `session.update`).
