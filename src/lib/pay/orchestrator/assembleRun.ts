/**
 * Run assembly (Phase-8/9 orchestrator — the PURE core). This is the heart of the server
 * orchestrator, kept pure so the whole "compute a payroll run" logic is unit-testable with plain
 * objects. It composes every payroll subsystem into the single artifact the impure shell persists:
 *
 *   resolve.freezeViews ─────────► frozenViews  (→ run_snapshot: reproducibility / freeze-and-replay)
 *   formula.compileFormulaCatalog► plan         (→ the formulaPlan of the frozen run)
 *   calc.computePayslip (per emp) ► payslips     (→ payslip / payslip_line rows)
 *   runtime.buildPayEvent ───────► event        (→ the WORM 'calculated' pay_event, exactly-once)
 *
 * PURE: no I/O, no clock, no randomness. The impure Edge Function injects everything time/identity/
 * fetch-dependent — the fetched catalogs, the per-employee calc inputs, the run id, the event id +
 * occurredAt, and the next gapless sequence — and persists the returned artifact under service_role
 * (which bypasses the aal2 RLS gate by design; the gate guards interactive user sessions, not the
 * compute service). Because assembly is a pure function of frozen inputs, a run replays identically.
 *
 * A 'calculated' event does NOT advance the run lifecycle (it stays in its current state, per
 * runState.stateAfterEvent) — it records that this run's payslips were computed from these frozen
 * views, so a later verify/approve/post chain has an auditable calculation of record.
 */

import { freezeViews, type FreezeCatalogs, type FreezeContext, type FrozenViews } from '../resolve/freeze.ts';
import { compileFormulaCatalog, type FormulaSource, type CompiledFormulaSet } from '../formula/compile.ts';
import { computePayslip } from '../calc/engine.ts';
import { buildPayEvent, type PayEvent, type PayEventContext, type PayEventProducer } from '../runtime/payEvent.ts';
import type { CalcInputs } from '../calc/components.ts';
import type { AggregateSpec, Payslip } from '../calc/payslip.ts';
import type { TypeEnv } from '../formula/typeChecker.ts';

/** One employee's calc request — facts + the resolved calc inputs (fixed components, classification,
 *  clamps). These are derived from the frozen views by the impure fetch layer (a later slice); here
 *  they are injected, keeping assembly pure. */
export interface EmployeeCalcRequest {
  employeeId: string;
  calc: CalcInputs;
  aggregate: Omit<AggregateSpec, 'currency'>;
}

export interface AssembleRunInput {
  societyId: string;
  /** The pay_run aggregate id (the event stream this run appends to). */
  runId: string;
  /** Next gapless 1-based sequence for the 'calculated' event (from nextSequence over existing events). */
  sequence: number;
  /** Resolver catalogs + context to freeze once for the whole run. */
  freeze: { catalogs: FreezeCatalogs; ctx: FreezeContext };
  /** The formula catalog (component SFL sources) + the type env to compile against. */
  formula: { sources: readonly FormulaSource[]; typeBase: TypeEnv };
  /** Each employee to compute in this run. */
  employees: readonly EmployeeCalcRequest[];
  /** Who ran it (human/agent/import/integration) — recorded on the event. */
  producer: PayEventProducer;
}

export interface AssembledRun {
  frozenViews: FrozenViews;
  plan: CompiledFormulaSet;
  payslips: { employeeId: string; payslip: Payslip }[];
  /** The 'calculated' WORM event to append (exactly once) for this run. */
  event: PayEvent;
}

/**
 * PURE — assemble one payroll run: freeze the views once, compile the formula catalog once, compute
 * each employee's payslip against the shared plan, and shape the 'calculated' pay_event. Any refusal
 * in the pipeline (required-rule gap, unsourced value, formula/type error, unclassified component,
 * missing input) propagates unchanged — a bad run is refused, never silently half-computed.
 *
 * `evCtx` injects the event id + occurredAt (the impure shell supplies crypto.randomUUID + the clock).
 */
export function assembleRun(input: AssembleRunInput, evCtx: PayEventContext): AssembledRun {
  const frozenViews = freezeViews(input.freeze.catalogs, input.freeze.ctx);
  const plan = compileFormulaCatalog(input.formula.sources, input.formula.typeBase);

  const payslips = input.employees.map((e) => ({
    employeeId: e.employeeId,
    payslip: computePayslip({ plan, calc: e.calc, aggregate: e.aggregate }),
  }));

  const event = buildPayEvent(
    {
      societyId: input.societyId,
      aggregateId: input.runId,
      sequence: input.sequence,
      eventType: 'calculated',
      producer: input.producer,
      payload: {
        runId: input.runId,
        employeeCount: payslips.length,
        // net per employee — a compact, replayable summary of what was computed (full payslip rows
        // are persisted separately; the event records the calculation of record, not the display).
        nets: payslips.map((p) => ({ employeeId: p.employeeId, currency: p.payslip.currency, netMinor: p.payslip.netPay.minor })),
      },
      schemaVersion: 1,
    },
    evCtx,
  );

  return { frozenViews, plan, payslips, event };
}
