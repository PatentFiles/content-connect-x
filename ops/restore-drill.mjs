/**
 * Encrypted recovery rehearsal: production READ-ONLY backup -> isolated target.
 *
 * Requires PostgreSQL 17+ client utilities and age encryption on a secure
 * operator runner. Never invokes a destructive operation on the source.
 * No actual restore succeeds unless protected storage manifests match too.
 *
 * Environment:
 * CCX_DRILL_SOURCE_DATABASE_URL, CCX_DRILL_TARGET_DATABASE_URL
 * CCX_DRILL_PRODUCTION_REF, CCX_DRILL_TARGET_REF
 * CCX_DRILL_AGE_RECIPIENT, CCX_DRILL_AGE_IDENTITY_FILE
 * CCX_DRILL_SOURCE_STORAGE_MANIFEST, CCX_DRILL_TARGET_STORAGE_MANIFEST
 * CCX_DRILL_OUTPUT_DIR, CCX_DRILL_APPROVED=ISOLATED_TARGET_ONLY
 *
 * The target must be a brand-new, empty, compatible and ACCESS-RESTRICTED
 * PostgreSQL database. No embedded storage bytes are reconstructed by SQL.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const keys=['CCX_DRILL_SOURCE_DATABASE_URL','CCX_DRILL_TARGET_DATABASE_URL',
 'CCX_DRILL_PRODUCTION_REF','CCX_DRILL_TARGET_REF','CCX_DRILL_AGE_RECIPIENT',
 'CCX_DRILL_AGE_IDENTITY_FILE','CCX_DRILL_SOURCE_STORAGE_MANIFEST',
 'CCX_DRILL_TARGET_STORAGE_MANIFEST','CCX_DRILL_OUTPUT_DIR'];

export function safeTarget(source,target,productionRef,targetRef){
 if(!productionRef||!targetRef||targetRef===productionRef)throw Error('Target reference must differ from production');
 const s=new URL(source),t=new URL(target);
 if(!['postgres:','postgresql:'].includes(s.protocol)||!['postgres:','postgresql:'].includes(t.protocol))
  throw Error('Both endpoints must be PostgreSQL DSNs');
 if(!s.hostname||!t.hostname||s.hostname===t.hostname&&s.pathname===t.pathname)
  throw Error('Source and target must be different databases');
 if(t.hostname.includes(productionRef)||t.hostname.includes(s.hostname))
  throw Error('Restore target is not isolated from production');
 return true;
}
export function validateManifest(input){
 if(!Array.isArray(input)||!input.length)throw Error('A non-empty complete storage manifest is required');
 const keys=new Set();
 for(const row of input){
  if(!row||typeof row.bucket!=='string'||typeof row.key!=='string'||!row.key||
    !/^[0-9a-f]{64}$/.test(String(row.sha256||''))||!Number.isSafeInteger(row.bytes)||row.bytes<0)
   throw Error('Invalid storage manifest entry');
  const id=row.bucket+'/'+row.key;
  if(keys.has(id))throw Error('Duplicate storage object in manifest');
  keys.add(id);
 }
 return keys;
}
export function compareManifests(source,target){
 validateManifest(source);validateManifest(target);
 const canonical=rows=>rows.map(x=>[x.bucket,x.key,x.sha256,x.bytes].join('|')).sort().join('\n');
 if(canonical(source)!==canonical(target))throw Error('Private storage objects or checksums differ after restore');
 return {objects:source.length,manifest_sha256:createHash('sha256').update(canonical(source)).digest('hex')};
}
function requireTools(...names){
 for(const name of names){
  const r=spawnSync(name,['--version'],{stdio:'ignore'});
  if(r.error||r.status!==0)throw Error('Required recovery utility unavailable: '+name);
 }
}
function execute(command,args,opts={}){
 const result=spawnSync(command,args,{stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:opts.timeout||30000,
  env:{...process.env,PGCONNECT_TIMEOUT:'10'}});
 if(result.error||result.status!==0)throw Error(command+' operation failed. Consult the private runner logs; no data was printed.');
 return result.stdout.trim();
}
function snapshot(dsn){
 // Only fixed count queries are run: never log row contents.
 return execute('psql',['--no-psqlrc','--no-align','--tuples-only','--set=ON_ERROR_STOP=1','--dbname='+dsn,
  '-c',"select (select count(*) from auth.users)::text||','||(select count(*) from public.member_profiles)::text||','||(select count(*) from public.member_media_assets)::text||','||(select count(*) from storage.objects)::text||','||(select count(*) from public.ccx_law_disclosure_audit)::text;"]);
}
function pipeline(firstCommand,firstArgs,lastCommand,lastArgs){
 return new Promise((resolve,reject)=>{
  let failure=null;
  const source=spawn(firstCommand,firstArgs,{stdio:['ignore','pipe','ignore']});
  const dest=spawn(lastCommand,lastArgs,{stdio:['pipe','ignore','ignore']});
  const record=error=>{failure||=error;};
  source.on('error',record);dest.on('error',record);
  source.stdout.pipe(dest.stdin);
  dest.stdin.on('error',()=>{}); // Exit codes below are authoritative.
  let first=null,last=null;
  const finish=()=>{if(first===null||last===null)return;
   if(failure||first!==0||last!==0)reject(new Error('Encrypted backup or restore process failed; inspect operator-only logs'));
   else resolve();
  };
  source.on('close',code=>{first=code;finish();});
  dest.on('close',code=>{last=code;finish();});
 });
}
export async function main(env=process.env){
 const missing=keys.filter(k=>!env[k]);
 if(missing.length)throw Error('Restore drill missing configuration: '+missing.join(', '));
 if(env.CCX_DRILL_APPROVED!=='ISOLATED_TARGET_ONLY')throw Error('Explicit isolated restore approval is required');
 safeTarget(env.CCX_DRILL_SOURCE_DATABASE_URL,env.CCX_DRILL_TARGET_DATABASE_URL,
  env.CCX_DRILL_PRODUCTION_REF,env.CCX_DRILL_TARGET_REF);
 requireTools('pg_dump','pg_restore','psql','age');
 if(!existsSync(env.CCX_DRILL_AGE_IDENTITY_FILE))throw Error('No decryption identity configured');
 const sourceManifest=JSON.parse(readFileSync(env.CCX_DRILL_SOURCE_STORAGE_MANIFEST,'utf8'));
 const targetManifest=JSON.parse(readFileSync(env.CCX_DRILL_TARGET_STORAGE_MANIFEST,'utf8'));
 validateManifest(sourceManifest);validateManifest(targetManifest);
 const targetReady=execute('psql',['--no-psqlrc','--no-align','--tuples-only','--set=ON_ERROR_STOP=1',
  '--dbname='+env.CCX_DRILL_TARGET_DATABASE_URL,'-c',
  "select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema') and table_type='BASE TABLE';"]);
 // No --clean or --if-exists is used: refuse target with existing tables.
 if(Number(targetReady)!==0)throw Error('The recovery target must be an empty, newly allocated database');
 const started=Date.now(),sourceSummary=snapshot(env.CCX_DRILL_SOURCE_DATABASE_URL);
 mkdirSync(env.CCX_DRILL_OUTPUT_DIR,{recursive:true,mode:0o700});
 const archive=join(env.CCX_DRILL_OUTPUT_DIR,'ccx-backup-'+started+'.pgdump.age');
 await pipeline('pg_dump',['--format=custom','--no-owner','--no-privileges',
  '--dbname='+env.CCX_DRILL_SOURCE_DATABASE_URL],
 'age',['-r',env.CCX_DRILL_AGE_RECIPIENT,'-o',archive]);
 await pipeline('age',['-d','-i',env.CCX_DRILL_AGE_IDENTITY_FILE,archive],
  'pg_restore',['--exit-on-error','--single-transaction','--no-owner','--no-privileges',
   '--dbname='+env.CCX_DRILL_TARGET_DATABASE_URL]);
 const targetSummary=snapshot(env.CCX_DRILL_TARGET_DATABASE_URL);
 assert.equal(targetSummary,sourceSummary,'Database account/profile/media/evidence counts did not survive restore');
 const manifest=compareManifests(sourceManifest,targetManifest);
 const result={status:'verified',finished_at:new Date().toISOString(),source_ref:env.CCX_DRILL_PRODUCTION_REF,
  isolated_target_ref:env.CCX_DRILL_TARGET_REF,private_storage_objects:manifest.objects,
  private_storage_manifest_sha256:manifest.manifest_sha256,
  comparison_counts_only:sourceSummary,recovery_duration_seconds:Math.ceil((Date.now()-started)/1000),
  encrypted_backup_archive:archive,
  caution:'The operator must also verify application read/write, signed-document hashes, MFA, storage policies and rollback before final sign-off.'};
 writeFileSync(join(env.CCX_DRILL_OUTPUT_DIR,'restore-attestation.json'),JSON.stringify(result,null,2),{mode:0o600});
 console.log('PASS encrypted isolated restore drill: database counts and private object manifests match.');
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(e=>{console.error('RESTORE DRILL FAILED:',e.message);process.exitCode=1;});
}
