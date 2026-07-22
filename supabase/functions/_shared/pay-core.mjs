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
  const vars = { ...factsToEnv(inputs.facts, inputs.currency), ...inputs.fixedComponents };
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
var isMoney2 = (v) => !!v && typeof v === "object" && v.kind === "money";
function aggregatePayslip(values, spec) {
  const earnings = [];
  const deductions = [];
  let grossEarningsMinor = 0;
  let grossDeductionsMinor = 0;
  for (const code of Object.keys(values)) {
    if (spec.classification[code] === void 0) {
      throw new RangeError(`PAY-CAL-601: component '${code}' is computed but unclassified (earning/deduction/info required)`);
    }
  }
  const pool = { ...spec.fixedComponents ?? {}, ...values };
  for (const [code, side] of Object.entries(spec.classification)) {
    if (side === "info") continue;
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
    const line = { code, side, amount: makeMoney(clamp.value, spec.currency), clamped: clamp.clamped };
    if (side === "earning") {
      earnings.push(line);
      grossEarningsMinor += clamp.value;
    } else {
      deductions.push(line);
      grossDeductionsMinor += clamp.value;
    }
  }
  return {
    currency: spec.currency,
    earnings,
    deductions,
    grossEarnings: makeMoney(grossEarningsMinor, spec.currency),
    grossDeductions: makeMoney(grossDeductionsMinor, spec.currency),
    netPay: makeMoney(grossEarningsMinor - grossDeductionsMinor, spec.currency)
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
export {
  assembleRun,
  freezeViews,
  makeMoney,
  mapCatalog
};
