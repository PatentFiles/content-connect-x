/** Project-wide JSX interactive control inventory.
 * CI fails on actual structural dead controls/links rather than assuming that
 * a successful build proves that every click works. This is a static audit,
 * not a substitute for authenticated browser acceptance.
 */
import ts from 'typescript';
import {existsSync,mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,relative,dirname} from 'node:path';

const root='src';
const extensions=new Set(['.jsx','.tsx','.js']);
const sourceFiles=[];
function visitFiles(dir){
 for(const item of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,item.name);
  if(item.isDirectory())visitFiles(path);
  else if(extensions.has(item.name.slice(item.name.lastIndexOf('.'))))sourceFiles.push(path);
 }
}
visitFiles(root);
const inventory=[],issues=[];
const kindCounts={button:0,anchor:0,form:0,select:0,details:0,summary:0,interactiveHandler:0};
const isAttribute=x=>ts.isJsxAttribute(x);
for(const file of sourceFiles){
 const source=readFileSync(file,'utf8');
 const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
 const short=relative('.',file);
 if(sf.parseDiagnostics.length){
  for(const err of sf.parseDiagnostics.slice(0,10)){
   const l=sf.getLineAndCharacterOfPosition(err.start||0);
   issues.push(short+':'+(l.line+1)+' JSX parse error: '+ts.flattenDiagnosticMessageText(err.messageText,' '));
  }
  continue;
 }
 const has=(n,name)=>n.attributes?.properties?.some(a=>isAttribute(a)&&a.name.getText(sf)===name);
 const value=(n,name)=>{
  const attr=n.attributes?.properties?.find(a=>isAttribute(a)&&a.name.getText(sf)===name);
  if(!attr||!attr.initializer)return null;
  if(ts.isStringLiteral(attr.initializer))return attr.initializer.text;
  return attr.initializer.getText(sf);
 };
 const loc=node=>short+':'+(sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1);
 function inForm(node){
  let parent=node.parent;
  while(parent){
   if(ts.isJsxElement(parent)&&parent.openingElement.tagName.getText(sf)==='form')
    return has(parent.openingElement,'onSubmit')||has(parent.openingElement,'action');
   parent=parent.parent;
  }
  return false;
 }
 function walk(node){
  if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
   const tag=node.tagName.getText(sf),where=loc(node);
   if(tag==='button'){
    kindCounts.button++;
    const events=['onClick','onPointerDown','onMouseDown','onKeyDown','onTouchStart'];
    const handled=events.some(name=>has(node,name));
    if(handled)kindCounts.interactiveHandler++;
    const type=value(node,'type');
    const submit=(type==='submit'||type===null)&&inForm(node);
    const disabled=has(node,'disabled');
    if(!handled&&!submit&&!disabled&&!has(node,'formAction'))
     issues.push(where+' button has no action, form submission or disabled state');
    const click=value(node,'onClick')||'';
    if(/=>\s*(?:\{\s*\}|null|undefined)\s*\}?$/.test(click))
     issues.push(where+' button has an empty click callback');
    inventory.push({file:short,line:Number(where.split(':').at(-1)),kind:'button',
     label:value(node,'aria-label')||value(node,'title')||'',
     action:handled?'handler':submit?'submit':disabled?'disabled':'missing'});
   }else if(tag==='a'){
    kindCounts.anchor++;
    const href=value(node,'href');
    if(!has(node,'href')&&!has(node,'onClick'))issues.push(where+' anchor has no href or click handler');
    if(href!==null&&/^(?:\s*|#|javascript:|about:blank)$/i.test(href))
     issues.push(where+' anchor has a placeholder or dangerous URL');
    if(value(node,'target')==='_blank'){
     const rel=value(node,'rel')||'';
     if(!rel.includes('noopener')||!rel.includes('noreferrer'))
      issues.push(where+' external tab missing noopener noreferrer');
    }
    inventory.push({file:short,line:Number(where.split(':').at(-1)),kind:'anchor',
     href:href?.slice(0,160)||'',action:has(node,'onClick')?'handler':'navigate'});
   }else if(tag==='form'){
    kindCounts.form++;
    if(!has(node,'onSubmit')&&!has(node,'action'))
     issues.push(where+' form has no submit handler or action');
   }else if(tag==='select'){kindCounts.select++;}
   else if(tag==='details'){kindCounts.details++;}
   else if(tag==='summary'){kindCounts.summary++;}
  }
  ts.forEachChild(node,walk);
 }
 walk(sf);
}
const summary={files:sourceFiles.length,...kindCounts,issues:issues.length};
mkdirSync('artifacts',{recursive:true});
writeFileSync('artifacts/interactive-controls.json',JSON.stringify({summary,inventory,issues},null,2));
console.log('Interactive control inventory:',JSON.stringify(summary));
if(issues.length){
 console.error('Detected structural interactive control defects:\n'+issues.slice(0,85).join('\n'));
 if(issues.length>85)console.error('... '+(issues.length-85)+' additional defects are in the artifact.');
 process.exitCode=1;
}
