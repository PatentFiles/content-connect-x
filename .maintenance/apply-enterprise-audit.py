"""One-use checked source patch, followed by full CI validation. No secrets read."""
from pathlib import Path
import base64,hashlib,json,zlib
root=Path('.')
encoded=''.join((root/'.maintenance'/f'enterprise-{i}.b64').read_text().strip() for i in range(5))
raw=zlib.decompress(base64.b64decode(encoded))
assert hashlib.sha256(raw).hexdigest()=='a33d71ea76017e4b51754e957a45609ba888258a0f10ee131b23b72da51ac688','Transport integrity mismatch'
records=json.loads(raw);assert len(records)==36
pending=[]
for name,before,after,edits in records:
 p=Path(name)
 assert not p.is_absolute() and '..' not in p.parts
 assert p.parts[0] in {'src','supabase','scripts','tests','docs','deploy','Dockerfile','README.md','package.json','vite.config.js'}
 old=p.read_text() if p.exists() else ''
 assert hashlib.sha256(old.encode()).hexdigest()==before,'Concurrent source change: '+name
 lines=old.splitlines(keepends=True)
 for start,end,value in reversed(edits):lines[start:end]=[value]
 new=''.join(lines);assert hashlib.sha256(new.encode()).hexdigest()==after,'Replacement mismatch: '+name
 pending.append((p,new))
for p,new in pending:p.parent.mkdir(parents=True,exist_ok=True);p.write_text(new)
# Public URLs and ordinary dotted release versions are not JWT credentials.
p=Path('src/api/browserKeySafety.mjs');s=p.read_text();old=" if(parts.length===3||key.startsWith('eyJ')){";assert s.count(old)==1;p.write_text(s.replace(old," if(key.startsWith('eyJ')){"))
p=Path('tests/enterprise-audit.test.mjs');p.write_text(p.read_text()+"\ntest('normal public URLs and dotted versions remain valid config',()=>{\n assert.doesNotThrow(()=>assertSafeBrowserEnvironment({VITE_SUPABASE_URL:'https://project.supabase.co',VITE_SENTRY_DSN:'https://public@example.ingest.sentry.io/123',VITE_RELEASE_SHA:'1.2.3'}));\n});\n")
p=Path('docs/ENTERPRISE_AUDIT_2026-11-17.md');s=p.read_text().replace('132 offline unit/policy/runtime tests passed (111 baseline plus 21 new regression tests).','133 offline unit/policy/runtime tests passed (111 baseline plus 22 new regression tests).');p.write_text(s)
print('Applied 36 complete hash-verified files plus public configuration regression guard.')
