import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {REPUTABLE_DOMAINS,DISPOSABLE_DOMAINS,isReputableEmail,isDisposableEmail} from '../js/email-policy.js';
test('browser and Apps Script email policy lists stay identical',()=>{
 const gs=fs.readFileSync(new URL('../apps-script/Code.gs',import.meta.url),'utf8');
 const grab=n=>JSON.parse(gs.match(new RegExp('var '+n+' = (\\[.*?\\]);'))[1]);
 assert.deepEqual(grab('REPUTABLE_DOMAINS_'),REPUTABLE_DOMAINS);assert.deepEqual(grab('DISPOSABLE_DOMAINS_'),DISPOSABLE_DOMAINS);
});
test('policy accepts big mailbox providers and refuses throwaway or look-alike domains',()=>{
 for(const e of ['a@gmail.com','A@Gmail.com','a@zoho.com','a@zohomail.in','a@outlook.com','a@yahoo.co.in','a@icloud.com','a@proton.me','a@hotmail.com'])assert.equal(isReputableEmail(e),true,e);
 for(const e of ['a@mailinator.com','a@x.yopmail.com','a@gmail.com.evil.io','a@notgmail.com','a@tempmail.com','a@company.xyz'])assert.equal(isReputableEmail(e),false,e);
 assert.equal(isDisposableEmail('a@guerrillamail.com'),true);assert.equal(isDisposableEmail('a@gmail.com'),false);
 assert.equal(isReputableEmail('a@studio.com',['studio.com']),true);
});
