/** Typed, validated environment configuration. */
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  API_PORT: z.coerce.number().default(3000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgres://pilotage:pilotage@localhost:5432/pilotage'),
  DATABASE_APP_ROLE: z.string().default('app_rw'),
  AUTH_DEV_BYPASS: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),
  COGNITO_REGION: z.string().default('eu-west-3'),
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_MODEL_SMALL: z.string().default('mistral-small-latest'),
  MISTRAL_MODEL_LARGE: z.string().default('mistral-large-latest'),
  LLM_TENANT_MONTHLY_TOKEN_CAP: z.coerce.number().default(2_000_000),
  // Comma-separated module overrides, e.g. "M8,M10=false" (enables Should/Could).
  FEATURE_FLAGS: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function loadEnv(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export const ENV = 'ENV_TOKEN';
