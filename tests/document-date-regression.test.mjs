import test from 'node:test';
import assert from 'node:assert/strict';
import {usDocumentDate,decodedUSDocument,compareDocumentFields,middleInitialJoinedByOCR} from '../server/idv-worker/document-contract.mjs';
const key=value=>String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
test('calendar fields accept common printed US dates without swapping month and day',()=>{
 for(const value of ['12-07-2032','12/07/2032','12072032','2032/12/07','2032-12-07'])assert.equal(usDocumentDate(value),'2032-12-07');
 for(const value of ['31-12-2032','02/30/2032','2032-13-07','12/07/32','2023-02-30'])assert.equal(usDocumentDate(value),null);
});
test('separated middle initial and precisely joined OCR compare only against independent name',()=>{
 assert.equal(middleInitialJoinedByOCR('AdamT Staples','Adam T Staples',key),true);
 assert.equal(middleInitialJoinedByOCR('AdamR Staples','Adam T Staples',key),false);
 assert.equal(middleInitialJoinedByOCR('AdamT Staples','Adam Thomas Staples',key),false);
});
test('legitimate date formatting differences pass but a mistaken expiry never auto passes',()=>{
 const back={full_name:'Adam T Staples',date_of_birth:'1991-01-01',expiry_date:'2032-12-07',id_number:'1234'};
 const ok=compareDocumentFields({name:'AdamT Staples',dob:'01/01/1991',expiry:'12-07-2032',number:'1234'},back,key);
 assert.deepEqual(ok,{passed:true,mismatches:[]});
 const wrong=compareDocumentFields({name:'AdamT Staples',dob:'01/01/1991',expiry:'2023-02-18',number:'1234'},back,key);
 assert.equal(wrong.passed,false);
 assert.deepEqual(wrong.mismatches,['expiry_date']);
});
test('an OCR-only text payload is never accepted as independently decoded PDF417',()=>{
 assert.equal(decodedUSDocument('Adam T Staples 12-07-2032'),null);
});
