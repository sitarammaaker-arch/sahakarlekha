// src/lib/pay/resolve/scope.ts
var SCOPE_LEVELS = [
  "global",
  "country",
  "state",
  "org_type",
  "org",
  "branch",
  "department",
  "cadre",
  "designation",
  "employee"
];
function scopeSpecificity(level) {
  const i = SCOPE_LEVELS.indexOf(level);
  if (i < 0) throw new RangeError(`scope: unknown level ${level}`);
  return i;
}
function scopeApplies(scope, chain) {
  switch (scope.level) {
    case "global":
    case "country":
    case "state":
      return true;
    case "org_type":
      return !!scope.refId && scope.refId === chain.orgType;
    case "org":
      return !!scope.refId && scope.refId === chain.orgId;
    case "branch":
      return !!scope.refId && scope.refId === chain.branchId;
    case "department":
      return !!scope.refId && scope.refId === chain.departmentId;
    case "cadre":
      return !!scope.refId && scope.refId === chain.cadreId;
    case "designation":
      return !!scope.refId && scope.refId === chain.designationId;
    case "employee":
      return !!scope.refId && scope.refId === chain.employeeId;
    default:
      return false;
  }
}
function selectMostSpecific(candidates, chain, asOf) {
  const asOfMs = Date.parse(asOf);
  if (Number.isNaN(asOfMs)) throw new RangeError("scope: asOf is not a valid ISO date");
  const scored = candidates.filter((c) => scopeApplies(c.scope, chain)).map((c) => ({ c, ms: Date.parse(c.effectiveFrom), spec: scopeSpecificity(c.scope.level), ver: c.version ?? 0 })).filter((s) => !Number.isNaN(s.ms) && s.ms <= asOfMs);
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.spec - a.spec || b.ms - a.ms || b.ver - a.ver);
  const top = scored[0];
  const ties = scored.filter((s) => s.spec === top.spec && s.ms === top.ms && s.ver === top.ver);
  if (ties.length > 1) {
    throw new RangeError(
      `PAY-CMP-CONFLICT: ${ties.length} candidates tie at scope=${top.c.scope.level} effectiveFrom=${top.c.effectiveFrom} version=${top.ver} \u2014 catalog defect`
    );
  }
  return top.c;
}

// src/lib/pay/resolve/ruleResolver.ts
function whenMatches(c, attrs) {
  if (!c.when) return true;
  for (const k of Object.keys(c.when)) {
    if (!attrs || attrs[k] !== c.when[k]) return false;
  }
  return true;
}
function resolvePayRule(candidates, ctx) {
  const asOfMs = Date.parse(ctx.asOf);
  if (Number.isNaN(asOfMs)) throw new RangeError("rule resolver: asOf is not a valid ISO date");
  const jur = (ctx.jurisdiction ?? "").trim();
  const jchain = jur ? [jur, ""] : [""];
  const scored = candidates.map((c) => {
    const jIdx = jchain.indexOf(c.jurisdiction ?? "");
    return {
      c,
      ms: Date.parse(c.effectiveFrom),
      spec: scopeSpecificity(c.scope.level),
      jrank: jIdx < 0 ? -1 : jchain.length - jIdx,
      // more specific jurisdiction ⇒ higher
      ws: c.when ? Object.keys(c.when).length : 0,
      ver: c.version ?? 0
    };
  }).filter((s) => scopeApplies(s.c.scope, ctx.chain) && s.jrank > 0 && whenMatches(s.c, ctx.attrs) && !Number.isNaN(s.ms) && s.ms <= asOfMs);
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.spec - a.spec || b.jrank - a.jrank || b.ws - a.ws || b.ms - a.ms || b.ver - a.ver);
  const top = scored[0];
  const ties = scored.filter((s) => s.spec === top.spec && s.jrank === top.jrank && s.ws === top.ws && s.ms === top.ms && s.ver === top.ver);
  if (ties.length > 1) {
    throw new RangeError(`PAY-CMP-CONFLICT: ${ties.length} rule candidates tie (scope=${top.c.scope.level}, jur=${top.c.jurisdiction ?? ""}, effectiveFrom=${top.c.effectiveFrom}, version=${top.ver}) \u2014 catalog defect`);
  }
  if (top.c.verified && (top.c.sourceCount ?? 0) === 0) {
    throw new RangeError("PAY-CMP-501: a verified rule value has no source \u2014 refusing (verified requires an Act/circular citation)");
  }
  return {
    value: top.c.value,
    provenance: {
      scope: top.c.scope,
      jurisdiction: top.c.jurisdiction ?? "",
      effectiveFrom: top.c.effectiveFrom,
      version: top.ver,
      verified: !!top.c.verified
    }
  };
}
function resolveRequiredPayRule(candidates, ctx, key) {
  const r = resolvePayRule(candidates, ctx);
  if (!r) {
    throw new RangeError(`PAY-CMP-510: no rule value resolves${key ? ` for "${key}"` : ""} at ${ctx.asOf} \u2014 refusing (no guess)`);
  }
  return r;
}

// src/lib/pay/resolve/policyResolver.ts
function composeConfigs(ordered) {
  const out = {};
  for (const config of ordered) {
    for (const [k, v] of Object.entries(config)) {
      const prev = out[k];
      if (Array.isArray(prev) && Array.isArray(v)) {
        out[k] = [.../* @__PURE__ */ new Set([...prev, ...v])];
      } else {
        out[k] = v;
      }
    }
  }
  return out;
}
function resolvePolicy(candidates, ctx) {
  const asOfMs = Date.parse(ctx.asOf);
  if (Number.isNaN(asOfMs)) throw new RangeError("policy resolver: asOf is not a valid ISO date");
  const applicable = candidates.map((c) => ({ c, ms: Date.parse(c.effectiveFrom), spec: scopeSpecificity(c.scope.level), ver: c.version ?? 0 })).filter((s) => scopeApplies(s.c.scope, ctx.chain) && !Number.isNaN(s.ms) && s.ms <= asOfMs);
  const byLevel = /* @__PURE__ */ new Map();
  for (const s of applicable) {
    const arr = byLevel.get(s.spec) ?? [];
    arr.push(s);
    byLevel.set(s.spec, arr);
  }
  const winners = [];
  for (const [spec, group] of byLevel) {
    group.sort((a, b) => b.ms - a.ms || b.ver - a.ver);
    const top = group[0];
    const ties = group.filter((s) => s.ms === top.ms && s.ver === top.ver);
    if (ties.length > 1) {
      throw new RangeError(`PAY-CMP-CONFLICT: ${ties.length} policy candidates tie at scope=${top.c.scope.level} effectiveFrom=${top.c.effectiveFrom} version=${top.ver} \u2014 catalog defect`);
    }
    winners.push({
      spec,
      layer: { scope: top.c.scope, effectiveFrom: top.c.effectiveFrom, version: top.ver },
      config: top.c.config
    });
  }
  winners.sort((a, b) => a.spec - b.spec);
  return {
    config: composeConfigs(winners.map((w) => w.config)),
    layers: winners.map((w) => w.layer)
  };
}

// src/lib/pay/resolve/freeze.ts
function freezeViews(catalogs, ctx) {
  const ruleView = {};
  for (const [key, spec] of Object.entries(catalogs.rules)) {
    ruleView[key] = spec.required ? resolveRequiredPayRule(spec.candidates, ctx, key) : resolvePayRule(spec.candidates, ctx);
  }
  const policyView = {};
  for (const [type, candidates] of Object.entries(catalogs.policies)) {
    policyView[type] = resolvePolicy(candidates, { chain: ctx.chain, asOf: ctx.asOf }).config;
  }
  const configView = {};
  for (const [key, candidates] of Object.entries(catalogs.config)) {
    const win = selectMostSpecific(candidates, ctx.chain, ctx.asOf);
    configView[key] = win ? win.value : null;
  }
  return { ruleView, policyView, configView };
}

// src/lib/money.ts
var DEFAULT_ROUNDING = "half-up";
function assertFinite(value, where) {
  if (!Number.isFinite(value)) throw new RangeError(`money.${where}: value is not finite (${value})`);
}
function assertMinor(value, where) {
  if (!Number.isInteger(value)) throw new RangeError(`money.${where}: minor units must be an integer paise value, got ${value}`);
}
function roundMinor(value, mode = DEFAULT_ROUNDING) {
  assertFinite(value, "roundMinor");
  switch (mode) {
    case "down":
      return Math.trunc(value);
    case "up":
      return value >= 0 ? Math.ceil(value) : Math.floor(value);
    case "half-even": {
      const floor = Math.floor(value);
      const diff = value - floor;
      if (diff < 0.5) return floor;
      if (diff > 0.5) return floor + 1;
      return floor % 2 === 0 ? floor : floor + 1;
    }
    case "half-up":
    default:
      return value >= 0 ? Math.round(value) : -Math.round(-value);
  }
}
function addMinor(...values) {
  let sum = 0;
  for (const v of values) {
    assertMinor(v, "addMinor");
    sum += v;
  }
  return sum;
}
function subMinor(a, b) {
  assertMinor(a, "subMinor");
  assertMinor(b, "subMinor");
  return a - b;
}
function mulMinor(baseMinor, factor, mode = DEFAULT_ROUNDING) {
  assertMinor(baseMinor, "mulMinor");
  assertFinite(factor, "mulMinor");
  return { minor: roundMinor(baseMinor * factor, mode), mode };
}
function applyPercent(baseMinor, pct, mode = DEFAULT_ROUNDING) {
  assertMinor(baseMinor, "applyPercent");
  assertFinite(pct, "applyPercent");
  return { minor: roundMinor(baseMinor * pct / 100, mode), mode };
}

// src/lib/pay/formula/evaluator.ts
var makeMoney = (minor, currency) => ({ kind: "money", minor, currency });
var isMoney = (v) => !!v && typeof v === "object" && v.kind === "money";
var isPct = (v) => !!v && typeof v === "object" && v.kind === "pct";
var isNum = (v) => typeof v === "number";
var rangeErr = (code, msg) => {
  throw new RangeError(`${code}: ${msg}`);
};
var asBool = (v, ctx) => {
  if (typeof v !== "boolean") rangeErr("PAY-DSL-TYPE-013", `${ctx} requires a Boolean`);
  return v;
};
var sameCur = (a, b) => {
  if (a.currency !== b.currency) rangeErr("PAY-DSL-TYPE-011", `currency mismatch (${a.currency} vs ${b.currency})`);
};
function binop(op, l, r) {
  switch (op) {
    case "+":
      if (isMoney(l) && isMoney(r)) {
        sameCur(l, r);
        return makeMoney(addMinor(l.minor, r.minor), l.currency);
      }
      if (isNum(l) && isNum(r)) return l + r;
      if (isMoney(l) !== isMoney(r) && (isNum(l) || isNum(r))) rangeErr("PAY-DSL-TYPE-010", "cannot add Money and a plain number");
      return rangeErr("PAY-DSL-TYPE-012", `'+' unsupported for these types`);
    case "-":
      if (isMoney(l) && isMoney(r)) {
        sameCur(l, r);
        return makeMoney(subMinor(l.minor, r.minor), l.currency);
      }
      if (isNum(l) && isNum(r)) return l - r;
      if (isMoney(l) !== isMoney(r) && (isNum(l) || isNum(r))) rangeErr("PAY-DSL-TYPE-010", "cannot subtract Money and a plain number");
      return rangeErr("PAY-DSL-TYPE-012", `'-' unsupported for these types`);
    case "*": {
      if (isMoney(l) && isMoney(r)) return rangeErr("PAY-DSL-TYPE-012", "cannot multiply Money by Money");
      if (isMoney(l) && isNum(r)) return makeMoney(mulMinor(l.minor, r).minor, l.currency);
      if (isNum(l) && isMoney(r)) return makeMoney(mulMinor(r.minor, l).minor, r.currency);
      if (isMoney(l) && isPct(r)) return makeMoney(mulMinor(l.minor, r.ratio).minor, l.currency);
      if (isPct(l) && isMoney(r)) return makeMoney(mulMinor(r.minor, l.ratio).minor, r.currency);
      if (isNum(l) && isPct(r)) return l * r.ratio;
      if (isPct(l) && isNum(r)) return l.ratio * r;
      if (isNum(l) && isNum(r)) return l * r;
      return rangeErr("PAY-DSL-TYPE-012", `'*' unsupported for these types`);
    }
    case "/": {
      if (isMoney(l) && isMoney(r)) {
        sameCur(l, r);
        if (r.minor === 0) rangeErr("PAY-DSL-RUN-050", "divide by zero");
        return l.minor / r.minor;
      }
      if (isMoney(l) && isNum(r)) {
        if (r === 0) rangeErr("PAY-DSL-RUN-050", "divide by zero");
        return makeMoney(roundMinor(l.minor / r), l.currency);
      }
      if (isNum(l) && isNum(r)) {
        if (r === 0) rangeErr("PAY-DSL-RUN-050", "divide by zero");
        return l / r;
      }
      return rangeErr("PAY-DSL-TYPE-012", `'/' unsupported for these types`);
    }
    case "==":
      return valuesEqual(l, r);
    case "!=":
      return !valuesEqual(l, r);
    case "<":
    case "<=":
    case ">":
    case ">=":
      return compare(op, l, r);
    default:
      return rangeErr("PAY-DSL-TYPE-012", `unknown operator '${op}'`);
  }
}
function valuesEqual(l, r) {
  if (isMoney(l) && isMoney(r)) return l.minor === r.minor && l.currency === r.currency;
  return l === r;
}
function compare(op, l, r) {
  let a, b;
  if (isMoney(l) && isMoney(r)) {
    sameCur(l, r);
    a = l.minor;
    b = r.minor;
  } else if (isNum(l) && isNum(r)) {
    a = l;
    b = r;
  } else return rangeErr("PAY-DSL-TYPE-012", `'${op}' needs two numbers or two Money`);
  switch (op) {
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    default:
      return a >= b;
  }
}
function evaluate(node, env) {
  switch (node.type) {
    case "Literal":
      if (node.litType === "percent") return { kind: "pct", ratio: node.value / 100 };
      if (node.litType === "date") return { kind: "date", iso: node.value };
      if (node.litType === "duration") return { kind: "dur", text: node.value };
      return node.value;
    case "Var":
      if (!(node.name in env.vars)) return rangeErr("PAY-DSL-REF-020", `unknown variable '${node.name}'`);
      return env.vars[node.name];
    case "UnOp": {
      const v = evaluate(node.operand, env);
      if (node.op === "-") {
        if (isMoney(v)) return makeMoney(-v.minor, v.currency);
        if (isNum(v)) return -v;
        return rangeErr("PAY-DSL-TYPE-012", "unary - needs a number or Money");
      }
      return !asBool(v, "not");
    }
    case "BinOp": {
      if (node.op === "and") {
        return asBool(evaluate(node.left, env), "and") ? asBool(evaluate(node.right, env), "and") : false;
      }
      if (node.op === "or") {
        return asBool(evaluate(node.left, env), "or") ? true : asBool(evaluate(node.right, env), "or");
      }
      if (node.op === "??") {
        const l = evaluate(node.left, env);
        return l !== null && l !== void 0 ? l : evaluate(node.right, env);
      }
      return binop(node.op, evaluate(node.left, env), evaluate(node.right, env));
    }
    case "If":
      return asBool(evaluate(node.cond, env), "if condition") ? evaluate(node.then, env) : evaluate(node.else, env);
    case "Member": {
      const o = evaluate(node.obj, env);
      if (o === null || o === void 0) {
        if (node.nullSafe) return null;
        return rangeErr("PAY-DSL-RUN-052", `null in required position (.${node.name})`);
      }
      if (typeof o !== "object") return rangeErr("PAY-DSL-TYPE-012", `cannot read .${node.name} of a non-object`);
      const val = o[node.name];
      return val === void 0 ? null : val;
    }
    case "Index": {
      const o = evaluate(node.obj, env);
      const idx = evaluate(node.index, env);
      if (o === null || o === void 0) return rangeErr("PAY-DSL-RUN-052", "null in required position (index)");
      const val = o[idx];
      return val === void 0 ? null : val;
    }
    case "Call": {
      if (node.callee.type !== "Var") return rangeErr("PAY-DSL-SEC-060", "only named whitelisted functions may be called");
      const fn = env.fns[node.callee.name];
      if (typeof fn !== "function") return rangeErr("PAY-DSL-SEC-060", `unknown / non-whitelisted function '${node.callee.name}'`);
      return fn(...node.args.map((a) => evaluate(a, env)));
    }
    case "List":
      return node.items.map((it) => evaluate(it, env));
    case "Map": {
      const out = {};
      for (const p of node.pairs) out[p.key] = evaluate(p.value, env);
      return out;
    }
    default:
      return rangeErr("PAY-DSL-RUN-000", `cannot evaluate node ${node.type}`);
  }
}

// src/lib/pay/orchestrator/mapCatalog.ts
var KIND_TO_SIDE = {
  earning: "earning",
  arrear: "earning",
  terminal_benefit: "earning",
  reimbursement: "earning",
  // paid to the employee → adds to net (affects_gross=false, but net-relevant)
  deduction: "deduction",
  loan_recovery: "deduction",
  employer_contrib: "info"
  // employer cost — not in the employee's net (its liability is tracked separately)
};
var isFiniteNum = (v) => typeof v === "number" && Number.isFinite(v);
function mapCatalog(input) {
  const formulaSources = [];
  const fixedComponents = {};
  const classification = {};
  const clamps = {};
  for (const c of input.components) {
    const side = KIND_TO_SIDE[c.kind];
    if (side === void 0) throw new RangeError(`PAY-MAP-701: component '${c.code}' has unknown kind '${c.kind}'`);
    classification[c.code] = side;
    if (c.overrideFixedMinor != null && c.calcMethod !== "fixed") {
      if (!isFiniteNum(c.overrideFixedMinor)) throw new RangeError(`PAY-MAP-705: component '${c.code}' amount is not a finite number`);
      if (c.overrideCurrency && c.overrideCurrency !== input.currency) {
        throw new RangeError(`PAY-MAP-706: component '${c.code}' currency ${c.overrideCurrency} \u2260 run currency ${input.currency}`);
      }
      fixedComponents[c.code] = makeMoney(c.overrideFixedMinor, input.currency);
      const b0 = input.clamps?.[c.code];
      if (b0) clamps[c.code] = b0;
      continue;
    }
    switch (c.calcMethod) {
      case "formula":
      case "attendance_derived":
        if (!c.formulaSource) throw new RangeError(`PAY-MAP-702: ${c.calcMethod} component '${c.code}' has no formula source`);
        formulaSources.push({ code: c.code, source: c.formulaSource });
        break;
      case "fixed": {
        if (c.overrideFixedMinor == null) {
          throw new RangeError(`PAY-MAP-703: 'fixed' component '${c.code}' has no per-employee override amount`);
        }
        if (!isFiniteNum(c.overrideFixedMinor)) throw new RangeError(`PAY-MAP-705: component '${c.code}' amount is not a finite number`);
        if (c.overrideCurrency && c.overrideCurrency !== input.currency) {
          throw new RangeError(`PAY-MAP-706: component '${c.code}' currency ${c.overrideCurrency} \u2260 run currency ${input.currency}`);
        }
        fixedComponents[c.code] = makeMoney(c.overrideFixedMinor, input.currency);
        break;
      }
      case "rule": {
        const resolved = input.ruleView[c.code];
        if (!resolved) throw new RangeError(`PAY-MAP-704: 'rule' component '${c.code}' has no resolved rule (key '${c.code}')`);
        if (!isFiniteNum(resolved.value)) throw new RangeError(`PAY-MAP-705: rule for '${c.code}' did not resolve to a finite amount`);
        fixedComponents[c.code] = makeMoney(resolved.value, input.currency);
        break;
      }
      default:
        throw new RangeError(`PAY-MAP-707: component '${c.code}' has unknown calc_method '${String(c.calcMethod)}'`);
    }
    const b = input.clamps?.[c.code];
    if (b) clamps[c.code] = b;
  }
  return { formulaSources, fixedComponents, classification, clamps };
}

// src/lib/pay/formula/lexer.ts
var KEYWORDS = /* @__PURE__ */ new Set([
  "formula",
  "let",
  "in",
  "if",
  "then",
  "else",
  "and",
  "or",
  "not",
  "null",
  "true",
  "false"
]);
var MULTI_OPS = ["==", "!=", "<=", ">=", "??", "?.", "..", "::"];
var SINGLE_OPS = /* @__PURE__ */ new Set(["+", "-", "*", "/", "<", ">"]);
var PUNCT = /* @__PURE__ */ new Set(["(", ")", "[", "]", "{", "}", ",", ":", ".", "="]);
var isDigit = (c) => c >= "0" && c <= "9";
var isIdentStart = (c) => c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "_";
var isIdentPart = (c) => isIdentStart(c) || isDigit(c);
function tokenize(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;
  const err2 = (pos, code, msg) => {
    throw new RangeError(`${code}: ${msg} at position ${pos}`);
  };
  while (i < n) {
    const c = src[i];
    if (c === " " || c === "	" || c === "\r" || c === "\n") {
      i++;
      continue;
    }
    if (c === "#") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const start = i;
      const quote = c;
      i++;
      let val = "";
      while (i < n && src[i] !== quote) {
        if (src[i] === "\n") err2(start, "PAY-DSL-SYN-004", "unterminated string");
        val += src[i++];
      }
      if (i >= n) err2(start, "PAY-DSL-SYN-004", "unterminated string");
      i++;
      tokens.push({ kind: "string", value: val, pos: start });
      continue;
    }
    if (c === "@") {
      const start = i;
      i++;
      let val = "";
      while (i < n && (isDigit(src[i]) || src[i] === "-")) val += src[i++];
      if (val.length === 0) err2(start, "PAY-DSL-SYN-001", "expected a date after '@'");
      tokens.push({ kind: "date", value: val, pos: start });
      continue;
    }
    if (isDigit(c)) {
      const start = i;
      let num = "";
      while (i < n && isDigit(src[i])) num += src[i++];
      let isInt = true;
      if (i < n && src[i] === "." && isDigit(src[i + 1] ?? "")) {
        isInt = false;
        num += src[i++];
        while (i < n && isDigit(src[i])) num += src[i++];
      }
      if (i < n && src[i] === "%") {
        i++;
        tokens.push({ kind: "percent", value: num, pos: start });
        continue;
      }
      if (isInt && i < n && (src[i] === "d" || src[i] === "m" || src[i] === "y") && !isIdentPart(src[i + 1] ?? "")) {
        const unit = src[i++];
        tokens.push({ kind: "duration", value: num + unit, pos: start });
        continue;
      }
      tokens.push({ kind: "number", value: num, pos: start });
      continue;
    }
    if (isIdentStart(c)) {
      const start = i;
      let id = "";
      while (i < n && isIdentPart(src[i])) id += src[i++];
      tokens.push({ kind: KEYWORDS.has(id) ? "keyword" : "ident", value: id, pos: start });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (MULTI_OPS.includes(two)) {
      tokens.push({ kind: "op", value: two, pos: i });
      i += 2;
      continue;
    }
    if (SINGLE_OPS.has(c)) {
      tokens.push({ kind: "op", value: c, pos: i });
      i++;
      continue;
    }
    if (PUNCT.has(c)) {
      tokens.push({ kind: "punct", value: c, pos: i });
      i++;
      continue;
    }
    err2(i, "PAY-DSL-SYN-001", `unexpected character '${c}'`);
  }
  tokens.push({ kind: "eof", value: "", pos: n });
  return tokens;
}

// src/lib/pay/formula/parser.ts
function makeParser(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const at = (kind, value) => peek().kind === kind && (value === void 0 || peek().value === value);
  const err2 = (code, msg) => {
    throw new RangeError(`${code}: ${msg} at position ${peek().pos}`);
  };
  const next = () => tokens[i++];
  const expect = (kind, value) => {
    if (!at(kind, value)) err2("PAY-DSL-SYN-002", `expected ${value ?? kind}, got '${peek().value || peek().kind}'`);
    return next();
  };
  function expression() {
    return conditional();
  }
  function conditional() {
    if (at("keyword", "if")) {
      next();
      const cond = expression();
      expect("keyword", "then");
      const thenE = expression();
      expect("keyword", "else");
      const elseE = expression();
      return { type: "If", cond, then: thenE, else: elseE };
    }
    return coalesce();
  }
  function coalesce() {
    let left = logicOr();
    while (at("op", "??")) {
      next();
      left = { type: "BinOp", op: "??", left, right: logicOr() };
    }
    return left;
  }
  function logicOr() {
    let left = logicAnd();
    while (at("keyword", "or")) {
      next();
      left = { type: "BinOp", op: "or", left, right: logicAnd() };
    }
    return left;
  }
  function logicAnd() {
    let left = equality();
    while (at("keyword", "and")) {
      next();
      left = { type: "BinOp", op: "and", left, right: equality() };
    }
    return left;
  }
  function equality() {
    let left = comparison();
    while (at("op", "==") || at("op", "!=")) {
      const op = next().value;
      left = { type: "BinOp", op, left, right: comparison() };
    }
    return left;
  }
  function comparison() {
    let left = additive();
    while (at("op", "<") || at("op", "<=") || at("op", ">") || at("op", ">=")) {
      const op = next().value;
      left = { type: "BinOp", op, left, right: additive() };
    }
    return left;
  }
  function additive() {
    let left = multiplicative();
    while (at("op", "+") || at("op", "-")) {
      const op = next().value;
      left = { type: "BinOp", op, left, right: multiplicative() };
    }
    return left;
  }
  function multiplicative() {
    let left = unary();
    while (at("op", "*") || at("op", "/")) {
      const op = next().value;
      left = { type: "BinOp", op, left, right: unary() };
    }
    return left;
  }
  function unary() {
    if (at("op", "-") || at("keyword", "not")) {
      const op = next().value;
      return { type: "UnOp", op, operand: unary() };
    }
    return postfix();
  }
  function postfix() {
    let e = primary();
    for (; ; ) {
      if (at("punct", ".") || at("op", "?.")) {
        const nullSafe = next().value === "?.";
        const name = expect("ident").value;
        e = { type: "Member", obj: e, name, nullSafe };
      } else if (at("punct", "[")) {
        next();
        const index = expression();
        expect("punct", "]");
        e = { type: "Index", obj: e, index };
      } else if (at("punct", "(")) {
        next();
        const args = [];
        if (!at("punct", ")")) {
          args.push(expression());
          while (at("punct", ",")) {
            next();
            args.push(expression());
          }
        }
        expect("punct", ")");
        e = { type: "Call", callee: e, args };
      } else break;
    }
    return e;
  }
  function primary() {
    const t = peek();
    switch (t.kind) {
      case "number":
        next();
        return { type: "Literal", litType: "number", value: Number(t.value) };
      case "percent":
        next();
        return { type: "Literal", litType: "percent", value: Number(t.value) };
      case "string":
        next();
        return { type: "Literal", litType: "string", value: t.value };
      case "date":
        next();
        return { type: "Literal", litType: "date", value: t.value };
      case "duration":
        next();
        return { type: "Literal", litType: "duration", value: t.value };
      case "ident":
        next();
        return { type: "Var", name: t.value };
      case "keyword":
        if (t.value === "true") {
          next();
          return { type: "Literal", litType: "bool", value: true };
        }
        if (t.value === "false") {
          next();
          return { type: "Literal", litType: "bool", value: false };
        }
        if (t.value === "null") {
          next();
          return { type: "Literal", litType: "null", value: null };
        }
        return err2("PAY-DSL-SYN-003", `unexpected keyword '${t.value}'`);
      case "punct":
        if (t.value === "(") {
          next();
          const e = expression();
          expect("punct", ")");
          return e;
        }
        if (t.value === "[") return listLit();
        if (t.value === "{") return mapLit();
        return err2("PAY-DSL-SYN-003", `unexpected '${t.value}'`);
      default:
        return err2("PAY-DSL-SYN-003", `unexpected '${t.value || t.kind}'`);
    }
  }
  function listLit() {
    expect("punct", "[");
    const items = [];
    if (!at("punct", "]")) {
      items.push(expression());
      while (at("punct", ",")) {
        next();
        items.push(expression());
      }
    }
    expect("punct", "]");
    return { type: "List", items };
  }
  function mapLit() {
    expect("punct", "{");
    const pairs = [];
    if (!at("punct", "}")) {
      const pair = () => {
        const k = peek();
        if (k.kind !== "ident" && k.kind !== "string") err2("PAY-DSL-SYN-003", "map key must be an identifier or string");
        next();
        expect("punct", ":");
        pairs.push({ key: k.value, value: expression() });
      };
      pair();
      while (at("punct", ",")) {
        next();
        pair();
      }
    }
    expect("punct", "}");
    return { type: "Map", pairs };
  }
  function type() {
    return expect("ident").value;
  }
  function formula() {
    expect("keyword", "formula");
    const name = expect("string").value;
    expect("op", "::");
    const annotation = type();
    const bindings = [];
    while (at("keyword", "let")) {
      next();
      const bname = expect("ident").value;
      let annotationB;
      if (at("op", "::")) {
        next();
        annotationB = type();
      }
      expect("punct", "=");
      bindings.push({ name: bname, annotation: annotationB, expr: expression() });
    }
    expect("keyword", "in");
    const body = expression();
    return { name, annotation, bindings, body };
  }
  const expectEof = () => {
    if (!at("eof")) err2("PAY-DSL-SYN-002", `unexpected trailing '${peek().value || peek().kind}'`);
  };
  return { expression, formula, expectEof };
}
function parseFormula(tokens) {
  const p = makeParser(tokens);
  const f = p.formula();
  p.expectEof();
  return f;
}

// src/lib/pay/formula/typeChecker.ts
var err = (code, msg) => {
  throw new RangeError(`${code}: ${msg}`);
};
var U = "Unknown";
var unk = (t) => t === "Unknown";
var compatible = (a, b) => unk(a) || unk(b) || a === b;
function checkBin(op, l, r) {
  switch (op) {
    case "+":
    case "-":
      if (unk(l) || unk(r)) return U;
      if (l === "Money" && r === "Money") return "Money";
      if (l === "Number" && r === "Number") return "Number";
      if (l === "Money" !== (r === "Money") && (l === "Number" || r === "Number"))
        return err("PAY-DSL-TYPE-010", `cannot ${op === "+" ? "add" : "subtract"} Money and a plain number`);
      return err("PAY-DSL-TYPE-012", `'${op}' unsupported for ${l} and ${r}`);
    case "*":
      if (unk(l) || unk(r)) return U;
      if (l === "Money" && r === "Money") return err("PAY-DSL-TYPE-012", "cannot multiply Money by Money");
      if (l === "Money" && (r === "Number" || r === "Percentage") || (l === "Number" || l === "Percentage") && r === "Money") return "Money";
      if ((l === "Number" || l === "Percentage") && (r === "Number" || r === "Percentage")) return "Number";
      return err("PAY-DSL-TYPE-012", `'*' unsupported for ${l} and ${r}`);
    case "/":
      if (unk(l) || unk(r)) return U;
      if (l === "Money" && r === "Money") return "Number";
      if (l === "Money" && r === "Number") return "Money";
      if (l === "Number" && r === "Number") return "Number";
      return err("PAY-DSL-TYPE-012", `'/' unsupported for ${l} and ${r}`);
    case "==":
    case "!=":
      return "Boolean";
    case "<":
    case "<=":
    case ">":
    case ">=":
      if (unk(l) || unk(r)) return "Boolean";
      if (l === "Number" && r === "Number" || l === "Money" && r === "Money") return "Boolean";
      return err("PAY-DSL-TYPE-012", `'${op}' needs two Numbers or two Money, got ${l} and ${r}`);
    default:
      return err("PAY-DSL-TYPE-012", `unknown operator '${op}'`);
  }
}
function checkType(node, env) {
  switch (node.type) {
    case "Literal":
      switch (node.litType) {
        case "number":
          return "Number";
        case "percent":
          return "Percentage";
        case "string":
          return "String";
        case "date":
          return "Date";
        case "duration":
          return "Duration";
        case "bool":
          return "Boolean";
        case "null":
          return "Null";
        default:
          return U;
      }
    case "Var":
      if (!(node.name in env.vars)) return err("PAY-DSL-REF-020", `undeclared variable '${node.name}'`);
      return env.vars[node.name];
    case "UnOp": {
      const t = checkType(node.operand, env);
      if (node.op === "-") {
        if (unk(t) || t === "Number" || t === "Money") return t === U ? U : t;
        return err("PAY-DSL-TYPE-012", `unary - needs Number or Money, got ${t}`);
      }
      if (!compatible(t, "Boolean")) return err("PAY-DSL-TYPE-013", `'not' needs a Boolean, got ${t}`);
      return "Boolean";
    }
    case "BinOp": {
      if (node.op === "and" || node.op === "or") {
        const lt = checkType(node.left, env), rt = checkType(node.right, env);
        if (!compatible(lt, "Boolean") || !compatible(rt, "Boolean")) return err("PAY-DSL-TYPE-013", `'${node.op}' needs Booleans, got ${lt} and ${rt}`);
        return "Boolean";
      }
      if (node.op === "??") {
        const lt = checkType(node.left, env), rt = checkType(node.right, env);
        if (lt === "Null") return rt;
        return unk(lt) ? U : lt;
      }
      return checkBin(node.op, checkType(node.left, env), checkType(node.right, env));
    }
    case "If": {
      const ct = checkType(node.cond, env);
      if (!compatible(ct, "Boolean")) return err("PAY-DSL-TYPE-013", `if-condition needs a Boolean, got ${ct}`);
      const tt = checkType(node.then, env), et = checkType(node.else, env);
      if (unk(tt)) return et;
      if (unk(et)) return tt;
      return tt === et ? tt : U;
    }
    case "Member":
      checkType(node.obj, env);
      return U;
    case "Index":
      checkType(node.obj, env);
      checkType(node.index, env);
      return U;
    case "Call": {
      if (node.callee.type !== "Var") return err("PAY-DSL-SEC-060", "only named whitelisted functions may be called");
      const calleeName = node.callee.name;
      const sig = env.fns[calleeName];
      if (!sig) return err("PAY-DSL-SEC-060", `unknown / non-whitelisted function '${calleeName}'`);
      if (node.args.length !== sig.params.length) return err("PAY-DSL-TYPE-014", `'${calleeName}' expects ${sig.params.length} args, got ${node.args.length}`);
      node.args.forEach((a, idx) => {
        const at = checkType(a, env);
        if (!compatible(at, sig.params[idx])) err("PAY-DSL-TYPE-015", `'${calleeName}' arg ${idx + 1} expects ${sig.params[idx]}, got ${at}`);
      });
      return sig.ret;
    }
    case "List":
      node.items.forEach((it) => checkType(it, env));
      return "List";
    case "Map":
      node.pairs.forEach((p) => checkType(p.value, env));
      return "Map";
    default:
      return U;
  }
}
function checkFormula(formula, base) {
  const env = { vars: { ...base.vars }, fns: base.fns };
  for (const b of formula.bindings) {
    env.vars[b.name] = checkType(b.expr, env);
  }
  const bodyType = checkType(formula.body, env);
  if (formula.annotation && formula.annotation !== "Unknown") {
    if (!compatible(bodyType, formula.annotation)) {
      err("PAY-DSL-TYPE-016", `formula "${formula.name}" declares :: ${formula.annotation} but the body is ${bodyType}`);
    }
  }
  return bodyType;
}

// src/lib/pay/formula/dag.ts
function extractDeps(expr) {
  const out = /* @__PURE__ */ new Set();
  const walk = (n) => {
    switch (n.type) {
      case "Var":
        out.add(n.name);
        return;
      case "Call":
        n.args.forEach(walk);
        return;
      case "Member":
        walk(n.obj);
        return;
      case "Index":
        walk(n.obj);
        walk(n.index);
        return;
      case "BinOp":
        walk(n.left);
        walk(n.right);
        return;
      case "UnOp":
        walk(n.operand);
        return;
      case "If":
        walk(n.cond);
        walk(n.then);
        walk(n.else);
        return;
      case "List":
        n.items.forEach(walk);
        return;
      case "Map":
        n.pairs.forEach((p) => walk(p.value));
        return;
      case "Literal":
        return;
      default:
        return;
    }
  };
  walk(expr);
  return [...out];
}
function formulaDeps(formula) {
  const local = new Set(formula.bindings.map((b) => b.name));
  const deps = /* @__PURE__ */ new Set();
  for (const b of formula.bindings) for (const d of extractDeps(b.expr)) if (!local.has(d)) deps.add(d);
  for (const d of extractDeps(formula.body)) if (!local.has(d)) deps.add(d);
  return [...deps];
}
function compilePlan(nodes) {
  const byName = /* @__PURE__ */ new Map();
  for (const n of nodes) {
    if (byName.has(n.name)) throw new RangeError(`PAY-DSL-DEP-DUP: duplicate formula node '${n.name}'`);
    byName.set(n.name, n);
  }
  const state = /* @__PURE__ */ new Map();
  const order = [];
  const stack = [];
  const visit = (name) => {
    const cur = state.get(name);
    if (cur === "black") return;
    if (cur === "gray") {
      const at = stack.indexOf(name);
      const path = [...stack.slice(at), name].join(" \u2192 ");
      throw new RangeError(`PAY-DSL-DEP-CYCLE: dependency cycle ${path}`);
    }
    state.set(name, "gray");
    stack.push(name);
    const node = byName.get(name);
    if (node) {
      for (const d of node.deps) if (byName.has(d)) visit(d);
    }
    stack.pop();
    state.set(name, "black");
    order.push(name);
  };
  for (const n of nodes) visit(n.name);
  const deps = {};
  for (const n of nodes) deps[n.name] = n.deps;
  return { order, deps };
}

// src/lib/pay/formula/compile.ts
function compileFormulaCatalog(catalog, base) {
  const parsed = [];
  const seen = /* @__PURE__ */ new Set();
  for (const { code, source } of catalog) {
    if (seen.has(code)) throw new RangeError(`PAY-DSL-COMPILE: duplicate component '${code}' in catalog`);
    seen.add(code);
    let formula;
    try {
      formula = parseFormula(tokenize(source));
    } catch (e) {
      throw new RangeError(`compiling component '${code}': ${e.message}`);
    }
    parsed.push({ code, formula });
  }
  const componentTypes = {};
  for (const { code, formula } of parsed) componentTypes[code] = formula.annotation ?? "Unknown";
  const env = { vars: { ...base.vars, ...componentTypes }, fns: base.fns };
  const formulas = {};
  const nodes = [];
  for (const { code, formula } of parsed) {
    let type;
    try {
      type = checkFormula(formula, env);
    } catch (e) {
      throw new RangeError(`compiling component '${code}': ${e.message}`);
    }
    const deps = formulaDeps(formula);
    formulas[code] = { code, formula, type, deps };
    nodes.push({ name: code, deps });
  }
  const plan = compilePlan(nodes);
  return { order: plan.order, formulas, plan };
}

// src/lib/pay/formula/evalPlan.ts
function evaluateFormula(formula, env) {
  const vars = { ...env.vars };
  for (const b of formula.bindings) {
    vars[b.name] = evaluate(b.expr, { vars, fns: env.fns });
  }
  return evaluate(formula.body, { vars, fns: env.fns });
}
function evaluatePlan(set, inputs) {
  const vars = { ...inputs.vars };
  const values = {};
  for (const code of set.order) {
    const cf = set.formulas[code];
    if (!cf) throw new RangeError(`PAY-DSL-RUN-053: plan references uncompiled component '${code}'`);
    const value = evaluateFormula(cf.formula, { vars, fns: inputs.fns });
    vars[code] = value;
    values[code] = value;
  }
  return { values };
}

// src/lib/pay/calc/components.ts
function factsToEnv(facts, currency) {
  const m = (minor) => makeMoney(minor, currency);
  const ytd = {};
  for (const [head, minor] of Object.entries(facts.tax.ytdByHead)) ytd[head] = m(minor);
  const leaveBalance = {};
  for (const l of facts.leave) leaveBalance[l.type] = l.balance;
  const loanRecoveries = facts.loan.map((x) => ({ loanId: x.loanId, amount: m(x.amountMinor) }));
  const loanTotalMinor = facts.loan.reduce((s, x) => s + x.amountMinor, 0);
  return {
    attendance: {
      paidDays: facts.attendance.paidDays,
      lopDays: facts.attendance.lopDays,
      otHours: facts.attendance.otHours
    },
    tax: { monthsRemaining: facts.tax.monthsRemaining, regime: facts.tax.regime, ytd },
    leaveBalance,
    loanRecovery: m(loanTotalMinor),
    loanRecoveries
  };
}
function runComponents(set, inputs) {
  const vars = { ...factsToEnv(inputs.facts, inputs.currency), ...inputs.scalars ?? {}, ...inputs.fixedComponents };
  return evaluatePlan(set, { vars, fns: inputs.fns });
}

// src/lib/pay/resolve/clamps.ts
function applyClamp(value, bounds) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError("clamp: value must be a finite number");
  }
  const floor = bounds.floor ?? null;
  const ceiling = bounds.ceiling ?? null;
  if (floor != null && ceiling != null && floor > ceiling) {
    throw new RangeError(`PAY-CMP-CLAMP: floor (${floor}) > ceiling (${ceiling}) \u2014 catalog defect`);
  }
  if (ceiling != null && value > ceiling) {
    return { value: ceiling, clamped: "ceiling", floor, ceiling };
  }
  if (floor != null && value < floor) {
    return { value: floor, clamped: "floor", floor, ceiling };
  }
  return { value, clamped: "none", floor, ceiling };
}

// src/lib/pay/calc/payslip.ts
var isEmployerShareCode = (code) => {
  const c = code.toUpperCase();
  return c === "ER_PF" || c === "ER_ESI" || c.startsWith("ER_ESI_");
};
var isMoney2 = (v) => !!v && typeof v === "object" && v.kind === "money";
function aggregatePayslip(values, spec) {
  const earnings = [];
  const deductions = [];
  const employerContributions = [];
  let grossEarningsMinor = 0;
  let grossDeductionsMinor = 0;
  for (const code of Object.keys(values)) {
    if (spec.classification[code] === void 0) {
      throw new RangeError(`PAY-CAL-601: component '${code}' is computed but unclassified (earning/deduction/info required)`);
    }
  }
  const pool = { ...values, ...spec.fixedComponents ?? {} };
  for (const [code, side] of Object.entries(spec.classification)) {
    if (side === "info") {
      const v = pool[code];
      if (isEmployerShareCode(code) && v !== void 0 && isMoney2(v) && v.currency === spec.currency) {
        employerContributions.push({ code, side, amount: makeMoney(Math.round(v.minor / 100) * 100, spec.currency), clamped: "none" });
      }
      continue;
    }
    const raw = pool[code];
    if (raw === void 0) {
      throw new RangeError(`PAY-CAL-604: ${side} component '${code}' is classified but has no computed or fixed value`);
    }
    if (!isMoney2(raw)) {
      throw new RangeError(`PAY-CAL-602: ${side} component '${code}' must be a money value`);
    }
    if (raw.currency !== spec.currency) {
      throw new RangeError(`PAY-CAL-603: component '${code}' is ${raw.currency}, payslip currency is ${spec.currency}`);
    }
    const bounds = spec.clamps?.[code];
    const clamp = bounds ? applyClamp(raw.minor, bounds) : { value: raw.minor, clamped: "none" };
    const minor = Math.round(clamp.value / 100) * 100;
    const line = { code, side, amount: makeMoney(minor, spec.currency), clamped: clamp.clamped };
    if (side === "earning") {
      earnings.push(line);
      grossEarningsMinor += minor;
    } else {
      deductions.push(line);
      grossDeductionsMinor += minor;
    }
  }
  return {
    currency: spec.currency,
    earnings,
    deductions,
    grossEarnings: makeMoney(grossEarningsMinor, spec.currency),
    grossDeductions: makeMoney(grossDeductionsMinor, spec.currency),
    netPay: makeMoney(grossEarningsMinor - grossDeductionsMinor, spec.currency),
    ...employerContributions.length ? { employerContributions } : {}
  };
}

// src/lib/pay/calc/engine.ts
function computePayslip(input) {
  const { values } = runComponents(input.plan, input.calc);
  return aggregatePayslip(values, {
    currency: input.calc.currency,
    classification: input.aggregate.classification,
    clamps: input.aggregate.clamps,
    // fixed/rule components (e.g. BASIC) are plan INPUTS, not outputs — pass them so a classified
    // fixed earning still appears on the payslip.
    fixedComponents: input.calc.fixedComponents
  });
}

// src/lib/pay/runtime/runState.ts
var PAY_EVENT_TYPES = [
  "initiated",
  "calculated",
  "verified",
  "approved",
  "locked",
  "posted",
  "paid",
  "reversed",
  "cancelled"
];
var ALLOWED = {
  draft: ["verified", "cancelled"],
  verified: ["approved", "draft", "cancelled"],
  // reject → draft
  approved: ["locked", "verified", "cancelled"],
  // reject → verified
  locked: ["posted"],
  posted: ["paid", "rolled_back"],
  paid: ["rolled_back"],
  cancelled: [],
  rolled_back: []
};
var RUN_STATES = Object.keys(ALLOWED);
function canTransition(from, to) {
  return (ALLOWED[from] ?? []).includes(to);
}
function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new Error(`PAY-RUN-STATE: illegal transition ${from} \u2192 ${to}`);
  }
}
var EVENT_TO_STATE = {
  initiated: "draft",
  verified: "verified",
  approved: "approved",
  locked: "locked",
  posted: "posted",
  paid: "paid",
  cancelled: "cancelled",
  reversed: "rolled_back"
};
function stateAfterEvent(current, event) {
  const target = EVENT_TO_STATE[event];
  if (target === void 0) return current;
  if (current === target) return current;
  assertTransition(current, target);
  return target;
}

// src/lib/pay/runtime/payEvent.ts
var PRINCIPAL_KINDS = /* @__PURE__ */ new Set(["human", "agent", "import", "integration"]);
var EVENT_TYPES = new Set(PAY_EVENT_TYPES);
function buildPayEvent(input, ctx) {
  const req = (v, name) => {
    if (typeof v !== "string" || v.trim().length === 0) throw new RangeError(`pay event: ${name} is required`);
  };
  req(ctx.eventId, "eventId");
  req(ctx.occurredAt, "occurredAt");
  req(input.societyId, "societyId");
  req(input.aggregateId, "aggregateId");
  req(input.producer?.actorEmail, "producer.actorEmail");
  if (!input.producer || !PRINCIPAL_KINDS.has(input.producer.kind)) {
    throw new RangeError(`pay event: producer.kind must be one of ${[...PRINCIPAL_KINDS].join("/")}`);
  }
  if (!EVENT_TYPES.has(input.eventType)) {
    throw new RangeError(`pay event: eventType must be a PayEventType, got ${String(input.eventType)}`);
  }
  if (!Number.isInteger(input.sequence) || input.sequence < 1) {
    throw new RangeError(`pay event: sequence must be a positive integer, got ${input.sequence}`);
  }
  if (input.eventType === "reversed" && !input.reversalOf) {
    throw new RangeError("pay event: a 'reversed' event must carry reversalOf");
  }
  return {
    eventId: ctx.eventId,
    societyId: input.societyId,
    aggregateType: "pay_run",
    aggregateId: input.aggregateId,
    sequence: input.sequence,
    eventType: input.eventType,
    producerKind: input.producer.kind,
    ...input.producer.onBehalfOf != null ? { onBehalfOf: input.producer.onBehalfOf } : {},
    actorEmail: input.producer.actorEmail,
    occurredAt: ctx.occurredAt,
    payload: input.payload ?? {},
    schemaVersion: input.schemaVersion ?? 1,
    ...input.reversalOf ? { reversalOf: input.reversalOf } : {}
  };
}

// src/lib/pay/orchestrator/assembleRun.ts
function assembleRun(input, evCtx) {
  const frozenViews = freezeViews(input.freeze.catalogs, input.freeze.ctx);
  const plan = compileFormulaCatalog(input.formula.sources, input.formula.typeBase);
  const payslips = input.employees.map((e) => ({
    employeeId: e.employeeId,
    payslip: computePayslip({ plan, calc: e.calc, aggregate: e.aggregate })
  }));
  const event = buildPayEvent(
    {
      societyId: input.societyId,
      aggregateId: input.runId,
      sequence: input.sequence,
      eventType: "calculated",
      producer: input.producer,
      payload: {
        runId: input.runId,
        employeeCount: payslips.length,
        // net per employee — a compact, replayable summary of what was computed (full payslip rows
        // are persisted separately; the event records the calculation of record, not the display).
        nets: payslips.map((p) => ({ employeeId: p.employeeId, currency: p.payslip.currency, netMinor: p.payslip.netPay.minor }))
      },
      schemaVersion: 1
    },
    evCtx
  );
  return { frozenViews, plan, payslips, event };
}

// src/lib/pay/posting/runPosting.ts
function bucketOf(code, kind) {
  const c = code.toUpperCase();
  if (kind === "earning") return "earning";
  if (kind === "loan_recovery" || c === "LOAN_RECOVERY") return "loan";
  if (kind === "deduction") {
    if (c === "LOP" || c.startsWith("LOP_")) return "lop";
    if (c === "PF" || c === "EPF") return "pf";
    if (c === "ESI" || c.startsWith("ESI_")) return "esi";
    if (c === "PT" || c === "PROFESSIONAL_TAX") return "pt";
    if (c === "TDS" || c === "TDS_192" || c.startsWith("TDS_")) return "tds";
    return "other_deduction";
  }
  if (kind === "employer_contrib") {
    if (c === "ER_PF") return "er_pf";
    if (c === "ER_ESI" || c.startsWith("ER_ESI_")) return "er_esi";
  }
  return "ignore";
}
var isMinor = (n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
function buildRunAccrual(lines, netMinor, heads, newId = () => crypto.randomUUID()) {
  if (!isMinor(netMinor) || lines.some((l) => !isMinor(l.amountMinor))) {
    return { ok: false, code: "PAY-POST-INPUT", message: "amounts must be whole paise \u2265 0" };
  }
  const sum = { earning: 0, lop: 0, pf: 0, esi: 0, pt: 0, tds: 0, loan: 0, other_deduction: 0, er_pf: 0, er_esi: 0, ignore: 0 };
  const unknown = /* @__PURE__ */ new Set();
  for (const l of lines) {
    const b = bucketOf(l.code, l.kind);
    sum[b] += l.amountMinor;
    if (b === "other_deduction" && l.amountMinor > 0) unknown.add(l.code);
  }
  if (unknown.size) {
    return {
      ok: false,
      code: "PAY-POST-UNKNOWN-DEDUCTION",
      unknown: [...unknown],
      message: `deduction(s) ${[...unknown].join(", ")} have no ledger head \u2014 refusing to book (add the mapping first)`
    };
  }
  const expenseMinor = sum.earning - sum.lop;
  const deductionsMinor = sum.lop + sum.pf + sum.esi + sum.pt + sum.tds + sum.loan;
  if (expenseMinor <= 0) return { ok: false, code: "PAY-POST-NOTHING", message: "nothing to post (zero expense)" };
  if (sum.earning - deductionsMinor !== netMinor) {
    return {
      ok: false,
      code: "PAY-POST-IMBALANCE",
      message: `net ${netMinor} \u2260 earnings ${sum.earning} \u2212 deductions ${deductionsMinor} \u2014 refusing to book`
    };
  }
  const missing = [];
  if (sum.pf + sum.er_pf > 0 && !heads.pfPayable) missing.push("pf.payable");
  if (sum.esi + sum.er_esi > 0 && !heads.esiPayable) missing.push("esi.payable");
  if (sum.er_pf > 0 && !heads.pfEmployerExpense) missing.push("pf.employer_expense");
  if (sum.er_esi > 0 && !heads.esiEmployerExpense) missing.push("esi.employer_expense");
  if (sum.pt > 0 && !heads.ptPayable) missing.push("professional_tax.payable");
  if (sum.tds > 0 && !heads.tdsPayable) missing.push("tds.payable");
  if (sum.loan > 0 && !heads.employeeAdvance) missing.push("employee.advance");
  if (missing.length) {
    return {
      ok: false,
      code: "PAY-POST-HEAD",
      missingHeads: missing,
      // Hindi first. There is NO screen that maps a role (Ledger Heads does not) — it is added to account_roles by support, so do not say otherwise.
      message: `\u092C\u0939\u0940 \u092E\u0947\u0902 \u0928\u0939\u0940\u0902 \u0932\u093F\u0916\u093E \u0917\u092F\u093E \u2014 \u0907\u0928 \u0916\u093E\u0924\u094B\u0902 \u0915\u093E role \u0907\u0938 \u0938\u094B\u0938\u093E\u0907\u091F\u0940 \u092E\u0947\u0902 \u0924\u092F \u0928\u0939\u0940\u0902 \u0939\u0948: ${missing.join(", ")}\u0964 \u0938\u0939\u093E\u092F\u0924\u093E \u0938\u0947 \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0902\u0964 (no ledger head for ${missing.join(", ")} \u2014 refusing to book; the role must be added by support, it cannot be set from the Ledger Heads screen)`
    };
  }
  const legs = [
    { id: newId(), accountId: heads.salaryExpense, drCr: "Dr", amountMinor: expenseMinor, narration: "Salary & wages (net of loss of pay)" },
    { id: newId(), accountId: heads.salaryPayable, drCr: "Cr", amountMinor: netMinor, narration: "Net salary payable" }
  ];
  const credit = (acc, amt, narration) => {
    if (amt > 0 && acc) legs.push({ id: newId(), accountId: acc, drCr: "Cr", amountMinor: amt, narration });
  };
  if (sum.er_pf > 0 && heads.pfEmployerExpense) legs.push({ id: newId(), accountId: heads.pfEmployerExpense, drCr: "Dr", amountMinor: sum.er_pf, narration: "Employer PF contribution" });
  if (sum.er_esi > 0 && heads.esiEmployerExpense) legs.push({ id: newId(), accountId: heads.esiEmployerExpense, drCr: "Dr", amountMinor: sum.er_esi, narration: "Employer ESI contribution" });
  credit(heads.pfPayable, sum.pf + sum.er_pf, sum.er_pf > 0 ? "PF payable (employee + employer share)" : "PF withheld");
  credit(heads.esiPayable, sum.esi + sum.er_esi, sum.er_esi > 0 ? "ESI payable (employee + employer share)" : "ESI withheld");
  credit(heads.ptPayable, sum.pt, "Professional tax withheld");
  credit(heads.tdsPayable, sum.tds, "TDS on salary withheld");
  credit(heads.employeeAdvance, sum.loan, "Staff advance recovered from pay");
  let dr = 0, cr = 0;
  for (const g of legs) {
    if (g.drCr === "Dr") dr += g.amountMinor;
    else cr += g.amountMinor;
  }
  if (dr !== cr) return { ok: false, code: "PAY-POST-IMBALANCE", message: `legs do not balance: Dr ${dr} \u2260 Cr ${cr}` };
  return { ok: true, legs, expenseMinor, netMinor, deductionsMinor };
}
function buildRunPayment(netMinor, salaryPayable, paidFrom, newId = () => crypto.randomUUID()) {
  if (!isMinor(netMinor)) return { ok: false, code: "PAY-POST-INPUT", message: "amount must be whole paise \u2265 0" };
  if (netMinor <= 0) return { ok: false, code: "PAY-POST-NOTHING", message: "nothing to pay (zero net)" };
  return {
    ok: true,
    expenseMinor: netMinor,
    netMinor,
    deductionsMinor: 0,
    legs: [
      { id: newId(), accountId: salaryPayable, drCr: "Dr", amountMinor: netMinor, narration: "Clear salaries payable" },
      { id: newId(), accountId: paidFrom, drCr: "Cr", amountMinor: netMinor, narration: "Net salaries paid" }
    ]
  };
}
var PAYROLL_ROLES = {
  salaryExpense: "salary.expense",
  salaryPayable: "salary.payable",
  pfPayable: "pf.payable",
  esiPayable: "esi.payable",
  ptPayable: "professional_tax.payable",
  tdsPayable: "tds.payable",
  employeeAdvance: "employee.advance",
  pfEmployerExpense: "pf.employer_expense",
  esiEmployerExpense: "esi.employer_expense"
};
function headsFromRoles(rows) {
  const by = new Map(rows.map((r) => [r.role, r.account_id]));
  const h = {};
  const set = (k, role) => {
    const v = by.get(role);
    if (v) h[k] = v;
  };
  set("salaryExpense", PAYROLL_ROLES.salaryExpense);
  set("salaryPayable", PAYROLL_ROLES.salaryPayable);
  set("pfPayable", PAYROLL_ROLES.pfPayable);
  set("esiPayable", PAYROLL_ROLES.esiPayable);
  set("ptPayable", PAYROLL_ROLES.ptPayable);
  set("tdsPayable", PAYROLL_ROLES.tdsPayable);
  set("employeeAdvance", PAYROLL_ROLES.employeeAdvance);
  set("pfEmployerExpense", PAYROLL_ROLES.pfEmployerExpense);
  set("esiEmployerExpense", PAYROLL_ROLES.esiEmployerExpense);
  return h;
}
function payrollDocIds(runId) {
  return {
    accrualVoucherId: `payrun-${runId}-accrual`,
    accrualEventId: `payrun-${runId}-accrual-posted`,
    paymentVoucherId: `payrun-${runId}-payment`,
    paymentEventId: `payrun-${runId}-payment-posted`
  };
}
var rupees = (minor) => minor / 100;
function makePostVoucherPayload(i) {
  const drLegs = i.legs.filter((l) => l.drCr === "Dr");
  const crLegs = i.legs.filter((l) => l.drCr === "Cr");
  const totalMinor = drLegs.reduce((s, l) => s + l.amountMinor, 0);
  const p_voucher = {
    id: i.id,
    voucherNo: i.voucherNo,
    type: i.type,
    date: i.date,
    debitAccountId: drLegs[0]?.accountId ?? "",
    creditAccountId: crLegs[0]?.accountId ?? "",
    amount: rupees(totalMinor),
    narration: i.narration,
    createdBy: i.createdBy,
    createdAt: i.occurredAt,
    approvalStatus: "approved",
    memberId: "",
    branchId: "",
    lines: i.legs.map((l) => ({ id: l.id, accountId: l.accountId, type: l.drCr, amount: rupees(l.amountMinor) }))
  };
  const p_lines = i.legs.map((l) => ({ id: l.id, accountId: l.accountId, drCr: l.drCr, amountMinor: l.amountMinor, narration: l.narration }));
  const p_event = {
    event_id: i.eventId,
    event_type: "voucher.posted",
    schema_version: 1,
    aggregate_type: "voucher",
    aggregate_id: i.id,
    sequence: 1,
    occurred_at: i.occurredAt,
    producer_kind: "human",
    producer_id: i.createdBy,
    on_behalf_of: null,
    payload: {
      lines: i.legs.map((l) => ({ accountId: l.accountId, drCr: l.drCr, amountMinor: l.amountMinor })),
      voucherNo: i.voucherNo,
      type: i.type,
      amount: rupees(totalMinor),
      date: i.date,
      narration: i.narration,
      createdAt: i.occurredAt,
      memberId: "",
      branchId: "",
      createdBy: i.createdBy
    }
  };
  return { p_voucher, p_lines, p_event };
}

// src/lib/ledger/postVoucherMessages.ts
function postVoucherErrorCode(message) {
  const m = String(message ?? "").match(/post_voucher:(\w+)/);
  return m ? m[1] : null;
}
var MESSAGES = {
  not_a_society_user: "\u0906\u092A\u0915\u093E login \u0915\u093F\u0938\u0940 \u0938\u092E\u093F\u0924\u093F \u0938\u0947 \u091C\u0941\u0921\u093C\u093E \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
  no_role_claim: "\u0906\u092A\u0915\u0940 \u092D\u0942\u092E\u093F\u0915\u093E (role) \u092A\u0924\u093E \u0928\u0939\u0940\u0902 \u091A\u0932\u0940 \u2014 \u090F\u0915 \u092C\u093E\u0930 logout \u0915\u0930\u0915\u0947 \u092B\u093F\u0930 login \u0915\u0930\u0947\u0902\u0964",
  role_cannot_write: "\u0906\u092A\u0915\u0940 \u092D\u0942\u092E\u093F\u0915\u093E \u0915\u094B \u0935\u093E\u0909\u091A\u0930 \u092C\u0928\u093E\u0928\u0947 \u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
  fy_locked: "\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937 audit-locked \u0939\u0948 \u2014 \u0935\u093E\u0909\u091A\u0930 \u0928\u0939\u0940\u0902 \u092C\u0928 \u0938\u0915\u0924\u093E\u0964",
  period_locked: "\u092F\u0939 \u0924\u093E\u0930\u0940\u0916\u093C \u0932\u0949\u0915 \u0939\u0941\u0908 \u0905\u0935\u0927\u093F \u092E\u0947\u0902 \u0939\u0948 \u2014 \u0935\u093E\u0909\u091A\u0930 \u0928\u0939\u0940\u0902 \u092C\u0928 \u0938\u0915\u0924\u093E\u0964",
  no_open_fy_for_date: "\u092F\u0939 \u0924\u093E\u0930\u0940\u0916\u093C \u091A\u093E\u0932\u0942 (\u0916\u0941\u0932\u0947) \u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937 \u092E\u0947\u0902 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
  unbalanced: "\u0928\u093E\u092E (Dr) \u0914\u0930 \u091C\u092E\u093E (Cr) \u092C\u0930\u093E\u092C\u0930 \u0928\u0939\u0940\u0902 \u0939\u0948\u0902\u0964",
  too_few_legs: "\u0935\u093E\u0909\u091A\u0930 \u092E\u0947\u0902 \u0915\u092E \u0938\u0947 \u0915\u092E \u0926\u094B \u092A\u0902\u0915\u094D\u0924\u093F\u092F\u093E\u0901 \u091A\u093E\u0939\u093F\u090F\u0964",
  negative_amount: "\u0930\u093E\u0936\u093F \u090B\u0923\u093E\u0924\u094D\u092E\u0915 \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u0924\u0940\u0964",
  legs_do_not_match_voucher: "\u092A\u0902\u0915\u094D\u0924\u093F\u092F\u094B\u0902 \u0915\u093E \u091C\u094B\u0921\u093C \u0935\u093E\u0909\u091A\u0930 \u0915\u0940 \u0930\u093E\u0936\u093F \u0938\u0947 \u092E\u0947\u0932 \u0928\u0939\u0940\u0902 \u0916\u093E\u0924\u093E\u0964",
  event_lines_differ: "\u0935\u093E\u0909\u091A\u0930 \u0915\u0940 \u092A\u0902\u0915\u094D\u0924\u093F\u092F\u093E\u0901 \u0914\u0930 \u092C\u0939\u0940 \u0915\u0940 entry \u092E\u0947\u0932 \u0928\u0939\u0940\u0902 \u0916\u093E\u0924\u0940\u0902\u0964",
  bad_event: "\u092C\u0939\u0940 \u0915\u0940 entry \u0938\u0939\u0940 \u0928\u0939\u0940\u0902 \u092C\u0928\u0940\u0964",
  pending_not_supported: "\u0938\u094D\u0935\u0940\u0915\u0943\u0924\u093F \u0915\u0947 \u0932\u093F\u090F \u0930\u0941\u0915\u093E \u0935\u093E\u0909\u091A\u0930 \u0905\u092D\u0940 \u0907\u0938 \u0930\u093E\u0938\u094D\u0924\u0947 \u0938\u0947 \u0928\u0939\u0940\u0902 \u092C\u0928\u0924\u093E\u0964",
  voucher_id_taken: "\u092F\u0939 \u0935\u093E\u0909\u091A\u0930 id \u092A\u0939\u0932\u0947 \u0938\u0947 \u0915\u093F\u0938\u0940 \u0914\u0930 \u0915\u093E \u0939\u0948\u0964",
  role_cannot_delete: "\u0906\u092A\u0915\u0940 \u092D\u0942\u092E\u093F\u0915\u093E \u0915\u094B \u0935\u093E\u0909\u091A\u0930 \u0930\u0926\u094D\u0926 \u0915\u0930\u0928\u0947 \u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
  voucher_not_found: "\u092F\u0939 \u0935\u093E\u0909\u091A\u0930 cloud \u092A\u0930 \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u093E \u2014 page refresh \u0915\u0930\u0947\u0902\u0964",
  voucher_cancelled: "\u092F\u0939 \u0935\u093E\u0909\u091A\u0930 \u0930\u0926\u094D\u0926 \u0939\u094B \u091A\u0941\u0915\u093E \u0939\u0948 \u2014 \u092C\u0926\u0932\u093E \u0928\u0939\u0940\u0902 \u091C\u093E \u0938\u0915\u0924\u093E\u0964",
  voucher_reversed: "\u092F\u0939 \u0935\u093E\u0909\u091A\u0930 reverse \u0939\u094B \u091A\u0941\u0915\u093E \u0939\u0948 \u2014 \u092C\u0926\u0932\u093E \u092F\u093E \u0930\u0926\u094D\u0926 \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u0924\u093E\u0964",
  voucher_is_reversal: "\u092F\u0939 reversal \u0935\u093E\u0909\u091A\u0930 \u0939\u0948 \u2014 \u092E\u0942\u0932 \u0935\u093E\u0909\u091A\u0930 \u0915\u0947 \u092C\u0930\u093E\u092C\u0930 \u0930\u0939\u0928\u093E \u091A\u093E\u0939\u093F\u090F, edit \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u0924\u093E\u0964",
  engine_voucher: "\u0938\u093F\u0938\u094D\u091F\u092E (engine) \u0935\u093E\u0909\u091A\u0930 \u2014 \u0938\u0941\u0927\u093E\u0930 \u0915\u0947\u0935\u0932 reversal \u0938\u0947 \u0939\u094B\u0924\u093E \u0939\u0948\u0964",
  voucher_in_closed_fy: "\u092F\u0939 \u0935\u093E\u0909\u091A\u0930 \u092C\u0902\u0926 \u0935\u093F\u0924\u094D\u0924\u0940\u092F \u0935\u0930\u094D\u0937 \u0915\u093E \u0939\u0948 \u2014 \u092C\u0926\u0932\u093E \u092F\u093E \u0930\u0926\u094D\u0926 \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u0924\u093E\u0964",
  self_approval: "\u0906\u092A \u0905\u092A\u0928\u093E \u0939\u0940 \u092C\u0928\u093E\u092F\u093E \u0935\u093E\u0909\u091A\u0930 approve \u0928\u0939\u0940\u0902 \u0915\u0930 \u0938\u0915\u0924\u0947 \u2014 \u0915\u094B\u0908 \u0926\u0942\u0938\u0930\u093E \u0905\u0927\u093F\u0915\u093E\u0930\u0940 approve \u0915\u0930\u0947\u0964",
  not_pending: "\u092F\u0939 \u0935\u093E\u0909\u091A\u0930 \u0938\u094D\u0935\u0940\u0915\u0943\u0924\u093F \u0915\u0947 \u0932\u093F\u090F \u0930\u0941\u0915\u093E \u0939\u0941\u0906 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964"
};
function postVoucherMessage(code, raw) {
  const hi = code && MESSAGES[code];
  return hi ? `${hi} (${code})` : `Cloud \u0928\u0947 \u0935\u093E\u0909\u091A\u0930 \u092E\u0928\u093E \u0915\u093F\u092F\u093E \u2014 ${raw ?? "unknown error"}`;
}

// src/lib/rules/incomeTax.ts
var FY_2024_25 = {
  fy: "FY 2024-25",
  effectiveFrom: "2024-04-01",
  effectiveTo: "2025-04-01",
  new: [[3e5, 0], [7e5, 0.05], [1e6, 0.1], [12e5, 0.15], [15e5, 0.2], [Infinity, 0.3]],
  old: [[25e4, 0], [5e5, 0.05], [1e6, 0.2], [Infinity, 0.3]],
  stdDeduction: { new: 75e3, old: 5e4 },
  rebateLimit: { new: 7e5, old: 5e5 },
  cess: 1.04,
  verified: false,
  cite: "Income-tax Act s.115BAC / Finance Act 2024 \u2014 VERIFY against the current Finance Act"
};
var FY_2025_26 = {
  fy: "FY 2025-26",
  effectiveFrom: "2025-04-01",
  effectiveTo: "2026-04-01",
  // SOURCED — incometax.gov.in, arithmetic reconciled (see above).
  new: [[4e5, 0], [8e5, 0.05], [12e5, 0.1], [16e5, 0.15], [2e6, 0.2], [24e5, 0.25], [Infinity, 0.3]],
  // CARRIED OVER from FY 2024-25 — NOT sourced. Verify before relying on it.
  old: [[25e4, 0], [5e5, 0.05], [1e6, 0.2], [Infinity, 0.3]],
  // CARRIED OVER — the ITD page does not state the standard deduction. Sources conflict.
  stdDeduction: { new: 75e3, old: 5e4 },
  // SOURCED — "Rebate Limit: ₹60,000 … Taxable income shall not exceed 12,00,000".
  rebateLimit: { new: 12e5, old: 5e5 },
  // SOURCED — "4% to be paid on the amount of income tax plus Surcharge (if any)".
  cess: 1.04,
  verified: false,
  cite: "incometax.gov.in AY 2026-27 (new regime slabs + 87A + cess SOURCED; standard deduction & old-regime slabs CARRIED OVER, unsourced) \u2014 VERIFY"
};
var FY_2026_27 = {
  fy: "FY 2026-27",
  effectiveFrom: "2026-04-01",
  effectiveTo: "2027-04-01",
  new: [[4e5, 0], [8e5, 0.05], [12e5, 0.1], [16e5, 0.15], [2e6, 0.2], [24e5, 0.25], [Infinity, 0.3]],
  old: [[25e4, 0], [5e5, 0.05], [1e6, 0.2], [Infinity, 0.3]],
  stdDeduction: { new: 75e3, old: 5e4 },
  rebateLimit: { new: 12e5, old: 5e5 },
  cess: 1.04,
  verified: true,
  cite: "Income-tax Act 2025 (in force 1-4-2026) \u2014 new-regime slabs, std deduction \u20B975,000, s.87A rebate \u20B960,000 up to \u20B912,00,000 taxable, cess 4%. Confirmed by the society's CA against docs/CA-VERIFICATION-2026-07.md on 2026-07-16; slabs independently corroborated against incometax.gov.in (AY 2026-27), which the CA states carry forward unchanged."
};
var SLAB_SETS = [FY_2026_27, FY_2025_26, FY_2024_25];
function resolveTaxBasis(asOf) {
  const t = Date.parse(asOf);
  if (!Number.isNaN(t)) {
    for (const s of SLAB_SETS) {
      if (t >= Date.parse(s.effectiveFrom) && t < Date.parse(s.effectiveTo)) {
        return { set: s, stale: false, asOf };
      }
    }
  }
  return { set: SLAB_SETS[0], stale: true, asOf };
}

// src/lib/tdsProjection.ts
var r0 = (n) => Math.round(n);
var todayIso = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
function slabTax(taxable, slabs) {
  let tax = 0, prev = 0;
  for (const [limit, rate] of slabs) {
    if (taxable <= prev) break;
    tax += (Math.min(taxable, limit) - prev) * rate;
    prev = limit;
  }
  return tax;
}
function annualIncomeTax(grossAnnual, regime, otherDeductions = 0, asOf) {
  return annualIncomeTaxWithBasis(grossAnnual, regime, otherDeductions, asOf).tax;
}
function annualIncomeTaxWithBasis(grossAnnual, regime, otherDeductions = 0, asOf) {
  const basis = resolveTaxBasis(asOf || todayIso());
  const s = basis.set;
  const gross = Math.max(0, grossAnnual || 0);
  const std = s.stdDeduction[regime];
  const deductions = regime === "old" ? Math.max(0, otherDeductions || 0) : 0;
  const taxable = Math.max(0, gross - std - deductions);
  let tax = slabTax(taxable, s[regime]);
  if (taxable <= s.rebateLimit[regime]) tax = 0;
  return { tax: r0(tax * s.cess), basis };
}

// src/lib/payroll/cumulativeTds.ts
function cumulativeMonthlyTds(input) {
  const annualTax = annualIncomeTax(
    Math.max(0, input.annualGross || 0),
    input.regime,
    input.otherDeductions || 0,
    input.asOf
  );
  const ytdDeducted = Math.max(0, input.ytdDeducted || 0);
  const months = Math.max(1, Math.floor(input.monthsRemaining || 1));
  const remaining = annualTax - ytdDeducted;
  if (remaining <= 0) {
    return { tds: 0, annualTax, ytdDeducted, balance: 0, excess: ytdDeducted - annualTax };
  }
  return { tds: Math.round(remaining / months), annualTax, ytdDeducted, balance: remaining, excess: 0 };
}
function monthsLeftInFy(processingMonth) {
  const m = Number((processingMonth || "").slice(5, 7));
  if (!Number.isFinite(m) || m < 1 || m > 12) return 1;
  return m >= 4 ? 12 - (m - 4) : 4 - m;
}
function fyBounds(processingMonth) {
  const y = Number((processingMonth || "").slice(0, 4));
  const m = Number((processingMonth || "").slice(5, 7));
  const startYear = Number.isFinite(y) && Number.isFinite(m) && m >= 4 ? y : y - 1;
  const s = String(startYear);
  return {
    from: `${s}-04`,
    to: `${startYear + 1}-03`,
    label: `FY ${s}-${String(startYear + 1).slice(2)}`
  };
}

// src/lib/pay/tax/salaryTds.ts
var TDS_192_SIG = { params: ["Money", "Money", "Number"], ret: "Money" };
var TDS_192_NAME = "tds_192";
var TDS_YTD_HEAD = "TDS";
var TDS_FORMULAS = {
  TDS: 'formula "TDS" :: Money let g = (BASIC + DA + HRA) * 12 in tds_192(g, tax.ytd.TDS, tax.monthsRemaining)',
  TDS_NOHRA: 'formula "TDS_NOHRA" :: Money let g = (BASIC + DA) * 12 in tds_192(g, tax.ytd.TDS, tax.monthsRemaining)',
  TDS_DEP: 'formula "TDS_DEP" :: Money let g = (BASIC + DA + DEP_ALLOW) * 12 in tds_192(g, tax.ytd.TDS, tax.monthsRemaining)',
  TDS_CONSOL: 'formula "TDS_CONSOL" :: Money let g = CONSOLIDATED * 12 in tds_192(g, tax.ytd.TDS, tax.monthsRemaining)',
  TDS_STIPEND: 'formula "TDS_STIPEND" :: Money let g = STIPEND * 12 in tds_192(g, tax.ytd.TDS, tax.monthsRemaining)'
};
var isTdsCode = (code) => {
  const c = code.toUpperCase();
  return c === "TDS" || c.startsWith("TDS_");
};
var refuse = (code, msg) => {
  throw new RangeError(`${code}: ${msg}`);
};
var isMoney3 = (v) => !!v && typeof v === "object" && v.kind === "money";
function assertVerifiedLaw(regime, asOf) {
  const basis = resolveTaxBasis(asOf);
  if (basis.stale) refuse("PAY-TAX-503", `no income-tax slab set covers ${asOf} \u2014 refusing (it would be computed on ${basis.set.fy}'s law); enter TDS by hand`);
  if (regime === "old") refuse("PAY-TAX-502", "the OLD-regime slabs are not verified \u2014 refusing; enter TDS by hand or use the new regime");
  if (!basis.set.verified) refuse("PAY-TAX-501", `${basis.set.fy} slabs are not verified (carried over, unsourced) \u2014 refusing; enter TDS by hand`);
}
function makeTds192(ctx, onResult) {
  return (annual, ytd, months) => {
    assertVerifiedLaw(ctx.regime, ctx.asOf);
    if (!isMoney3(annual)) refuse("PAY-DSL-TYPE-015", "tds_192: the annual gross must be Money");
    const a = annual;
    if (a.currency !== ctx.currency) refuse("PAY-DSL-TYPE-011", `tds_192: currency mismatch (${a.currency} vs ${ctx.currency})`);
    if (ytd !== null && ytd !== void 0 && !isMoney3(ytd)) refuse("PAY-DSL-TYPE-015", "tds_192: year-to-date must be Money");
    if (typeof months !== "number" || !Number.isFinite(months)) refuse("PAY-DSL-TYPE-015", "tds_192: months remaining must be a Number");
    const rupees2 = cumulativeMonthlyTds({
      annualGross: a.minor / 100,
      regime: ctx.regime,
      ytdDeducted: isMoney3(ytd) ? ytd.minor / 100 : 0,
      monthsRemaining: months,
      asOf: ctx.asOf
    });
    const tdsMinor = Math.round(rupees2.tds * 100);
    if (onResult) {
      onResult({
        tdsMinor,
        annualTaxMinor: Math.round(rupees2.annualTax * 100),
        ytdMinor: Math.round(rupees2.ytdDeducted * 100),
        excessMinor: Math.round(rupees2.excess * 100)
      });
    }
    return makeMoney(tdsMinor, ctx.currency);
  };
}

// src/lib/rules/epfEsi.ts
var CARRIED = (what) => `CARRIED OVER from ${what}. No start date is established for this value (hence 1970-01-01, "always so far") and it is not sourced here \u2014 VERIFY against the Act / notification before relying on it.`;
var PARAMS = {
  "pf.wageCeiling": [
    {
      value: 25e3,
      effectiveFrom: "2026-09-17",
      verified: false,
      cite: 'EPFO "Frequently Asked Questions \u2014 Revision of EPFO Statutory Wage Ceiling, from \u20B915,000 to \u20B925,000 per month" (the document linked from https://unifiedportal-emp.epfindia.gov.in/epfo/ , whose own page says "FAQs related to recent revision of EPFO wage ceiling from Rs. 15,000 to Rs. 25,000"). Its header table: "S.O. 5109(E) dated 17 September 2026 | Effective Date 17 September 2026 | Revised Wage Ceiling \u20B925,000 per month | Earlier \u20B915,000". Read 2026-10-06 from the copy the founder supplied (EPFO_Wage_Ceiling.pdf, 13 pages, sha256 12e6074fd6f031d5412a511d6598ad24d3c8f80ee062abe6eac9994bb16fd591). Applies to EPF, EPS and EDLI (Q5). A part-month is split by days at 17.09.2026 (Q7, Q9). Above the ceiling the statutory contribution is generally restricted to the ceiling unless the employee already contributes on higher wages (Q21, Q22). PF wages = Basic + DA + Retaining Allowance, not gross (Q24-Q26). NOT yet read: the Gazette text of S.O. 5109(E) itself \u2014 a person must confirm against it before this is marked verified.'
    },
    {
      value: 15e3,
      effectiveFrom: "1970-01-01",
      verified: false,
      cite: CARRIED("the Salary page constant PF_CEILING (lib/payrollStatutory.ts)") + ' The EPFO FAQ above confirms it was the ceiling until 16.09.2026 ("remained unchanged at \u20B915,000 since September 2014", Q4) \u2014 but no start date is entered.'
    }
  ],
  "pf.employeeRate": [
    { value: 12, effectiveFrom: "1970-01-01", verified: false, cite: CARRIED("the Salary page (employee PF 12% of min(basic, ceiling))") }
  ],
  "pf.employerRate": [
    { value: 13, effectiveFrom: "1970-01-01", verified: false, cite: CARRIED("the Salary page (employer PF 13% = 12% + 1% admin/EDLI)") }
  ],
  "epf.employerRate": [
    { value: 12, effectiveFrom: "1970-01-01", verified: false, cite: CARRIED("the Payroll engine seed employer_pf_rate (EPS + EPF split)") }
  ],
  "eps.rate": [
    { value: 8.33, effectiveFrom: "1970-01-01", verified: false, cite: CARRIED("the Payroll engine seed eps_rate (EPS share of EPS wages)") }
  ],
  "edli.rate": [
    { value: 0.5, effectiveFrom: "1970-01-01", verified: false, cite: CARRIED("the Payroll engine seed edli_rate") }
  ],
  "esi.wageLimit": [
    {
      value: 21e3,
      effectiveFrom: "2017-01-01",
      verified: false,
      cite: 'ESIC coverage page https://esic.gov.in/coverage \u2014 read 2026-10-06 by an automated fetch, which quotes: "The existing wage limit for coverage under the Act, effective from 01.01.2017, is Rs.21,000/- per month (Rs.25,000/- per month in the case of Persons with Disability)." The date and figure agree with the code; a PERSON must still sign it off before it is marked verified. CONFIRMED again in ESIC "A Guide For Employers", section 1 (Coverage of Employee): "\u2026drawing wages up to Rs. 21000/- per month (Rs.25,000/- for Persons with Disability) is covered under the Act" (file and sha256 as in esi.employeeRate; the guide is undated). Not entered: the \u20B925,000 limit for persons with disability (the Salary page has no such case).'
    }
  ],
  "esi.employeeRate": [
    {
      value: 0.75,
      effectiveFrom: "1970-01-01",
      verified: false,
      cite: CARRIED("the Salary page (employee ESI 0.75% of gross)") + ` CONFIRMED in ESIC "A Guide For Employers", section 6 (ESIC Contributions): "The rate of contribution equals to 4 percent of the wages payable to an employee, out of which 3.25 percent is the employers' share and 0.75 percent is the employees' share." Read 2026-10-06 from the copy the founder supplied (ESI.pdf, 12 pages, sha256 f63e11d822fbefd15285a8ac5b791101b40d4ff8ebba9fa8e43893a53a8f464c) \u2014 the guide carries its own disclaimer that it "may not reflect the most current developments", and it is undated, so the start date is not entered.`
    }
  ],
  "esi.employerRate": [
    {
      value: 3.25,
      effectiveFrom: "1970-01-01",
      verified: false,
      cite: CARRIED("the Salary page (employer ESI 3.25% of gross)") + " CONFIRMED in the same ESIC Employers' Guide, section 6 (see esi.employeeRate for the quotation, file and sha256)."
    }
  ],
  "esi.dailyWageExempt": [
    // not used by any calculation yet (the Salary page has no such case) — recorded now, with its source, for the ESI component
    {
      value: 176,
      effectiveFrom: "1970-01-01",
      verified: false,
      cite: `ESIC "A Guide For Employers", section 6: "Employees in receipt of a daily average wage up to Rs.176/- are exempted from payment of contribution. (No deduction of Employees' share of contribution from employee's salary/wages). Employers will, however, pay their own share in respect of these employees." File and sha256 as in esi.employeeRate; undated guide, so no start date is entered. NOT USED by any calculation yet.`
    }
  ]
};
function resolveParam(key, asOf) {
  return resolveRows(PARAMS[key], asOf);
}
function resolveRows(rows, asOf) {
  const t = Date.parse(asOf);
  if (!Number.isNaN(t)) {
    for (const r of rows) {
      if (t >= Date.parse(r.effectiveFrom)) return { value: r.value, row: r, stale: false, asOf };
    }
  }
  return { value: rows[0].value, row: rows[0], stale: true, asOf };
}
var dayIso = (monthStart, d) => `${monthStart.slice(0, 8)}${String(d).padStart(2, "0")}`;
function daysInMonthOf(monthStart) {
  if (typeof monthStart !== "string") return NaN;
  const y = Number(monthStart.slice(0, 4)), m = Number(monthStart.slice(5, 7));
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return NaN;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function resolveMonthSegments(key, monthStart) {
  const n = daysInMonthOf(monthStart);
  if (typeof monthStart !== "string" || !Number.isFinite(n) || !/^\d{4}-\d{2}-01$/.test(monthStart)) {
    const r = resolveRows(PARAMS[key], monthStart);
    return [{ from: monthStart, to: monthStart, days: 1, value: r.value, stale: true }];
  }
  const cuts = [...new Set(
    PARAMS[key].map((r) => r.effectiveFrom).filter((d) => d > monthStart && d <= dayIso(monthStart, n))
  )].sort();
  const starts = [monthStart, ...cuts];
  return starts.map((from, i) => {
    const toDay = i + 1 < starts.length ? Number(starts[i + 1].slice(8, 10)) - 1 : n;
    const startDay = Number(from.slice(8, 10));
    const r = resolveRows(PARAMS[key], from);
    return { from, to: dayIso(monthStart, toDay), days: toDay - startDay + 1, value: r.value, stale: r.stale };
  });
}
function resolveStatutory(asOf) {
  const keys = Object.keys(PARAMS);
  const r = Object.fromEntries(keys.map((k) => [k, resolveParam(k, asOf)]));
  const pfCeilingSegments = resolveMonthSegments("pf.wageCeiling", asOf);
  return {
    pfWageCeiling: r["pf.wageCeiling"].value,
    pfCeilingSegments,
    pfEmployeeRate: r["pf.employeeRate"].value,
    pfEmployerRate: r["pf.employerRate"].value,
    esiWageLimit: r["esi.wageLimit"].value,
    esiEmployeeRate: r["esi.employeeRate"].value,
    esiEmployerRate: r["esi.employerRate"].value,
    unverified: keys.filter((k) => !r[k].row.verified),
    // a segment can be stale even when the first day is not (it cannot today, but the two answers must agree on principle)
    stale: [.../* @__PURE__ */ new Set([...keys.filter((k) => r[k].stale), ...pfCeilingSegments.some((g) => g.stale) ? ["pf.wageCeiling"] : []])]
  };
}

// src/lib/pay/statutory/pfWage.ts
var PF_WAGE_SIG = { params: ["Money"], ret: "Money" };
var PF_WAGE_NAME = "pf_wage";
function refuse2(code, msg) {
  throw Object.assign(new RangeError(`${code}: ${msg}`), { code });
}
function makePfWage(ctx) {
  const segments = resolveMonthSegments("pf.wageCeiling", ctx.asOf);
  const monthDays = segments.reduce((s, g) => s + g.days, 0);
  return (wage) => {
    const w = wage;
    if (!w || w.kind !== "money") refuse2("PAY-DSL-TYPE-015", "pf_wage: the wage must be Money");
    if (w.currency !== ctx.currency) refuse2("PAY-DSL-TYPE-011", `pf_wage: currency mismatch (${w.currency} vs ${ctx.currency})`);
    if (!(monthDays > 0)) refuse2("PAY-PF-501", `pf_wage: no PF ceiling segments for ${ctx.asOf}`);
    let minor = 0;
    for (const g of segments) minor += Math.min(w.minor, Math.round(g.value * 100)) * g.days;
    return makeMoney(Math.round(minor / monthDays), ctx.currency);
  };
}

// src/lib/pay/statutory/esiWage.ts
var ESI_EMPLOYEE_SIG = { params: ["Money", "Number"], ret: "Money" };
var ESI_EMPLOYEE_NAME = "esi_employee";
var ESI_FORMULAS = {
  ESI: 'formula "ESI" :: Money let w = BASIC + DA + HRA - LOP in esi_employee(w, attendance.paidDays)',
  ESI_NOHRA: 'formula "ESI_NOHRA" :: Money let w = BASIC + DA - LOP_NOHRA in esi_employee(w, attendance.paidDays)',
  ESI_DEP: 'formula "ESI_DEP" :: Money let w = BASIC + DA + DEP_ALLOW - LOP_DEP in esi_employee(w, attendance.paidDays)',
  ESI_CONSOL: 'formula "ESI_CONSOL" :: Money let w = CONSOLIDATED - LOP_CONSOL in esi_employee(w, attendance.paidDays)',
  ESI_STIPEND: 'formula "ESI_STIPEND" :: Money let w = STIPEND - LOP_STIPEND in esi_employee(w, attendance.paidDays)'
};
var ESI_CODE_BY_TYPE = {
  permanent: "ESI",
  probation: "ESI",
  seasonal: "ESI_NOHRA",
  fixedterm: "ESI_NOHRA",
  deputation: "ESI_DEP",
  contract: "ESI_CONSOL",
  honorary: "ESI_CONSOL",
  parttime: "ESI_CONSOL",
  consultant: "ESI_CONSOL",
  apprentice: "ESI_STIPEND"
};
var isEsiCode = (code) => {
  const c = code.toUpperCase();
  return c === "ESI" || c.startsWith("ESI_");
};
function refuse3(code, msg) {
  throw Object.assign(new RangeError(`${code}: ${msg}`), { code });
}
function makeEsiEmployee(ctx) {
  const limitMinor = Math.round(resolveParam("esi.wageLimit", ctx.asOf).value * 100);
  const ratePct = resolveParam("esi.employeeRate", ctx.asOf).value;
  const dailyExempt = resolveParam("esi.dailyWageExempt", ctx.asOf).value;
  return (wage, paidDays) => {
    const w = wage;
    if (!w || w.kind !== "money") refuse3("PAY-DSL-TYPE-015", "esi_employee: the wage must be Money");
    if (w.currency !== ctx.currency) refuse3("PAY-DSL-TYPE-011", `esi_employee: currency mismatch (${w.currency} vs ${ctx.currency})`);
    if (typeof paidDays !== "number" || !Number.isFinite(paidDays)) refuse3("PAY-DSL-TYPE-015", "esi_employee: paid days must be a Number");
    if (w.minor <= 0 || w.minor > limitMinor) return makeMoney(0, ctx.currency);
    if (paidDays > 0 && w.minor / 100 / paidDays <= dailyExempt) return makeMoney(0, ctx.currency);
    return makeMoney(applyPercent(w.minor, ratePct).minor, ctx.currency);
  };
}

// src/lib/pay/statutory/employerShare.ts
var ER_PF_CODE = "ER_PF";
var ER_PF_RATE_VAR = "employer_pf_total_rate";
var ESI_EMPLOYER_SIG = { params: ["Money", "Number"], ret: "Money" };
var ESI_EMPLOYER_NAME = "esi_employer";
var ER_FORMULAS = {
  ER_PF: 'formula "ER_PF" :: Money let w = pf_wage(BASIC * 120%) in w * (employer_pf_total_rate / 100) * ((30 - attendance.lopDays) / 30)',
  ER_ESI: 'formula "ER_ESI" :: Money let w = BASIC + DA + HRA - LOP in esi_employer(w, attendance.paidDays)',
  ER_ESI_NOHRA: 'formula "ER_ESI_NOHRA" :: Money let w = BASIC + DA - LOP_NOHRA in esi_employer(w, attendance.paidDays)',
  ER_ESI_DEP: 'formula "ER_ESI_DEP" :: Money let w = BASIC + DA + DEP_ALLOW - LOP_DEP in esi_employer(w, attendance.paidDays)',
  ER_ESI_CONSOL: 'formula "ER_ESI_CONSOL" :: Money let w = CONSOLIDATED - LOP_CONSOL in esi_employer(w, attendance.paidDays)',
  ER_ESI_STIPEND: 'formula "ER_ESI_STIPEND" :: Money let w = STIPEND - LOP_STIPEND in esi_employer(w, attendance.paidDays)'
};
var ER_ESI_CODE_BY_TYPE = Object.fromEntries(
  Object.entries(ESI_CODE_BY_TYPE).map(([type, code]) => [type, "ER_" + code])
);
var isErCode = (code) => {
  const c = code.toUpperCase();
  return c === "ER_PF" || c === "ER_ESI" || c.startsWith("ER_ESI_");
};
function refuse4(code, msg) {
  throw Object.assign(new RangeError(`${code}: ${msg}`), { code });
}
function makeEsiEmployer(ctx) {
  const limitMinor = Math.round(resolveParam("esi.wageLimit", ctx.asOf).value * 100);
  const ratePct = resolveParam("esi.employerRate", ctx.asOf).value;
  return (wage, paidDays) => {
    const w = wage;
    if (!w || w.kind !== "money") refuse4("PAY-DSL-TYPE-015", "esi_employer: the wage must be Money");
    if (w.currency !== ctx.currency) refuse4("PAY-DSL-TYPE-011", `esi_employer: currency mismatch (${w.currency} vs ${ctx.currency})`);
    if (typeof paidDays !== "number" || !Number.isFinite(paidDays)) refuse4("PAY-DSL-TYPE-015", "esi_employer: paid days must be a Number");
    if (w.minor <= 0 || w.minor > limitMinor) return makeMoney(0, ctx.currency);
    return makeMoney(applyPercent(w.minor, ratePct).minor, ctx.currency);
  };
}
export {
  ER_ESI_CODE_BY_TYPE,
  ER_FORMULAS,
  ER_PF_CODE,
  ER_PF_RATE_VAR,
  ESI_CODE_BY_TYPE,
  ESI_EMPLOYEE_NAME,
  ESI_EMPLOYEE_SIG,
  ESI_EMPLOYER_NAME,
  ESI_EMPLOYER_SIG,
  ESI_FORMULAS,
  PAYROLL_ROLES,
  PF_WAGE_NAME,
  PF_WAGE_SIG,
  TDS_192_NAME,
  TDS_192_SIG,
  TDS_FORMULAS,
  TDS_YTD_HEAD,
  assembleRun,
  assertVerifiedLaw,
  buildRunAccrual,
  buildRunPayment,
  canTransition,
  freezeViews,
  fyBounds,
  headsFromRoles,
  isErCode,
  isEsiCode,
  isTdsCode,
  makeEsiEmployee,
  makeEsiEmployer,
  makeMoney,
  makePfWage,
  makePostVoucherPayload,
  makeTds192,
  mapCatalog,
  monthsLeftInFy,
  payrollDocIds,
  postVoucherErrorCode,
  postVoucherMessage,
  resolveParam,
  resolveStatutory,
  stateAfterEvent
};
