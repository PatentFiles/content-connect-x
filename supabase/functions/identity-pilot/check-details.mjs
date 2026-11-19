/** Diagnostics explain failures without returning OCR text, file URLs, document
 * numbers, face embeddings, free-form model messages, or other private fields. */
const FIELDS=['legal_name','date_of_birth','expiry_date','document_number'];
const PHASES=['turn1_start','turn1_peak','turn1_return','turn_start','turn_peak','turn_return'];
const CHECKS=['face_present_all_frames','head_turn_detected','correct_direction','return_to_center','temporal_plausibility','face_bbox_consistency'];
const list=(value,allowed,max)=>Array.isArray(value)?[...new Set(value.filter(item=>allowed.includes(item)))].slice(0,max):[];
const boundedNumber=(value,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max?value:null;
export function sanitizedCheckDetails(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return {
  worker_revision:typeof value.worker_revision==='string'&&/^[a-zA-Z0-9.-]{1,64}$/.test(value.worker_revision)?value.worker_revision:null,
  processing_ms:boundedNumber(value.processing_ms,180000),
  low_confidence_fields:list(value.low_confidence_fields,FIELDS,4),
  barcode_decoded:typeof value.barcode_decoded==='boolean'?value.barcode_decoded:null,
  front_back_mismatches:list(value.front_back_mismatches,FIELDS,4),
  // Permit only a validated calendar date and a boolean; never return raw barcode text.
  barcode_expiry:typeof value.barcode_expiry==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.barcode_expiry)?value.barcode_expiry:null,
  visual_expiry_conflict:value.visual_expiry_conflict===true,
  middle_initial_ocr_join_corrected:value.middle_initial_ocr_join_corrected===true,
  authenticity_available:typeof value.authenticity_available==='boolean'?value.authenticity_available:null,
  authenticity_score:boundedNumber(value.authenticity_score,1),
  authenticity_flag_count:Number.isInteger(value.authenticity_flag_count)?boundedNumber(value.authenticity_flag_count,100):null,
  frame_checks:Array.isArray(value.frame_checks)?value.frame_checks.filter(v=>v&&PHASES.includes(v.phase)).slice(0,6).map(v=>({phase:v.phase,face_present:v.face_present===true,confidence_passed:v.confidence_passed===true,identity_passed:v.identity_passed===true})):[],
  turn_checks:Array.isArray(value.turn_checks)?value.turn_checks.filter(v=>v&&['left','right'].includes(v.direction)).slice(0,2).map(v=>({direction:v.direction,failed_checks:list(v.failed_checks,CHECKS,6)})):[],
 };
}
