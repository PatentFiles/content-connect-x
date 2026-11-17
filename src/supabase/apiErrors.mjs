/** Preserve safe backend explanations instead of hiding them behind FunctionsHttpError. */
export async function functionErrorMessage(error,result,fallback='This operation is temporarily unavailable'){
 if(typeof result?.error==='string'&&result.error.trim())return result.error.slice(0,600);
 const response=error?.context;
 if(typeof response?.json==='function'){
  try{const body=await (typeof response.clone==='function'?response.clone():response).json();if(typeof body?.error==='string'&&body.error.trim())return body.error.slice(0,600);}catch{ /* Retain the HTTP status fallback, never log response bodies or credentials. */ }
 }
 if(response?.status===401)return 'Your session could not be verified. Sign in again, then retry.';
 if(response?.status===403)return 'This account does not currently have permission for this action.';
 if(response?.status===404)return 'The requested backend operation is not deployed or the record is unavailable.';
 if(response?.status>=500)return 'The backend is temporarily unavailable. Your feature has not been turned off.';
 return error?.message||fallback;
}
