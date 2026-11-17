"""One-use deterministic transport for already reviewed source changes.
No credentials or executable payload are carried in the JSON patch records.
"""
from pathlib import Path
import base64, hashlib, json, zlib
root=Path('.')
first=(root/'.maintenance/account-entry-0.b64').read_text().strip()
second=(root/'.maintenance/account-entry-1.b64').read_text().strip()
# Repair two known text-transport transcription errors; the full cryptographic
# checksum below is mandatory, so any other difference stops before a write.
second=second.replace('Ewv62nnZxxbg','Ewv62nZxxbg').replace('JAtGKSknuY','JAtDKSknuY')
tail=''.join((root/f'.maintenance/account-entry-tail-{i}.b64').read_text().strip() for i in range(7))
encoded=first+second+tail
assert len(encoded)==28944, f'Transport length mismatch: {len(encoded)}'
assert hashlib.sha256(encoded.encode()).hexdigest()=='1b34c8bba208d8193ba65199f76741058827c4044f2d10cc2a844f0591e22c42','Transport checksum mismatch'
records=json.loads(zlib.decompress(base64.b64decode(encoded,validate=True)))
staged=[]
for name,before,after,edits in records:
 path=Path(name)
 assert not path.is_absolute() and '..' not in path.parts
 assert path.parts[0] in ('src','supabase','scripts','tests','docs') or name in ('README.md','package.json')
 old=path.read_text() if path.exists() else ''
 assert hashlib.sha256(old.encode()).hexdigest()==before, 'Source changed: '+name
 lines=old.splitlines(keepends=True)
 for start,end,value in reversed(edits):
  assert 0<=start<=end<=len(lines)
  lines[start:end]=[value]
 new=''.join(lines)
 assert hashlib.sha256(new.encode()).hexdigest()==after, 'Output checksum mismatch: '+name
 staged.append((path,new))
for path,new in staged:
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(new)
print('Applied',len(staged),'hash-verified source files; no credentials accessed.')
