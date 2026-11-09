import test from 'node:test';
import assert from 'node:assert/strict';
import {service} from './helpers/apps-service.mjs';

test('saved billing details belong to the verified account, never store country, and can be cleared',()=>{
 const s=service();s.register('buyer@example.com');s.register('other@example.com');
 const tok=s.ctx.makeSession_('buyer@example.com'),other=s.ctx.makeSession_('other@example.com');
 assert.equal(s.ctx.handleAccount_({step:'profile-get',token:tok}).profile,null);
 const saved=s.ctx.handleAccount_({step:'profile-set',token:tok,profile:{name:'Asha Rao',address:'12 Park Street',postal:'700016',city:'Kolkata',region:'West Bengal',payment:'razorpay',country:'US',email:'evil@example.com',companyOn:true,company:'Rao Studio',companyAddress:'9 Lake Rd',companyPostal:'700017'}});
 assert.equal(saved.ok,true);assert.equal(saved.profile.payment,'razorpay');assert.equal(saved.profile.country,undefined);assert.equal(saved.profile.company,'Rao Studio');
 assert.equal(s.ctx.handleAccount_({step:'profile-get',token:tok}).profile.postal,'700016');
 assert.equal(s.ctx.handleAccount_({step:'profile-get',token:other}).profile,null,'another account sees nothing');
 s.ctx.handleAccount_({step:'profile-set',token:tok,profile:{payment:'bitcoin',companyOn:false}});
 const p=s.ctx.handleAccount_({step:'profile-get',token:tok}).profile;
 assert.equal(p.payment,'','unknown payment methods are dropped');assert.equal(p.company,'','company fields clear with the checkbox');assert.equal(p.name,'Asha Rao','untouched fields are kept');
 assert.equal(s.sheets.get('Profiles').rows.length,2,'one row per account');
 assert.equal(s.ctx.handleAccount_({step:'profile-clear',token:tok}).ok,true);
 assert.equal(s.ctx.handleAccount_({step:'profile-get',token:tok}).profile,null);
 assert.equal(s.ctx.handleAccount_({step:'profile-get',token:'bad'}).error,'expired');
});
