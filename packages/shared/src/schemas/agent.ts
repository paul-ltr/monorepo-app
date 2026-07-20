import { z } from 'zod';

/**
 * Agentic LavoPilot — the contract for the chat assistant, its per-user memory,
 * the document context users drop in, and the two credential-based connectors
 * (Wi-Line and the free-form "Autre"). These schemas double as the API
 * request/response validators and the TypeScript types shared by the web chat
 * and the NestJS `AgentController`.
 *
 * The whole read API is exposed to the agent as tools server-side; the shapes
 * here are only what crosses the wire between the browser and the backend.
 */

/** Chat perimeter — mirrors the web app's Scope (whole franchise or one site). */
export const chatScope = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all') }),
  z.object({ type: z.literal('site'), siteId: z.string().min(1), name: z.string().optional() }),
]);
export type ChatScope = z.infer<typeof chatScope>;

export const chatRole = z.enum(['user', 'assistant']);
export type ChatRole = z.infer<typeof chatRole>;

export const chatMessage = z.object({
  role: chatRole,
  content: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessage>;

/**
 * A card the assistant can attach to its reply to drive an in-chat action.
 * Today the only kind is `connect` — it mounts the reusable connector-onboarding
 * component so a user can link a PDL (Enedis) or PCE (GRDF) without leaving chat.
 */
export const chatCard = z.object({
  kind: z.literal('connect'),
  provider: z.enum(['enedis', 'grdf']),
  title: z.string(),
  note: z.string().optional(),
});
export type ChatCard = z.infer<typeof chatCard>;

export const agentChatInput = z.object({
  messages: z.array(chatMessage).min(1),
  scope: chatScope,
});
export type AgentChatInput = z.infer<typeof agentChatInput>;

export const agentChatResult = z.object({
  message: z.string(),
  model: z.string(),
  /** Names of the read tools / datasets the agent consulted, for transparency. */
  usedTools: z.array(z.string()),
  /** Optional in-chat action card (e.g. connect a meter). */
  card: chatCard.nullable(),
  /** Follow-up prompts the UI offers as quick chips. */
  suggestions: z.array(z.string()),
});
export type AgentChatResult = z.infer<typeof agentChatResult>;

// ─────────────────────────── Per-user memory ───────────────────────────────

/** Durable, per-user facts the assistant keeps in mind across conversations. */
export const agentMemory = z.object({
  facts: z.array(z.string()),
  updatedAt: z.string(),
});
export type AgentMemory = z.infer<typeof agentMemory>;

export const updateMemoryInput = z.object({
  facts: z.array(z.string().min(1)).max(50),
});
export type UpdateMemoryInput = z.infer<typeof updateMemoryInput>;

// ───────────────────── User documents (chat context) ───────────────────────

/** A document a user dropped in as context the chat can draw on. */
export const userDocument = z.object({
  id: z.string(),
  name: z.string(),
  mime: z.string(),
  sizeBytes: z.number(),
  note: z.string().nullable(),
  uploadedAt: z.string(),
});
export type UserDocument = z.infer<typeof userDocument>;

export const uploadDocumentInput = z.object({
  name: z.string().min(1),
  mime: z.string().min(1),
  sizeBytes: z.number().nonnegative().default(0),
  note: z.string().optional(),
});
export type UploadDocumentInput = z.infer<typeof uploadDocumentInput>;

// ───────────── Simple credential connectors: Wi-Line & "Autre" ──────────────

/** Wi-Line (www.wi-line.fr) — username + password. */
export const wilineConnectInput = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type WilineConnectInput = z.infer<typeof wilineConnectInput>;

/** "Autre" — free-form request for a source the user wants connected. */
export const otherConnectInput = z.object({
  label: z.string().min(1),
  details: z.string().default(''),
  username: z.string().optional(),
  password: z.string().optional(),
});
export type OtherConnectInput = z.infer<typeof otherConnectInput>;

export const connectAck = z.object({
  ok: z.boolean(),
  provider: z.string(),
  message: z.string(),
  simulated: z.boolean(),
});
export type ConnectAck = z.infer<typeof connectAck>;
