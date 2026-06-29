import { z } from 'zod';

/**
 * Entity primary keys are UUIDv7 (time-ordered, index-friendly). We validate as
 * a generic UUID at the edge; generation lives in `@pilotage/db` (uuidv7()).
 */
export const uuid = z.string().uuid();
export type Uuid = z.infer<typeof uuid>;

/** ISO-8601 UTC timestamp string (the wire format for `timestamptz`). */
export const isoTimestamp = z.string().datetime({ offset: true });
export type IsoTimestamp = z.infer<typeof isoTimestamp>;

/** IANA timezone, e.g. "Europe/Paris" — each site stores its own. */
export const ianaTimezone = z.string().min(1);
export type IanaTimezone = z.infer<typeof ianaTimezone>;
