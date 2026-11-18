"use strict";
/**
 * Toolchain-only fail-closed guard for GHSA-fc5q-39xc-vjpf.
 * Repeated extglobs are not used by the checked-in build configuration.
 * Reject ALL unescaped +(body) / *(body), including nested/alternated bodies,
 * before regex compilation. This is a documented compatibility restriction,
 * not an upstream release. Escaped literals remain supported.
 */
module.exports = function assertSafePattern(input) {
  if (typeof input !== "string") return;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if ((c === "+" || c === "*") && input[i + 1] === "(") {
      const error = new TypeError("Repeated extglob patterns are disabled by the build security policy. Use braces or explicit alternatives.");
      error.code = "ERR_UNSAFE_REPEATED_EXTGLOB";
      throw error;
    }
  }
};
