/**
 * SEC-03 (migration 085) — does this access token still owe a 2FA code?
 *
 * The custom access token hook stamps `mfa_pending: true` on every token of an enrolled user whose
 * session has not passed the TOTP / recovery check. The server enforces it (every tenant / privilege
 * helper yields nothing for a pending token); the client reads it only to avoid showing a signed-in
 * shell over empty data.
 *
 * The payload is read WITHOUT verifying the signature — that is fine here, because the answer only
 * ever makes the client MORE restrictive (sign out / refuse to finish login); a forged "false" gains
 * nothing, since the server ignores what the client believes. An unreadable token counts as pending.
 */
export function isMfaPending(accessToken: string | null | undefined): boolean {
  if (!accessToken) return false;   // no session at all — nothing is pending
  try {
    const part = accessToken.split('.')[1];
    if (!part) return true;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const bin = atob(b64);
    const json = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
    return JSON.parse(json).mfa_pending === true;
  } catch {
    return true;
  }
}
