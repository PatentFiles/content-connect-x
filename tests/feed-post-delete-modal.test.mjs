/** Every role dashboard uses the same accessible feed post confirmation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/supabase/ConnectFeed.jsx',import.meta.url),'utf8');
test('feed deletion uses a native branded dialog instead of the browser confirmation',()=>{
 assert.match(source,/local\.author_id===userId&&<button/);
 assert.match(source,/aria-label="Delete post"/);
 assert.match(source,/role="alertdialog"/);
 assert.match(source,/aria-modal="true"/);
 assert.match(source,/data-feed-delete-dialog="true"/);
 assert.match(source,/dialog\.showModal\(\)/);
 assert.match(source,/data-feed-delete-cancel="true"/);
 assert.match(source,/onCancel=\{event=>\{event\.preventDefault\(\);closeDelete\(\);\}\}/);
 assert.doesNotMatch(source,/window\.confirm\(/);
});
test('delete requires confirmation and keeps the modal open after backend failure',()=>{
 assert.match(source,/const confirmDelete=async\(\)=>/);
 assert.match(source,/deleteLock\.current\|\|busy\|\|preview\|\|local\.author_id!==userId/);
 assert.match(source,/action\('hide',\{post_id:post\.id\}\)/);
 assert.match(source,/if\(result\?\.hidden!==true\)throw Error/);
 assert.match(source,/setDeleteError\(e\?\.message/);
 assert.match(source,/const closeDelete=\(\)=>\{if\(!busy\)setDeleteOpen\(false\);\}/);
});
