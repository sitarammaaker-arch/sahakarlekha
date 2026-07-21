/**
 * Payroll run stage plan — idempotent, resumable pipeline stepping (Phase-5 §2/§3, ADR-R3).
 * PURE — no I/O, no clock. This owns only the ORDER of the pipeline and the "what runs next given
 * what's already done" decision, so a crashed run resumes at the first incomplete step and a
 * re-delivered step is a no-op (exactly-once effect). The actual stage work (resolve/calculate/
 * post) and the persistence of "completed" keys are the orchestrator's job (server tier).
 *
 * Stages run in order; a stage may have N shards (only `execute` is typically sharded, by
 * branch/dept, for the 100k-employee fan-out). All shards of a stage complete before the next
 * stage begins. A step is DONE iff its key is in the completed set — that key is the idempotency
 * token the orchestrator upserts once.
 */

export type Stage =
  | 'load_config'
  | 'resolve_scope'
  | 'resolve_policies'
  | 'resolve_rules'
  | 'resolve_formula'
  | 'freeze_snapshot'
  | 'validate'
  | 'plan'
  | 'execute'
  | 'events'
  | 'posting_plan'
  | 'persist';

/** The pipeline in order (Phase-5 §2). The `freeze_snapshot` boundary separates impure resolve
 *  (before) from pure compute (after). */
export const PAYROLL_STAGES: readonly Stage[] = [
  'load_config',
  'resolve_scope',
  'resolve_policies',
  'resolve_rules',
  'resolve_formula',
  'freeze_snapshot',
  'validate',
  'plan',
  'execute',
  'events',
  'posting_plan',
  'persist',
];

export interface StagePlan {
  runId: string;
  /** Shard count per stage (default 1). Only `execute` is typically > 1. */
  shards?: Partial<Record<Stage, number>>;
}

export interface StageStep {
  stage: Stage;
  shard: number;
  key: string;
}

/** Shard count for a stage (clamped to >= 1). */
export function shardCount(plan: StagePlan, stage: Stage): number {
  const n = plan.shards?.[stage] ?? 1;
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** The stable idempotency key for a (run, stage, shard) step. */
export function stageKey(runId: string, stage: Stage, shard = 0): string {
  return `${runId}|${stage}|${shard}`;
}

/** Every step the run must complete, in execution order. */
export function allSteps(plan: StagePlan): StageStep[] {
  const steps: StageStep[] = [];
  for (const stage of PAYROLL_STAGES) {
    const n = shardCount(plan, stage);
    for (let shard = 0; shard < n; shard++) {
      steps.push({ stage, shard, key: stageKey(plan.runId, stage, shard) });
    }
  }
  return steps;
}

/**
 * The next step to run given the set of completed step keys — the RESUME point. Returns the
 * earliest incomplete step in pipeline order (all shards of a stage before the next stage), or
 * null when the run is complete. Re-invoking after a step's key is recorded simply advances.
 */
export function nextIncomplete(plan: StagePlan, completed: ReadonlySet<string>): StageStep | null {
  for (const stage of PAYROLL_STAGES) {
    const n = shardCount(plan, stage);
    for (let shard = 0; shard < n; shard++) {
      const key = stageKey(plan.runId, stage, shard);
      if (!completed.has(key)) return { stage, shard, key };
    }
  }
  return null;
}

/** Is every step of the plan complete? */
export function isComplete(plan: StagePlan, completed: ReadonlySet<string>): boolean {
  return nextIncomplete(plan, completed) === null;
}

/** How many steps remain (for progress/telemetry). */
export function remainingCount(plan: StagePlan, completed: ReadonlySet<string>): number {
  return allSteps(plan).reduce((acc, s) => acc + (completed.has(s.key) ? 0 : 1), 0);
}

/** Would running this step be a no-op (already done)? The idempotency guard. */
export function isStepDone(completed: ReadonlySet<string>, runId: string, stage: Stage, shard = 0): boolean {
  return completed.has(stageKey(runId, stage, shard));
}
