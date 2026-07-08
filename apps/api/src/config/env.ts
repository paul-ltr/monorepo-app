/** Typed, validated environment configuration. */
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  API_PORT: z.coerce.number().default(3000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgres://pilotage:pilotage@localhost:5432/pilotage'),
  DATABASE_APP_ROLE: z.string().default('app_rw'),
  // In AWS the DB lives behind a private RDS Proxy with credentials in Secrets
  // Manager. When both are set, the app assembles DATABASE_URL from them at boot
  // (sslmode=require) so the password never has to live in the Lambda env.
  DB_PROXY_ENDPOINT: z.string().optional(),
  DB_SECRET_ARN: z.string().optional(),
  // Fail-safe default: OFF. Must be explicitly opted into for local dev, and is
  // hard-refused when NODE_ENV=production (see loadEnv below).
  AUTH_DEV_BYPASS: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  // Shared secret for the VPC-internal endpoints the data repo calls (device
  // command claim/ack). Unset → dev only; required in production (see loadEnv).
  INTERNAL_API_TOKEN: z.string().optional(),
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),
  COGNITO_REGION: z.string().default('eu-west-3'),
  // AWS region for Secrets Manager / Cognito admin calls (falls back to Cognito's).
  AWS_REGION: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_MODEL_SMALL: z.string().default('mistral-small-latest'),
  MISTRAL_MODEL_LARGE: z.string().default('mistral-large-latest'),
  LLM_TENANT_MONTHLY_TOKEN_CAP: z.coerce.number().default(2_000_000),
  // Comma-separated module overrides, e.g. "M8,M10=false" (enables Should/Could).
  FEATURE_FLAGS: z.string().optional(),
  // Transactional email (Brevo). The API key now lives in AWS Secrets Manager
  // (one key for all tenants) at BREVO_SECRET_ID; BREVO_API_KEY stays as a local
  // dev fallback so email works offline without AWS.
  BREVO_API_KEY: z.string().optional(),
  BREVO_SECRET_ID: z.string().optional(),
  BREVO_SENDER_NAME: z.string().default('LavoPilot'),
  LEADS_TO_EMAIL: z.string().default('paul@lavopilot.com'),
  LEADS_FROM_EMAIL: z.string().default('no-reply@lavopilot.com'),

  // Public origin the browser reaches the API on, used to build the Enedis
  // Data Connect redirect_uri (must be whitelisted in the Enedis app).
  API_PUBLIC_URL: z.string().default('http://localhost:3000'),
  // Where to send the customer back in the web app once consent completes.
  WEB_PUBLIC_URL: z.string().default('http://localhost:5173'),

  // Enedis Data Connect (electricity). Left unset in dev → the connector runs
  // in simulation mode (self-issued consent code, synthetic first history).
  ENEDIS_CLIENT_ID: z.string().optional(),
  ENEDIS_CLIENT_SECRET: z.string().optional(),
  ENEDIS_BASE_URL: z.string().default('https://gw.ext.prod-sandbox.api.enedis.fr'),
  ENEDIS_AUTHORIZE_URL: z
    .string()
    .default('https://mon-compte-particulier.enedis.fr/dataconnect/v1/oauth2/authorize'),

  // GRDF ADICT (gas). Credentials are NEVER committed — supply them via env
  // (Secrets Manager in AWS). Unset → the connector degrades to a synthetic
  // history (simulation), same as Enedis/Pennylane.
  GRDF_ADICT_CLIENT_ID: z.string().default(''),
  GRDF_ADICT_CLIENT_SECRET: z.string().default(''),
  GRDF_ADICT_BASE_URL: z.string().default('https://api.grdf.fr/adict/v2'),
  GRDF_ADICT_TOKEN_URL: z
    .string()
    .default('https://sofit-sso-oidc.grdf.fr/openam/oauth2/access_token?realm=/externeGrdf'),

  // Pennylane (accounting, OAuth 2.0). Unset in dev → the connector runs in
  // simulation mode (self-issued consent code, no live token exchange).
  PENNYLANE_CLIENT_ID: z.string().optional(),
  PENNYLANE_CLIENT_SECRET: z.string().optional(),
  PENNYLANE_SCOPE: z.string().optional(),

  // Electrolux OneApp / OCP (machine brand). Off by default → the connector
  // runs in simulation mode (demo appliances, no live login). Set true to log
  // real group accounts in. The API key / client secret default to the public
  // mobile-app constants per brand and can be overridden here if they rotate.
  ELECTROLUX_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  ELECTROLUX_OCP_BASE: z.string().default('https://api.ocp.electrolux.one'),
  ELECTROLUX_API_KEY: z.string().optional(),
  ELECTROLUX_CLIENT_SECRET: z.string().optional(),

  // Miele 3rd Party API (machine brand, OAuth 2.0 authorization-code). Unset in
  // dev → the connector runs in simulation mode (self-issued consent, demo
  // appliances). The redirect URI ${API_PUBLIC_URL}/connectors/miele/callback
  // must be whitelisted in the Miele developer application.
  MIELE_CLIENT_ID: z.string().optional(),
  MIELE_CLIENT_SECRET: z.string().optional(),
  MIELE_API_BASE: z.string().default('https://api.mcs3.miele.com'),
  MIELE_AUTHORIZE_URL: z.string().default('https://api.mcs3.miele.com/thirdparty/login'),
  MIELE_TOKEN_URL: z.string().default('https://api.mcs3.miele.com/thirdparty/token'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function loadEnv(): Env {
  if (!cached) {
    const env = schema.parse(process.env);
    // Hard guarantee: the auth bypass can never be active in production, even if
    // the env var is mis-set. Refuse to boot rather than run without auth.
    if (env.AUTH_DEV_BYPASS && env.NODE_ENV === 'production') {
      throw new Error('AUTH_DEV_BYPASS=true is forbidden when NODE_ENV=production');
    }
    cached = env;
  }
  return cached;
}

export const ENV = 'ENV_TOKEN';
