# Internal build dependency remediation

Upstream: picomatch 4.0.7. Original MIT license retained. This is NOT an upstream patched release.
Advisory: https://github.com/advisories/GHSA-fc5q-39xc-vjpf

The scanner rejects every unescaped repeated extglob before compilation, including leading, trailing, nested and alternated variants. Ordinary globstars, wildcards, braces and non-repeating extglobs remain supported. Repeated extglobs are not used by the repository build configuration. A future use gets an explicit error instead of unsafe regex compilation or a broad match.

This private source-controlled fork has no install scripts or dependencies. UPSTREAM-HASHES.json records the original files. All transitive consumers use this one implementation. npm audit does not independently review private code: hostile-pattern tests, compatibility/build tests and source-hash tests must run alongside the unchanged registry audit. No advisory allowlist, audit suppression, or severity threshold change is used.

This is an interim maintained security patch, not proof against all possible regex denial of service. Replace it with a reviewed upstream fix when available; advanced regular expressions supplied by trusted build authors remain their responsibility. Do not use glob compilation on arbitrary public input.
