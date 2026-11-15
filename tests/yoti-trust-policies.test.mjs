import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getYotiReturnOrigin, isYotiConfigured, trustedYotiOrigin,
} from '../supabase/functions/ccx-integrations/yotiPolicy.mjs';

test('HTTPS origins are accepted without exposing paths, credentials or queries',()=>{
  assert.equal(trustedYotiOrigin('https://contentconnectx.com'),'https://contentconnectx.com');
  assert.equal(trustedYotiOrigin('https://onlyhost.example.com/'),'https://onlyhost.example.com');
  for (const bad of [
    '',null,'http://onlyhost.example.com','https://localhost',
    'https://onlyhost.example.com/review','https://onlyhost.example.com/?redirect=https://evil.example',
    'https://onlyhost.example.com/#token','https://user:pass@onlyhost.example.com',
    'https://onlyhost.example.com:8443','javascript:alert(1)','https://example',
  ]) assert.equal(trustedYotiOrigin(bad),null,String(bad));
});

test('OnlyHost never falls back to the Content Connect X callback origin',()=>{
  const one={callback_origin:'https://contentconnectx.com',secondary_origin:null};
  assert.equal(getYotiReturnOrigin(one,'onlyhost'),null);
  assert.equal(getYotiReturnOrigin(one,'content_connect'),'https://contentconnectx.com');
  const both={...one,secondary_origin:'https://onlyhost.example.com'};
  assert.equal(getYotiReturnOrigin(both,'onlyhost'),'https://onlyhost.example.com');
  assert.equal(getYotiReturnOrigin({...both,secondary_origin:'https://evil.example/path'},'onlyhost'),null);
});

test('provider readiness requires activation, both credentials and a trusted callback',()=>{
 const active={enabled:true,token:'test-token',sdk:'test-sdk',callback_origin:'https://contentconnectx.com'};
 assert.equal(isYotiConfigured(active),true);
 for (const missing of [
   {...active,enabled:false},{...active,token:''},{...active,sdk:''},
   {...active,callback_origin:null},{...active,callback_origin:'https://localhost/'},
 ]) assert.equal(isYotiConfigured(missing),false);
});
