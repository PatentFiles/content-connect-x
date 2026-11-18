import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('existing-account verification workspace cannot offer a retired manual ID upload',()=>{
 const source=readFileSync('src/supabase/VerificationWorkspace.jsx','utf8');
 assert.match(source,/YotiVerification/);
 assert.doesNotMatch(source,/type=["']file|submit-age-verification|storage\.from\(['"]age-verification/);
});
