import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('CCX admin diagnostics stays within authenticated admin console',()=>{
 const consoleSource=read('src/supabase/AdminConsole.jsx');
 const diagnostics=read('src/supabase/EnterpriseDiagnostics.jsx');
 assert.match(consoleSource,/section==='diagnostics'&&<EnterpriseDiagnostics\/>/);
 assert.match(diagnostics,/supabase\.functions\.invoke\('ccx-operations'/);
 assert.match(diagnostics,/supabase\.functions\.invoke\('integration-health'/);
 assert.match(diagnostics,/Export report/);
 assert.match(diagnostics,/read.only/i);
 assert.doesNotMatch(diagnostics,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
