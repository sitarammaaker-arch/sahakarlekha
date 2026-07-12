/**
 * Governance authority — grounding the "human authority" for financial finalization (T-23 /
 * UCAS CM-2; AI Constitution Art. III; API-P8; Canonical CL-7).
 *
 * PURE. A cooperative is a democratic body: the LEGALITY of a financial-finalization act —
 * adopting the accounts, appropriating surplus, declaring a dividend, closing the year,
 * sanctioning a loan — derives from a recorded GOVERNANCE act (a board resolution, an AGM
 * adoption, a committee minute). The AI and API constitutions repeatedly require "human /
 * board / AGM authority" for money and statutory finalization; this is where that authority
 * comes from and how it is recorded.
 *
 * A finalization requires: the CORRECT authority for the act, ATTESTED with a reference + date
 * + authorizer, AND segregation of duties (the authorizer is not the preparer — the same SoD
 * the approval workflow already enforces). The verdict's `recorded` attestation is what gets
 * stamped on the finalization event (CL-7 / AI-A) — the auditable link from a figure to the
 * governance act that authorized it.
 *
 * This uses the EXISTING governance concepts (resolutions, AGM, committees, SoD) — no new
 * architecture. Which act needs which authority is DATA, extensible per bye-law.
 */

export type FinalizationAct =
  | 'account_adoption'
  | 'appropriation'
  | 'dividend_declaration'
  | 'fy_close'
  | 'budget_adoption'
  | 'loan_sanction';

export type AuthorityKind = 'board_resolution' | 'agm_adoption' | 'general_body' | 'loan_committee';

/**
 * Which governance authority each finalization act requires (UCAS CM-2). Data, not code — a
 * State Act / bye-law variation is a change here, not a branch in a posting path.
 */
export const FINALIZATION_AUTHORITY: Record<FinalizationAct, AuthorityKind> = {
  account_adoption: 'agm_adoption',      // the AGM adopts the annual accounts
  appropriation: 'agm_adoption',         // appropriation of surplus is adopted at the AGM
  dividend_declaration: 'agm_adoption',  // dividend is declared at the AGM (≤ cap, or with sanction)
  fy_close: 'board_resolution',          // the board resolves to close / lock the year
  budget_adoption: 'general_body',       // the general body adopts the budget
  loan_sanction: 'loan_committee',       // sanctioned by the loan committee (by amount)
};

/** A recorded governance act that authorizes a finalization — the attestation stamped on the event. */
export interface AuthorityAttestation {
  kind: AuthorityKind;
  /** The recorded governance act: board resolution no. / AGM reference / committee minute no. */
  reference: string;
  /** ISO date of the resolution / AGM / minute. */
  date: string;
  /** Who authorized — the board / AGM / committee (recorded for the audit chain). */
  authorizedBy: string;
}

export interface FinalizationRequest {
  act: FinalizationAct;
  /** Who is preparing / posting the finalization — for SoD (must differ from the authorizer). */
  preparedBy: string;
  attestation?: AuthorityAttestation;
}

export interface AuthorityVerdict {
  ok: boolean;
  problems: string[];
  /** The attestation to record on the finalization event (CL-7 / AI-A). Present only when ok. */
  recorded?: AuthorityAttestation;
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/**
 * PURE — may this finalization proceed? It requires the CORRECT governance authority for the
 * act, attested with a reference + date + authorizer, and segregation of duties. Returns the
 * attestation to record when ok, otherwise every reason it was refused (a finalization posted
 * without authority is exactly what statutory audit exists to catch).
 */
export function authorizeFinalization(req: FinalizationRequest): AuthorityVerdict {
  const problems: string[] = [];
  const required = FINALIZATION_AUTHORITY[req.act];
  const att = req.attestation;

  if (!att) {
    problems.push(`${req.act} requires ${required} authority — none attested`);
    return { ok: false, problems };
  }

  if (att.kind !== required) problems.push(`${req.act} requires ${required}, but ${att.kind} was attested`);
  if (!nonEmpty(att.reference)) problems.push('the authorizing act has no reference (resolution / AGM / minute no.)');
  if (!nonEmpty(att.date)) problems.push('the authorizing act has no date');
  if (!nonEmpty(att.authorizedBy)) problems.push('the authorizing act names no authorizer');
  // Segregation of duties: the authorizer must not be the preparer (the same rule the approval
  // workflow enforces — AI Constitution Art. III.2 / API AUTH-6).
  if (nonEmpty(att.authorizedBy) && nonEmpty(req.preparedBy) && att.authorizedBy === req.preparedBy) {
    problems.push('segregation of duties: the authorizer must not be the preparer');
  }

  return problems.length === 0 ? { ok: true, problems, recorded: att } : { ok: false, problems };
}
