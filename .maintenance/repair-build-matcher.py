from pathlib import Path
import json, shutil, hashlib
r=Path('.')
s=r/'node_modules/vite/node_modules/picomatch'
assert json.loads((s/'package.json').read_text())['version']=='4.0.7'
d=r/'vendor/picomatch-safe';d.mkdir(parents=True,exist_ok=True)
for name in ['index.js','posix.js','LICENSE','README.md']:
 if (s/name).exists():shutil.copy2(s/name,d/name)
shutil.copytree(s/'lib',d/'lib',dirs_exist_ok=True)
original={str(p.relative_to(s)):hashlib.sha256(p.read_bytes()).hexdigest() for p in s.rglob('*') if p.is_file()}
meta=json.loads((s/'package.json').read_text())
meta.update(name='@content-connect/picomatch-safe',version='4.0.7',private=True,description='Internal picomatch 4.0.7 fork: reject repeated extglobs before regex compilation (CVE-2026-112366)')
for k in ['scripts','devDependencies','funding']:meta.pop(k,None)
(d/'package.json').write_text(json.dumps(meta,indent=2)+'\n')
(d/'lib/safe-pattern.js').write_text('''"use strict";
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
    if (c === "\\\\") { escaped = true; continue; }
    if ((c === "+" || c === "*") && input[i + 1] === "(") {
      const error = new TypeError("Repeated extglob patterns are disabled by the build security policy. Use braces or explicit alternatives.");
      error.code = "ERR_UNSAFE_REPEATED_EXTGLOB";
      throw error;
    }
  }
};
''')
markers={'parse.js':['const parse = (input, options) => {','parse.fastpaths = (input, options) => {'],'scan.js':['const scan = (input, options) => {'],'picomatch.js':['picomatch.compileRe = (state, options, returnOutput = false, returnState = false) => {']}
for file,points in markers.items():
 p=d/'lib'/file;t=p.read_text().replace("'use strict';","'use strict';\nconst assertSafePattern = require('./safe-pattern');",1)
 for point in points:
  assert t.count(point)==1
  t=t.replace(point,point+'\n  assertSafePattern('+('state.input' if file=='picomatch.js' else 'input')+');')
 p.write_text(t)
(d/'UPSTREAM-HASHES.json').write_text(json.dumps(original,indent=2)+'\n')
(d/'SECURITY-PATCH.md').write_text('''# Internal build dependency remediation

Upstream: picomatch 4.0.7. Original MIT license retained. This is NOT an upstream patched release.
Advisory: https://github.com/advisories/GHSA-fc5q-39xc-vjpf

The scanner rejects every unescaped repeated extglob before compilation, including leading, trailing, nested and alternated variants. Ordinary globstars, wildcards, braces and non-repeating extglobs remain supported. Repeated extglobs are not used by the repository build configuration. A future use gets an explicit error instead of unsafe regex compilation or a broad match.

This private source-controlled fork has no install scripts or dependencies. UPSTREAM-HASHES.json records the original files. All transitive consumers use this one implementation. npm audit does not independently review private code: hostile-pattern tests, compatibility/build tests and source-hash tests must run alongside the unchanged registry audit. No advisory allowlist, audit suppression, or severity threshold change is used.

This is an interim maintained security patch, not proof against all possible regex denial of service. Replace it with a reviewed upstream fix when available; advanced regular expressions supplied by trusted build authors remain their responsibility. Do not use glob compilation on arbitrary public input.
''')
p=r/'package.json';j=json.loads(p.read_text());j['devDependencies']['picomatch']='file:vendor/picomatch-safe';j['overrides']['picomatch']='$picomatch';p.write_text(json.dumps(j,indent=2)+'\n')
p=r/'package-lock.json';j=json.loads(p.read_text());j['packages']={k:v for k,v in j['packages'].items() if not k.endswith('/picomatch') and k!='vendor/picomatch-safe'};p.write_text(json.dumps(j,indent=2)+'\n')
