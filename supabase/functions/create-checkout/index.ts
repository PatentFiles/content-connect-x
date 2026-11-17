/** Retired legacy membership endpoint. No provider credentials are required. */
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
Deno.serve(req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 return Response.json({error:'Legacy subscription processing is retired. Use the approved membership workflow when available.'},{status:410,headers:cors});
});
