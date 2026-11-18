/** Read-only JSX inventory used by control regression tests. No user data or APIs. */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tag=node=>node?.tagName?.getText()||node?.openingElement?.tagName?.getText();
const attrs=node=>node.attributes||node.openingElement?.attributes;
function filesIn(root){return fs.readdirSync(root,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?filesIn(path.join(root,entry.name)):/\.[jt]sx$/.test(entry.name)?[path.join(root,entry.name)]:[]);}
function value(node, constants, depth=0){
 if(!node||depth>6)return '';
 if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;
 if(ts.isJsxExpression(node)||ts.isParenthesizedExpression(node))return value(node.expression,constants,depth+1);
 if(ts.isIdentifier(node))return value(constants.get(node.text),constants,depth+1);
 if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusToken)return value(node.left,constants,depth+1)+value(node.right,constants,depth+1);
 if(ts.isConditionalExpression(node))return value(node.whenTrue,constants,depth+1);
 return '';
}
function attribute(node,name,constants){const entry=attrs(node)?.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText()===name);return value(entry?.initializer,constants);}
function textOf(node){
 if(ts.isJsxText(node))return node.text.replace(/\s+/g,' ');
 if(ts.isJsxExpression(node))return node.expression&&ts.isStringLiteral(node.expression)?node.expression.text:' Configurable preference with a descriptive label ';
 if(ts.isJsxElement(node))return node.children.map(textOf).join('');
 return '';
}
function simpleMarkup(node,constants){
 if(ts.isJsxText(node))return escape(node.text.replace(/\s+/g,' '));
 if(ts.isJsxExpression(node))return escape(textOf(node));
 if(!ts.isJsxElement(node)&&!ts.isJsxSelfClosingElement(node))return '';
 const name=tag(node);const className=escape(attribute(node,'className',constants));
 if(name==='input'){
  const type=attribute(node,'type',constants)||'text';
  return `<input type="${escape(type)}" class="${className}" aria-label="Fixture field" ${['checkbox','radio'].includes(type)?'':'value="Example value"'}/>`;
 }
 if(name==='select')return `<select class="${className}" aria-label="Fixture options"><option>A configurable choice</option></select>`;
 if(name==='textarea')return `<textarea class="${className}" aria-label="Fixture message">A message to send</textarea>`;
 if(!/^[a-z]/.test(name||''))return '';
 const content=ts.isJsxElement(node)?node.children.map(child=>simpleMarkup(child,constants)).join(''):'';
 return `<${name} class="${className}"${name==='button'?' type="button"':''}>${content||'Action'}</${name}>`;
}
export function inventoryControls(root='src'){
 const files=filesIn(root),labels=[],rows=[];let nativeChoices=0;
 for(const file of files){
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const constants=new Map();
  const collect=node=>{if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name))constants.set(node.name.text,node.initializer);ts.forEachChild(node,collect);};collect(source);
  const visit=node=>{
   if((ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node))&&tag(node)==='input'&&['checkbox','radio'].includes(attribute(node,'type',constants)))nativeChoices++;
   if(ts.isJsxElement(node)){
    const name=tag(node),className=attribute(node,'className',constants);
    if(name==='label'&&node.children.some(child=>ts.isJsxSelfClosingElement(child)&&tag(child)==='input'&&['checkbox','radio'].includes(attribute(child,'type',constants)))){
     const line=source.getLineAndCharacterOfPosition(node.getStart()).line+1;
     labels.push({file,line,className,markup:simpleMarkup(node,constants)});
    }
    if(className.split(/\s+/).includes('ccx-action-row'))rows.push({file,line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,markup:simpleMarkup(node,constants)});
   }
   ts.forEachChild(node,visit);
  };visit(source);
 }
 return {files:files.length,nativeChoices,labels,rows};
}

export async function createControlFixture(output,{beforeRoot=null}={}){
 const {default:postcss}=await import('postcss');
 const {default:tailwind}=await import('tailwindcss');
 const {default:loadConfig}=await import('tailwindcss/loadConfig.js');
 const {default:React}=await import('react');
 const {renderToStaticMarkup}=await import('react-dom/server');
 const {createServer}=await import('vite');
 const inventory=inventoryControls();
 const server=await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 let actual;
 try{
  const {default:Workspace}=await server.ssrLoadModule('/src/supabase/MemberWorkspace.jsx');
  actual=renderToStaticMarkup(React.createElement(Workspace,{user:{id:'00000000-0000-4000-8000-000000000001'},paid:true,flags:{collaborations:true,__ccxLoaded:true,__ccxAccess:{collaborations:{eligible:true,reason:'ready'}}},initialSection:'collaborations'}));
 }finally{await server.close();}
 const controls=inventory.labels.map((item,index)=>`<section class="fixture" data-source="${escape(item.file+':'+item.line)}"><h3>${escape(path.basename(item.file))}</h3><div data-choice="${index}">${item.markup}</div><button class="ccx-action-primary rounded-lg px-4 py-2">Save preference</button></section>`).join('\n');
 const rows=inventory.rows.map((item,index)=>`<section class="fixture" data-source="${escape(item.file+':'+item.line)}"><h3>${escape(path.basename(item.file))} actions</h3><div data-row="${index}">${item.markup}</div></section>`).join('\n');
 const extra=`<section class="fixture" data-source="Future radio"><label><input type="radio" name="future"/>A radio option whose long descriptive label needs to wrap naturally without shrinking the control.</label></section>
 <section class="fixture oh-dialog host-connect-theme" data-source="Modal controls"><div class="oh-dialog-content"><label><input type="radio" name="modal"/>Modal radio option</label><label><input type="checkbox"/>Modal checkbox option</label><input type="range" min="0" max="100" aria-label="Range control"/><input type="hidden" value="not visible"/><input class="sr-only" type="checkbox" aria-label="Screen reader only control"/><div class="ccx-action-row"><button class="oh-circle-control" aria-label="Close dialog">×</button><button class="oh-secondary px-4 py-2">A deliberately long action caption that wraps on a small display</button></div></div></section>`;
 const body=`<main><section id="collaboration-page" class="ccx-app"><div class="actual">${actual}</div></section><h2>Source-wide controls</h2><div class="fixtures">${controls}${extra}</div><h2>Source-wide actions</h2><div class="fixtures">${rows}</div></main>`;
 const sourceRoot=beforeRoot||'src';
 const read=relative=>fs.readFileSync(path.join(sourceRoot,relative),'utf8');
 const config=loadConfig(path.resolve('tailwind.config.js'));
 config.content=[...config.content,{raw:body,extension:'html'}];
 // Follow the real global -> Tailwind -> brand -> host import order.
 const base=read('globals.css')+(beforeRoot?'':read('control-layout.css'))+'\n@tailwind base;\n@tailwind components;\n@tailwind utilities;';
 const compiled=(await postcss([tailwind(config)]).process(base,{from:path.resolve('src/index.css')})).css;
 const theme=['brand-theme.css','onlyhost-theme.css','host-workspace.css','public-landing.css','professional-theme.css','public-brand-theme.css'].map(name=>read('supabase/'+name)).join('\n');
 const fixtureCss='body{margin:0}main{padding:16px}.actual{max-width:1024px;margin:0 auto;padding:24px 0}#collaboration-page{background:var(--cc-bg);padding:12px;border-radius:16px}.fixtures{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:16px}.fixture{padding:16px;border:1px solid #36425c;border-radius:16px;background:var(--cc-surface);min-width:0}.fixture>h3{font-size:12px;margin-bottom:18px}.fixture>button{margin-top:12px}.fixture.oh-dialog{margin:0;width:100%;max-height:none}.fixture.oh-dialog .oh-dialog-content{padding:0}main>h2{font-size:20px;margin:28px 0 16px}';
 fs.writeFileSync(output,`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${compiled}\n${theme}\n${fixtureCss}</style></head><body>${body}</body></html>`);
 return inventory;
}

/** Mount the actual shared navigation and Collaborations components. Network
 * calls use isolated empty fixtures, never a session or a production endpoint. */
export async function createInteractiveShellFixture(template){
 const {build}=await import('esbuild');
 const mock=`const chain={select(){return this},eq(){return this},is(){return this},then(resolve){return Promise.resolve({count:0,data:[],error:null}).then(resolve)}};
 const channel={on(){return this},subscribe(){return this},track:async()=>{},untrack:async()=>{},send:async()=>{},presenceState:()=>({})};
 export const supabase={from:()=>Object.create(chain),channel:()=>Object.create(channel),removeChannel:async()=>{},functions:{invoke:async()=>({data:{items:[]},error:null})}};`;
 const code=`import React from 'react';import{createRoot}from'react-dom/client';import Shell from './src/supabase/OriginalShell.jsx';import Workspace from './src/supabase/MemberWorkspace.jsx';import {MODULE_FEATURES} from './src/supabase/featureModules.mjs';
 const flags=Object.fromEntries(Object.values(MODULE_FEATURES).map(key=>[key,true]));flags.__ccxLoaded=true;flags.__ccxAccess={collaborations:{eligible:true,reason:'ready'}};
 const user={id:'00000000-0000-4000-8000-000000000001'},profile={role_type:'creator',display_name:'Control layout preview'};
 window.__uiErrors=[];window.addEventListener('error',e=>window.__uiErrors.push(e.message));
 createRoot(document.getElementById('fixture-root')).render(React.createElement(Shell,{user,profile,isAdmin:true,approved:true,tab:'collaborations',featureFlags:flags,onNavigate:()=>{},onSignOut:()=>{}},React.createElement(Workspace,{user,flags,paid:true,initialSection:'collaborations'})));`;
 const bundle=await build({stdin:{contents:code,resolveDir:process.cwd(),sourcefile:'control-shell-fixture.jsx',loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-control-fixture',setup(plugin){plugin.onResolve({filter:/api\/supabaseClient/},()=>({path:'supabase-fixture',namespace:'fixture'}));plugin.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'js'}));}}]});
 const script=bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
 return template.replace(/<body>[\s\S]*<\/body>/,()=>'<body><div id="fixture-root"></div><script>'+script+'</script></body>');
}
