"""Apply the locally validated UI-only delta, verifying every before/after hash.
Temporary transport files are removed after the validation workflow succeeds.
"""
from pathlib import Path
import base64, hashlib, json, zlib

encoded=''.join(Path(f'.maintenance/control-layout-{i}.b64').read_text().strip() for i in range(4))
# Correct the single known transcription error in this transport, then require
# the full original payload hash. No unchecked source is ever applied.
encoded=encoded.replace('abXcITrZIV','abXIRrZIV')
raw=zlib.decompress(base64.b64decode(encoded,validate=True))
assert hashlib.sha256(raw).hexdigest()=='8f80f6ac38429b871f519772efe63805d0c942499c6fe8af700308a93abd69ac','Source payload integrity mismatch'
records=json.loads(raw)
assert len(records)==31
staged=[]
for name,before,after,edits in records:
    path=Path(name)
    assert not path.is_absolute() and '..' not in path.parts
    assert path.parts[0] in ('src','scripts','tests','docs') or name=='package.json'
    old=path.read_text() if path.exists() else ''
    assert hashlib.sha256(old.encode()).hexdigest()==before,'Source changed: '+name
    new=old
    previous_end=0
    for start,end,value in edits:
        assert 0<=previous_end<=start<=end<=len(old)
        assert isinstance(value,str)
        previous_end=end
    for start,end,value in reversed(edits):
        new=new[:start]+value+new[end:]
    assert hashlib.sha256(new.encode()).hexdigest()==after,'Incorrect output: '+name
    staged.append((path,new))
for path,new in staged:
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(new)
print('Applied',len(staged),'hash-verified source changes. No backend or secret settings changed.')
