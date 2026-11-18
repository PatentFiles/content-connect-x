"""One-use source update. Verify the entire delta and every input/output before writing."""
from pathlib import Path
import base64, hashlib, json, lzma
encoded=''.join(Path(f'.maintenance/workspace-delta-{i}.b64').read_text().strip() for i in range(5))
raw=lzma.decompress(base64.b64decode(encoded,validate=True))
assert hashlib.sha256(raw).hexdigest()=='da3855f3ce92ae4a9bfdeec0d858512c9a53fb7fff6aceee34486fab1c0d4d4d','Archive checksum mismatch'
records=json.loads(raw)
assert len(records)==23,'Unexpected source record count'
staged=[]
for name,before,after,edits in records:
    path=Path(name)
    assert not path.is_absolute() and '..' not in path.parts,'Unsafe source path'
    assert path.parts[0] in {'src','supabase','tests','docs'} or name=='package.json','Unexpected source root'
    old=path.read_text() if path.exists() else ''
    assert hashlib.sha256(old.encode()).hexdigest()==before,'Source changed: '+name
    lines=old.splitlines(keepends=True)
    for start,end,replacement in reversed(edits):
        assert 0<=start<=end<=len(lines),'Invalid source range'
        lines[start:end]=[replacement]
    new=''.join(lines)
    assert hashlib.sha256(new.encode()).hexdigest()==after,'Output checksum mismatch: '+name
    staged.append((path,new))
for path,new in staged:
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(new)
print('Applied',len(staged),'verified source files. No credentials were read.')
