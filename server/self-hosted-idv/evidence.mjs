/** Server-side staging helper. No browser endpoint and no admission writes. */
import {uuid, imageType, sha256, summarizeEvaluation} from './idswyft.mjs';
export const STAGING_BUCKET = 'idv-evidence-staging';
const encode = value => new TextEncoder().encode(JSON.stringify(value));
/**
 * Caller must authenticate/authorize, bind subject to session, use a staging
 * service client and synthetic fixtures. fixtureOnly is an operator assertion,
 * not an automatic detector of real identity documents.
 */
export async function storeEvaluationEvidence({supabase, fixtureOnly, subjectId, verificationId, runId,
  documentType, providerResult, artifacts, engineRevision, onDate}) {
  if (fixtureOnly !== true) throw new Error('Synthetic staging fixtures only');
  subjectId = uuid(subjectId); runId = uuid(runId); verificationId = uuid(verificationId);
  if (!/^[a-f0-9]{40}$/i.test(engineRevision)) throw new Error('Pin a full engine commit SHA');
  const summary = summarizeEvaluation(providerResult, {verificationId, documentType, onDate});
  const kinds = documentType === 'passport' ? ['front','selfie'] : ['front','back','selfie'];
  if (!Array.isArray(artifacts) || artifacts.length !== kinds.length || new Set(artifacts.map(x=>x.kind)).size !== kinds.length || !kinds.every(k=>artifacts.some(x=>x.kind===k))) throw new Error('Missing or duplicate evidence');
  const prepared = [];
  for (const file of artifacts) {
    const type = imageType(file.bytes);
    prepared.push({...file, type, path: `${subjectId}/${runId}/${file.kind}.${type==='image/png'?'png':'jpg'}`, digest: await sha256(file.bytes)});
  }
  const {data: bucket, error} = await supabase.storage.getBucket(STAGING_BUCKET);
  if (error || !bucket || bucket.public !== false) throw new Error('Confirmed private staging bucket required');
  const store = supabase.storage.from(STAGING_BUCKET); const uploaded = [];
  try {
    for (const file of prepared) {
      const {error} = await store.upload(file.path, file.bytes, {contentType: file.type, upsert: false});
      if (error) throw new Error('Upload failed'); uploaded.push(file.path);
    }
    const manifest = {schema_version: 1, fixture_only: true, subject_id: subjectId, run_id: runId,
      verification_id: verificationId, engine_revision: engineRevision,
      stored_at: new Date().toISOString(), screening_date: onDate,
      provider_response_sha256: await sha256(encode(providerResult)), summary,
      artifacts: prepared.map(f=>({kind:f.kind,path:f.path,media_type:f.type,bytes:f.bytes.length,sha256:f.digest}))};
    // No extra name, DOB, ID number, biometric embedding or arbitrary provider
    // response in the manifest/table. The ID IMAGE itself still contains PII.
    const path = `${subjectId}/${runId}/manifest.json`; const bytes = encode(manifest);
    const {error: manifestError} = await store.upload(path, bytes, {contentType:'application/json',upsert:false});
    if (manifestError) throw new Error('Manifest failed'); uploaded.push(path);
    const {error: rowError} = await supabase.from('idv_evaluation_runs').insert({id:runId,
      subject_user_id:subjectId,provider_session_id:verificationId,engine_revision:engineRevision,
      manifest_path:path,manifest_sha256:await sha256(bytes),artifact_paths:uploaded,
      upstream_result:summary.upstream_result,screening_checks_passed:summary.screening_checks_passed,
      admission_granted:false,fixture_only:true});
    if (rowError) throw new Error('Index failed');
    return {run_id:runId,...summary};
  } catch {
    // Storage and SQL are not atomic. Production needs durable jobs and orphan
    // reconciliation. Never blindly retry this helper after an uncertain commit.
    if (uploaded.length) {
      try { const {error} = await store.remove(uploaded); if (error) throw error; }
      catch { throw new Error('Evidence write failed; staging orphan cleanup required'); }
    }
    throw new Error('Evidence write failed');
  }
}
