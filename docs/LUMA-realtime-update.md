# LUMA Realtime update

## OpenAI endpoint
- `POST https://api.openai.com/v1/realtime/sessions` via the official OpenAI Node SDK (`openai.beta.realtime.sessions.create`).

## Payload used
- `model`: read from `OPENAI_REALTIME_MODEL`, then `NEXT_PUBLIC_REALTIME_MODEL`, default `gpt-4o-realtime-preview-2024-12-17`.
- `modalities`: `['text', 'audio']`.
- `voice`: `alloy`.
- `turn_detection`: `{ type: 'server_vad' }`.
- `input_audio_transcription`: `{ model: 'gpt-4o-transcribe' }`.
- `client_secret.expires_at`: `{ anchor: 'created_at', seconds: 3600 }` (1 hour TTL).
- `instructions`: prefills LUMA description and (if available) candidate id/email for context only.

## Response handling
- The backend returns `{ client_secret: <value> }` on success.
- On errors it logs status/message/body from OpenAI and returns `{ error, details, openai }` with the upstream status code.

## Client usage
- `/luma` requests `POST /api/voice/client-secret` (alias of `/api/client-secret`) and uses the `client_secret` to open `wss://api.openai.com/v1/realtime?client_secret=...`.
- After the WebRTC data channel opens, the client sends `session.update` with instructions, `modalities: ['audio','text']`, `input_audio_transcription` model `gpt-4o-transcribe`, `audio.output.voice: 'alloy'`, and `turn_detection: { type: 'server_vad' }` before creating the first response.

## Environment variables
- `OPENAI_API_KEY` (required, server-side only).
- `OPENAI_PROJECT_ID` (optional, forwards project if present).
- `OPENAI_REALTIME_MODEL` (preferred runtime model) / `NEXT_PUBLIC_REALTIME_MODEL` (fallback for client-configured models).
