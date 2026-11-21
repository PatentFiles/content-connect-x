/** Compare backend literal table/field names against approved Supabase
 * public-schema snapshot. No live access or credentials; the deployment
 * still requires a separate live-schema audit before production release.
 */
import fs from 'node:fs';
import path from 'node:path';
const snapshot=JSON.parse(fs.readFileSync('tests/fixtures/supabase-public-schema-columns.json','utf8'));
if(snapshot.schema!=='public'||!snapshot.tables||typeof snapshot.tables!=='object')
 throw Error('Public schema fixture is missing or invalid');
const available=new Map(Object.entries(snapshot.tables).map(([t,fields])=>[t,new Set(fields)]));
const files=[];
const extensions=new Set(['.ts','.js','.mjs']);
function visit(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const item=path.join(dir,entry.name);
  if(entry.isDirectory())visit(item);
  else if(extensions.has(path.extname(entry.name)))files.push(item);
 }
}
visit('supabase/functions');
let tableReferences=0,selectedColumns=0,selectQueries=0,dynamicReferences=0;
const missing=[],literalTables=new Set(),byFile=[];
const literal=/\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)/ig;
for(const file of files){
 const code=fs.readFileSync(file,'utf8'),problems=[];
 let match;
 while((match=literal.exec(code))!==null){
  const table=match[1];
  const prefix=code.slice(Math.max(0,match.index-50),match.index);
  // Storage API from(bucket) is not a relational SQL table.
  if(/(?:\.storage|\bstorage)\s*$/.test(prefix))continue;
  tableReferences++;literalTables.add(table);
  const schema=available.get(table);
  if(!schema){problems.push({table,problem:'table absent from approved public snapshot'});continue;}
  // Only straightforward literal select lists are statically checked;
  // nested relationships, aliases and dynamic queries need runtime tests.
  const tail=code.slice(match.index+match[0].length,match.index+match[0].length+500);
  const select=tail.match(/^\s*\.select\(\s*['"\x60]([^'"\x60]+)['"\x60]/);
  if(!select)continue;
  selectQueries++;
  for(const item of select[1].split(',').map(x=>x.trim())){
   if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(item)||item==='count')continue;
   selectedColumns++;
   if(!schema.has(item))problems.push({table,column:item,problem:'column absent from approved public snapshot'});
  }
 }
 dynamicReferences+=(code.match(/\.from\(\s*[a-zA-Z_$]/g)||[]).length;
 if(problems.length){
  const unique=[...new Map(problems.map(x=>[x.table+'.'+x.column,x])).values()];
  missing.push(...unique.map(x=>({file,...x})));byFile.push({file,issues:unique.length});
 }
}
const summary={source_files:files.length,literal_table_references:tableReferences,
 distinct_public_tables:literalTables.size,direct_select_queries:selectQueries,
 simple_selected_columns:selectedColumns,dynamic_from_candidates:dynamicReferences,issues:missing.length,
 schema_snapshot_captured:snapshot.captured_utc};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/backend-schema-contract.json',JSON.stringify({summary,missing,byFile},null,2));
console.log('Backend-to-production-schema contract:',JSON.stringify(summary));
if(files.length<90||tableReferences<200||selectQueries<300||selectedColumns<500)
 throw Error('Schema contract audit exercised fewer backend calls than expected');
if(missing.length){
 console.error('Backend schema contract failures:\n'+missing.slice(0,75).map(x=>JSON.stringify(x)).join('\n'));
 if(missing.length>75)console.error('... '+(missing.length-75)+' additional issues saved in artifact');
 process.exitCode=1;
}
