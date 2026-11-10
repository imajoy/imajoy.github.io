import test from 'node:test';
import assert from 'node:assert/strict';
import {service} from './helpers/apps-service.mjs';
const codeOf=app=>[...app.mails].reverse().find(m=>/sign-in code/.test(m.subject)).subject.match(/\d{6}/)[0];
test('Welcome email goes out once, on first registration only, never on later sign-ins',()=>{
 const app=service({registered:false});
 assert.equal(app.call({step:'code',email:'new@gmail.com',intent:'register'}).ok,true);
 assert.equal(app.call({step:'verify',email:'new@gmail.com',code:codeOf(app)}).ok,true);
 const welcomes=()=>app.mails.filter(m=>/Welcome to Wrapline/.test(m.subject));
 assert.equal(welcomes().length,1);assert.equal(welcomes()[0].to,'new@gmail.com');
 assert.match(welcomes()[0].htmlBody,/Thanks for registering/);
 app.cache.delete('sends:new@gmail.com');
 assert.equal(app.call({step:'code',email:'new@gmail.com'}).ok,true);
 assert.equal(app.call({step:'verify',email:'new@gmail.com',code:codeOf(app)}).ok,true);
 assert.equal(welcomes().length,1,'a returning sign-in must not send another welcome');
});
test('A failing welcome email never blocks the sign-in',()=>{
 const app=service({registered:false});
 app.call({step:'code',email:'new@gmail.com',intent:'register'});
 const code=codeOf(app);globalThis.__mailDown=true;
 try{assert.equal(app.call({step:'verify',email:'new@gmail.com',code}).ok,true);}finally{globalThis.__mailDown=false;}
 assert.equal(app.mails.filter(m=>/Welcome/.test(m.subject)).length,0);
});
