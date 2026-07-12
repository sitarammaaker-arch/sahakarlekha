/**
 * AI proposals, human decisions, attribution & explainability (T-30 / AI Constitution Art. I–IV, VI;
 * AI-N1, AI-P3, AI-X1; Canonical CL-2/CL-7).
 *
 * PURE. AI produces PROPOSALS, never commits (AI-P4). A state-changing effect on financial or
 * statutory data requires an explicit HUMAN commit — there is no autonomous financial mutation
 * (AI-N1). This module is the SSOT for the boundary between "AI helps" and "human owns":
 *
 *   figuresFromEngine  — AI-P3/AI-N3: every monetary figure that could touch the books must come
 *                        from a deterministic ENGINE/ledger (with a ref). A figure the LLM
 *                        "calculated" is never the source of a posting.
 *   isActionable       — AI-X1: a money-affecting proposal with no citation (or an LLM-sourced
 *                        figure) is NOT shown as a commit-ready action — advice at most.
 *   decideProposal     — only a human commit creates the record; the AI can NEVER approve its own
 *                        proposal (III.2 SoD), and the drafting human cannot self-approve where an
 *                        independent approver is required.
 *   buildAuditEnvelope — AI-A1/A2: one append-only trail; agent + on-behalf-of + capability +
 *                        model/version + redacted-inputs ref + proposal + human decision.
 *
 * The figures themselves are produced by the Rules Engine / exact money (T-15/T-16/T-02); this
 * module carries them and enforces their provenance. No I/O; model/version and timestamps injected.
 */

/** Side-effect tier of an AI action (AI Constitution Art. I). */
export type AiTier = 'R' | 'D' | 'E'; // Read/Advise · Draft/Propose · Execute (narrow, reversible)

/** Provenance of a monetary figure. AI-P3/AI-N3: a figure that touches the books must be
 *  engine/ledger-sourced; 'llm'/'unknown' can never be posted. */
export type FigureSource = 'engine' | 'ledger' | 'llm' | 'unknown';

export interface Figure {
  label: string;
  minor: number;
  source: FigureSource;
  /** The engine/rule/ledger reference — required for an engine/ledger figure to be admissible. */
  ref?: string;
}

/** A citation backing a money-affecting suggestion (AI-X1). */
export interface Citation {
  kind: 'ledger' | 'voucher' | 'rule' | 'document' | 'engine';
  ref: string;
}

export interface Proposal {
  id: string;
  agentId: string;
  onBehalfOf: string;
  /** The capability used (AI-A2). */
  capability: string;
  tier: AiTier;
  /** Does committing this proposal affect the books / money / statutory record? */
  moneyAffecting: boolean;
  figures: readonly Figure[];
  citations: readonly Citation[];
  /** The draft payload for a human to review (opaque here). */
  draft: unknown;
}

export interface EngineCheck {
  ok: boolean;
  problems: string[];
}

/**
 * PURE — AI-P3/AI-N3: are all monetary figures sourced from a deterministic engine/ledger with a
 * ref? An LLM-"calculated" or unsourced figure makes the proposal inadmissible for posting — the
 * LLM is not a calculator of record.
 */
export function figuresFromEngine(p: Proposal): EngineCheck {
  const problems: string[] = [];
  for (const f of p.figures) {
    if (f.source === 'llm' || f.source === 'unknown') {
      problems.push(`figure "${f.label}" is ${f.source}-sourced — a monetary figure of record must come from a deterministic engine (AI-P3)`);
    } else if (!f.ref || f.ref.trim().length === 0) {
      problems.push(`figure "${f.label}" is ${f.source}-sourced but carries no engine/ledger ref`);
    }
  }
  return { ok: problems.length === 0, problems };
}

/**
 * PURE — AI-X1: may this proposal be shown as a commit-ready action? A NON-money proposal is
 * actionable as a draft/read. A MONEY-affecting proposal is actionable only if every figure is
 * engine/ledger-sourced (AI-P3) AND it carries at least one citation (AI-X1) — no citation → not
 * shown as actionable, only as advice.
 */
export function isActionable(p: Proposal): boolean {
  if (!p.moneyAffecting) return true;
  return figuresFromEngine(p).ok && p.citations.length > 0;
}

export type DecisionKind = 'approved' | 'modified' | 'rejected';

export interface HumanDecision {
  proposalId: string;
  kind: DecisionKind;
  /** The human principal who decided — an independent commit (III.2). */
  decidedBy: string;
  decidedAt: string;
}

export interface DecisionInput {
  kind: DecisionKind;
  decidedBy: string;
  /** When policy requires an independent approver, the drafting human may not self-approve (III.2). */
  requiresIndependentApprover?: boolean;
}

export interface DecisionResult {
  ok: boolean;
  decision?: HumanDecision;
  reason?: string;
}

/**
 * PURE — record a HUMAN's decision on an AI proposal (AI-P4/AI-N1/AI-A3). Rules:
 *  • the decider must be a real human, and NEVER the agent — the AI cannot approve its own proposal
 *    (III.2 SoD);
 *  • approving a MONEY-affecting proposal that is not actionable (no citation / LLM figure) is
 *    refused (AI-X1/AI-P3) — you cannot commit an unexplained or LLM-computed figure;
 *  • where an independent approver is required, the human the AI drafted for cannot self-approve.
 * A reject/modify never creates a posting; only an approve authorizes the human's commit downstream.
 */
export function decideProposal(p: Proposal, input: DecisionInput, decidedAt: string): DecisionResult {
  if (!input.decidedBy || input.decidedBy.trim().length === 0) return { ok: false, reason: 'a human decider is required (AI-P1)' };
  if (input.decidedBy === p.agentId) return { ok: false, reason: 'the AI cannot approve its own proposal (III.2 SoD)' };
  if (input.kind === 'approved') {
    if (p.moneyAffecting && !isActionable(p)) {
      return { ok: false, reason: 'a money-affecting proposal without a citation or with an LLM-sourced figure cannot be committed (AI-X1/AI-P3)' };
    }
    if (input.requiresIndependentApprover && input.decidedBy === p.onBehalfOf) {
      return { ok: false, reason: 'an independent approver is required — the drafting human cannot self-approve (III.2)' };
    }
  }
  return { ok: true, decision: { proposalId: p.id, kind: input.kind, decidedBy: input.decidedBy, decidedAt } };
}

export interface AuditEnvelope {
  proposalId: string;
  agentId: string;
  onBehalfOf: string;
  capability: string;
  model: string;
  modelVersion: string;
  decision: DecisionKind;
  decidedBy: string;
  decidedAt: string;
  /** A pointer to PII-minimized/redacted inputs (Art. V) — never raw PII in the envelope (AI-A2/AI-M3). */
  redactedInputsRef?: string;
}

/**
 * PURE — build the single-trail audit envelope for a decided proposal (AI-A1/AI-A2). AI actions are
 * recorded on the SAME append-only trail as human actions, with full attribution: agent, the human
 * it served, the capability used, the model/version in effect, the decision — and only a reference
 * to redacted inputs, never raw PII. model/version and the redacted-inputs ref are injected.
 */
export function buildAuditEnvelope(
  p: Proposal,
  decision: HumanDecision,
  ctx: { model: string; modelVersion: string; redactedInputsRef?: string },
): AuditEnvelope {
  return {
    proposalId: p.id,
    agentId: p.agentId,
    onBehalfOf: p.onBehalfOf,
    capability: p.capability,
    model: ctx.model,
    modelVersion: ctx.modelVersion,
    decision: decision.kind,
    decidedBy: decision.decidedBy,
    decidedAt: decision.decidedAt,
    redactedInputsRef: ctx.redactedInputsRef,
  };
}
