/** Browser presentation only. The server-owned admission row remains authoritative. */
export const hasAdmission = entry => Boolean(entry?.admitted_at);
export const needsOptedInMfa = assurance => assurance?.currentLevel==='aal1' && assurance?.nextLevel==='aal2';
