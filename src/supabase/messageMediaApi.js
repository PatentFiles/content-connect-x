/** Private conversation media. Never uploads through the live client in demo mode. */
import {supabase} from '@/api/supabaseClient';
import {isDemoActive,createDemoAttachment} from '../demo/demoRuntime.mjs';
export async function uploadMessageAttachment(conversationId,file){
 if(!file||!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(file.type)||file.size>20*1024*1024)throw Error('Use a supported photo or video up to 20 MB.');
 if(isDemoActive())return createDemoAttachment(conversationId,file);
 const request=async(action,fields)=>{const {data,error}=await supabase.functions.invoke('member-workflows',{body:{action,...fields}});if(error||data?.error)throw Error(data?.error||error?.message||'Chat media is unavailable.');return data;};
 const grant=await request('message_media_token',{conversation_id:conversationId,mime_type:file.type,size_bytes:file.size,file_name:file.name});
 if(!grant.path||!grant.token)throw Error('No private upload permission was issued.');
 const {error}=await supabase.storage.from('member-chat-media').uploadToSignedUrl(grant.path,grant.token,file,{contentType:file.type,upsert:false});
 if(error)throw Error('The attachment could not be uploaded.');
 const registered=await request('message_media_register',{conversation_id:conversationId,attachment_id:grant.attachment_id});
 if(!registered.item?.id)throw Error('The uploaded attachment could not be verified.');
 return registered.item;
}
