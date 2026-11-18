/** Run every offline regression; authenticated end-to-end tests are separate. */
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const walk=path=>readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(path,entry.name)):[join(path,entry.name)]);
const files=walk('tests').filter(path=>path.endsWith('.test.mjs')&&!path.endsWith('hosting-authenticated.test.mjs')).sort();
if(!files.length)throw new Error('No regression tests found');
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
