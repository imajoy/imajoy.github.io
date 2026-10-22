import test from 'node:test';
import assert from 'node:assert/strict';
import {service} from './helpers/apps-service.mjs';
const call=(s,data)=>JSON.parse(s.ctx.doPost({postData:{contents:JSON.stringify({type:'reviews',...data})}}).text);
const good={rating:5,text:'Switches the whole arm in one click. Saves me hours.',name:'Riya K'};
test('anyone can read; only a signed-in account can post, and the review is public at once',()=>{
 const s=service(),tool='advanced-ik-fk-switch';
 let list=call(s,{tool,op:'list'});assert.equal(list.ok,true);assert.equal(list.count,0);assert.equal(list.signedIn,undefined);
 assert.equal(call(s,{tool,op:'save',...good}).error,'signin');
 assert.equal(call(s,{tool,op:'save',...good,accountToken:'forged.token'}).error,'signin');
 const token=s.ctx.makeSession_('artist@example.com');
 const saved=call(s,{tool,op:'save',...good,accountToken:token});
 assert.equal(saved.ok,true);assert.equal(saved.count,1);assert.equal(saved.average,5);assert.deepEqual(saved.distribution,[0,0,0,0,1]);
 assert.equal(saved.reviews[0].name,'Riya K');assert.equal(saved.reviews[0].text,good.text);assert.equal(saved.mine.rating,5);
 assert.equal(JSON.stringify(saved.reviews).includes('artist@example.com'),false,'the email stays private');
 list=call(s,{tool,op:'list'});assert.equal(list.count,1);
 const row=s.sheets.get('Reviews').rows[1];assert.equal(row[1],tool);assert.equal(row[5],'artist@example.com');assert.equal(row[6],'Visible');
});
test('one review per account per tool: posting again edits it; removing deletes it',()=>{
 const s=service(),tool='playblast',token=s.ctx.makeSession_('artist@example.com');
 call(s,{tool,op:'save',...good,accountToken:token});
 const edited=call(s,{tool,op:'save',rating:3,text:'Good, but I want more presets in the list.',name:'Riya',accountToken:token});
 assert.equal(edited.count,1);assert.equal(edited.average,3);assert.equal(edited.reviews[0].name,'Riya');assert.equal(s.sheets.get('Reviews').rows.length,2);
 call(s,{tool,op:'save',rating:4,text:'Second reviewer here, works well for dailies.',name:'Sam',accountToken:s.ctx.makeSession_('sam@example.com')});
 const both=call(s,{tool,op:'list'});assert.equal(both.count,2);assert.equal(both.average,3.5);
 const removed=call(s,{tool,op:'delete',accountToken:token});assert.equal(removed.count,1);assert.equal(removed.mine,null);
 assert.equal(call(s,{tool:'rivet',op:'list'}).count,0,'reviews are per tool');
});
test('hidden reviews leave the page but the author still sees and keeps them hidden on edit',()=>{
 const s=service(),tool='rivet',token=s.ctx.makeSession_('artist@example.com');
 call(s,{tool,op:'save',...good,accountToken:token});
 s.sheets.get('Reviews').rows[1][6]='Hidden';s.cache.clear();
 assert.equal(call(s,{tool,op:'list'}).count,0);
 const mine=call(s,{tool,op:'list',accountToken:token});assert.equal(mine.mine.hidden,true);
 call(s,{tool,op:'save',...good,rating:4,accountToken:token});assert.equal(s.sheets.get('Reviews').rows[1][6],'Hidden');
});
test('rejects bad input, unknown tools, formulas and floods',()=>{
 const s=service(),token=s.ctx.makeSession_('artist@example.com'),tool='rivet';
 for(const bad of [{rating:0},{rating:6},{rating:4.5},{text:'short'},{text:'x'.repeat(1501)},{name:'A'},{name:'Visit https://spam.example'}])
  assert.equal(call(s,{tool,op:'save',...good,...bad,accountToken:token}).error,'invalid');
 assert.equal(call(s,{tool:'../Orders',op:'list'}).error,'invalid');
 call(s,{tool,op:'save',...good,text:'=HYPERLINK("http://x","click me please")',accountToken:token});
 assert.match(String(s.sheets.get('Reviews').rows[1][3]),/^'=/,'formulas are stored as plain text');
 assert.equal(call(s,{tool,op:'list'}).reviews[0].text.startsWith('='),true,'shown without the escape mark');
 for(let i=0;i<19;i++)call(s,{tool,op:'save',...good,accountToken:token});
 assert.equal(call(s,{tool,op:'save',...good,accountToken:token}).error,'limit');
});
