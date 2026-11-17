/** Retired membership webhook. Never accepts or fabricates payment events. */
Deno.serve(()=>Response.json({error:'Legacy membership webhook retired.'},{status:410}));
