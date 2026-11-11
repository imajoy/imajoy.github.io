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

test('a profile picture is kept only when it is a small JPEG data URL, and survives later detail edits',()=>{
 const s=service();s.register('pic@example.com');const tok=s.ctx.makeSession_('pic@example.com');
 const jpg='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
 assert.equal(s.ctx.handleAccount_({step:'profile-set',token:tok,profile:{photo:jpg}}).profile.photo,jpg);
 assert.equal(s.ctx.handleAccount_({step:'profile-set',token:tok,profile:{name:'Pic'}}).profile.photo,jpg,'editing the name keeps the picture');
 for(const bad of ['http://evil.example/a.jpg','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,'+'A'.repeat(40001),'javascript:alert(1)'])
  assert.equal(s.ctx.handleAccount_({step:'profile-set',token:tok,profile:{photo:bad}}).profile.photo,'',bad.slice(0,30));
});

test('a profile picture is filed in the Drive folder structure by the background sync, replaced on a new upload, and deleted when removed',()=>{
 const s=service();s.register('pic2@example.com');const tok=s.ctx.makeSession_('pic2@example.com');
 const jpg1='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==',jpg2='data:image/jpeg;base64,/9j/4AAQSkZJRgACAQ==';
 const folder=()=>{const root=s.drive.folders.get('Wrapline profile photos');return root&&root.subs.get('pic2@example.com');};
 const set=photo=>s.ctx.handleAccount_({step:'profile-set',token:tok,profile:{photo}}),sync=()=>s.ctx.handleAccount_({step:'profile-photo-sync',token:tok});
 set(jpg1);assert.equal(s.drive.files.length,0,'saving the picture itself does not wait for Drive');
 assert.equal(sync().ok,true);assert.deepEqual([...folder().files.keys()],['profile-photo.jpg'],'Wrapline profile photos / email / profile-photo.jpg');
 s.ctx.handleAccount_({step:'profile-set',token:tok,profile:{name:'Pic'}});sync();assert.equal(folder().files.size,1);
 set(jpg2);sync();assert.equal(folder().files.size,1,'a new picture replaces the old file');assert.equal(s.drive.files.length,3,'(each sync files the current picture again)');
 set('');sync();assert.equal(folder().files.size,0,'removing the picture deletes the file');assert.equal(folder().trashed,true);
 set(jpg1);sync();assert.equal(folder().files.size,1,'uploading again starts a fresh folder');
 s.ctx.handleAccount_({step:'profile-clear',token:tok});assert.equal(folder().trashed,true,'clearing the profile removes the picture too');
 assert.equal(s.ctx.handleAccount_({step:'profile-photo-sync',token:'bad'}).error,'expired');
});
