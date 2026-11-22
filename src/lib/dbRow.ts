/**
 * Generated DB types (src/types/database.ts, `npm run db:types`) make the Supabase client check every table name,
 * every column in .select / .eq / .order / .in, every RPC name and the shape of every row it returns — a renamed or
 * misspelled column no longer compiles.
 *
 * WRITE PAYLOADS are the one deliberate exception. A save turns an app object (camelCase fields, nested arrays for
 * jsonb columns, fields some tables have not migrated yet) into a row through a small set of helpers — withSoc /
 * stampTenant, memberRow, toLedgerEventRow, the post_voucher payload builders — and the TWO-STEP save (CLAUDE.md
 * RULE 1) splits base columns from late-added extras at runtime, with a rollback when the base write fails. Typing
 * those objects column-for-column would mean a cast at every one of ~130 call sites without catching more, so the
 * helpers return LooseRow: the row's correctness is the two-step save's job (and its tests), not the compiler's.
 *
 * Use LooseRow ONLY as the return type of such a payload helper — never for data read back from the database.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LooseRow = any;

/**
 * RPC arguments built from app objects. The generated function types say `Json` for jsonb parameters (an app object
 * with typed fields is not `Json` to the compiler) and leave defaulted parameters optional-but-not-null (PostgREST
 * accepts null). The SQL function validates its own input; this marks the hand-over in one visible place.
 */
export const asDbArgs = <T>(args: T): LooseRow => args;

/** A write payload (insert / update / upsert) built from an app object — same reasoning as LooseRow. */
export const asDbRow = <T>(row: T): LooseRow => row;

/**
 * A row read from the database, handed to an app type whose fields the app treats as present (the column allows
 * NULL). Prefer normalising the nulls; use this only where the existing code already relies on the app type.
 */
export const dbRowAs = <T>(row: unknown): T => row as T;
