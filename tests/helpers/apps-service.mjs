import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createHash,createHmac,randomUUID} from 'node:crypto';
export function service({registered=true,mailFails=false}={}){
 const values=new Map([['SESSION_SECRET','private-account-test-secret'],['PAYPAL_MODE','sandbox'],['PAYPAL_CLIENT_ID','test-client'],['PAYPAL_SECRET','test-secret'],['COMMERCE_SECRET','test-private-gateway-secret-at-least-32-bytes'],['TRIAL_IDENTITY_SECRET','test-stable-identity-secret-at-least-32-bytes'],['COMMERCE_ENABLED','true'],['PAYPAL_WEBHOOK_ID','TEST-WEBHOOK'],['COMMERCE_ENFORCE_FROM',new Date(Date.now()-86400000).toISOString()]]);
 const tiers={};for(const tier of ['low','mid','high'])tiers[tier]={online:{monthly:'P-'+tier+'-ONLINE',yearly:'P-'+tier+'-YEARLY'},offline:{monthly:'P-'+tier+'-OFFLINE',yearly:'P-'+tier+'-OFFLINE-YEARLY'},onlineTrial:{monthly:'P-'+tier+'-TRIAL',yearly:'P-'+tier+'-TRIAL-YEARLY'}};
 values.set('PLANS_sandbox',JSON.stringify({productId:'PROD-TEST',tiers}));
 const cache=new Map(),mails=[],requests=[],sheets=new Map(),subscriptions=new Map(),transactions=new Map(),plans=new Map(),idempotency=new Map();let sequence=0,locked=false,signatureValid=true;
 const github={private:true,available:true,empty:false,files:new Map(),uploads:0};
 const razorpay={plans:new Map(),subscriptions:new Map(),invoices:new Map(),payments:new Map(),loseCreateResponse:false};
 const paypalMissing=new Set();
 function table(name,initial=[[]]){
  const rows=initial;
  const sheet={rows,clear:()=>{rows.length=0;return sheet;},setHiddenGridlines:()=>sheet,getLastRow:()=>rows.length,appendRow:row=>{rows.push([...row]);return sheet;},deleteRow:index=>{rows.splice(index-1,1);return sheet;},setFrozenRows:()=>sheet,setRowHeight:()=>sheet,setColumnWidth:()=>sheet,setTabColor:()=>sheet,
   getRange:(row,col,height=1,width=1)=>{const range={getValues:()=>Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>rows[row+r-1]?.[col+c-1]??'')),setValues:data=>{data.forEach((r,i)=>r.forEach((v,j)=>{rows[row+i-1]??=[];rows[row+i-1][col+j-1]=v;}));return range;},setValue:v=>{rows[row-1]??=[];rows[row-1][col-1]=v;return range;}};for(const n of ['setNumberFormat','setBackground','setFontColor','setFontWeight','setVerticalAlignment','setFontStyle','setFontSize','setFontFamily','setHorizontalAlignment','setWrapStrategy'])range[n]=()=>range;return range;}};
  sheets.set(name,sheet);return sheet;
 }
 const orders=table('Orders',[['headers'],...(registered?[[new Date(),'I-TESTBUYER1','ACTIVE','sandbox','buyer@example.com','Buyer','US','online','monthly',1,'','P-high-ONLINE']]:[])]);
 const lock={tryLock:()=>{if(locked)return false;locked=true;return true;},waitLock:()=>{if(locked)throw Error('Nested lock');locked=true;},releaseLock:()=>locked=false};
 const blob=value=>({getBytes:()=>[...Buffer.from(value)],getDataAsString:()=>Buffer.from(value).toString()});
 const result=(body,status=200)=>({getResponseCode:()=>status,getContentText:()=>body===null?'':JSON.stringify(body)});
 const ctx=createContext({console,PropertiesService:{getScriptProperties:()=>({getProperty:k=>values.get(k)||null,setProperty:(k,v)=>values.set(k,v),deleteProperty:k=>values.delete(k)})},
  Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_1:'sha1'},computeDigest:(algorithm,bytes)=>[...createHash(algorithm).update(Buffer.from(bytes)).digest()],base64Decode:text=>[...Buffer.from(text,'base64')],base64Encode:value=>Buffer.from(value).toString('base64'),base64EncodeWebSafe:bytes=>Buffer.from(bytes).toString('base64url'),base64DecodeWebSafe:text=>[...Buffer.from(text,'base64url')],newBlob:blob,computeHmacSha256Signature:(text,key)=>[...createHmac('sha256',key).update(text).digest()]},
  LockService:{getScriptLock:()=>lock},CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
  SpreadsheetApp:{WrapStrategy:{CLIP:'CLIP'},getActiveSpreadsheet:()=>({getSheetByName:name=>sheets.get(name)||null,insertSheet:name=>table(name,[])})},
  MailApp:{sendEmail:message=>{if(mailFails)throw Error('Mail service unavailable');mails.push(message);}},Session:{getEffectiveUser:()=>({getEmail:()=> 'owner@example.com'})},
  UrlFetchApp:{fetch:(url,options={})=>{
   requests.push({url,options});
   if(url.startsWith('https://api.razorpay.com/v1/')){
    const u=new URL(url),path=u.pathname.replace('/v1',''),body=options.payload?JSON.parse(options.payload):null;
    if(path==='/plans'&&options.method==='post'&&razorpay.refuseCurrency&&body.item.currency===razorpay.refuseCurrency)return result({error:{description:'Currency not enabled'}},400);
    if(path==='/plans'&&options.method==='post'){const id='plan_test'+(razorpay.plans.size+1),plan={...body,id};razorpay.plans.set(id,plan);return result(plan,201);}
    if(path.startsWith('/plans/'))return result(razorpay.plans.get(path.split('/').pop())||{},razorpay.plans.has(path.split('/').pop())?200:404);
    if(path==='/subscriptions'&&options.method==='post'){
     const id='sub_test'+(razorpay.subscriptions.size+1),s={...body,id,short_url:'https://rzp.io/i/'+id,status:'created',current_start:Math.floor(Date.now()/1000),current_end:Math.floor(Date.now()/1000)+30*86400};razorpay.subscriptions.set(id,s);
     if(razorpay.loseCreateResponse){razorpay.loseCreateResponse=false;throw Error('Lost response');}
     return result(s,201);
    }
    if(path==='/subscriptions')return result({items:[...razorpay.subscriptions.values()].slice(Number(u.searchParams.get('skip')||0),Number(u.searchParams.get('skip')||0)+100)});
    if(/^\/subscriptions\/[^/]+\/cancel$/.test(path)&&options.method==='post'){const sub=razorpay.subscriptions.get(path.split('/')[2]);if(!sub)return result({},404);if(body&&body.cancel_at_cycle_end)sub.has_scheduled_changes=true;else sub.status='cancelled';razorpay.cancelled=(razorpay.cancelled||[]).concat([{id:sub.id,atCycleEnd:!!(body&&body.cancel_at_cycle_end)}]);return result(sub);}
    if(path.startsWith('/subscriptions/'))return result(razorpay.subscriptions.get(path.split('/').pop())||{},razorpay.subscriptions.has(path.split('/').pop())?200:404);
    if(/^\/payments\/[^/]+\/refund$/.test(path)&&options.method==='post'){const pay=razorpay.payments.get(path.split('/')[2]);if(!pay)return result({},404);const amount=(body&&body.amount)||pay.amount;pay.amount_refunded=(pay.amount_refunded||0)+amount;razorpay.refunds=(razorpay.refunds||[]).concat([{payment_id:pay.id,amount}]);return result({id:'rfnd_'+pay.id,payment_id:pay.id,amount});}
    if(path==='/invoices')return result({items:[...razorpay.invoices.values()].filter(i=>i.subscription_id===u.searchParams.get('subscription_id'))});
    if(path.startsWith('/invoices/'))return result(razorpay.invoices.get(path.split('/').pop())||{},razorpay.invoices.has(path.split('/').pop())?200:404);
    if(path.startsWith('/payments/'))return result(razorpay.payments.get(path.split('/').pop())||{},razorpay.payments.has(path.split('/').pop())?200:404);
    return result({},404);
   }
   if(url.startsWith('https://api.github.com/repos/')){
    if(!github.available)return result({},503);
    const match=/repos\/([^/]+\/[^/]+)(?:\/contents\/(.*))?$/.exec(url),repo=match[1],path=match[2];
    if(!path)return result({private:github.private,full_name:repo,default_branch:'main',size:github.empty?0:1});
    if(options.method==='put'){
     const content=JSON.parse(options.payload).content,bytes=Buffer.from(content,'base64');
     const sha=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
     github.empty=false;const file={sha,html_url:'https://github.com/'+repo+'/blob/main/'+path};github.files.set(path,file);github.uploads++;return result({content:file},201);
    }
    if(github.empty)return result({message:'Git Repository is empty.'},409);
    return github.files.has(path)?result(github.files.get(path)):result({},404);
   }
   if(url.endsWith('/v1/oauth2/token'))return result({access_token:'paypal-test-token'});
   if(url.endsWith('/v1/notifications/verify-webhook-signature'))return result({verification_status:signatureValid?'SUCCESS':'FAILURE'});
   if(url.endsWith('/v1/billing/subscriptions')&&options.method==='post'){
    const key=options.headers?.['PayPal-Request-Id'];if(key&&idempotency.has(key))return result(subscriptions.get(idempotency.get(key)),201);
    const id='I-CREATED'+(++sequence),body=JSON.parse(options.payload);const value={...body,id,status:'APPROVAL_PENDING',create_time:new Date().toISOString(),subscriber:{...body.subscriber,payer_id:'PAYER-'+sequence},billing_info:{next_billing_time:new Date(Date.now()+2*864e5).toISOString()}};
    subscriptions.set(id,value);if(key)idempotency.set(key,id);return result(value,201);
   }
   if(url.endsWith('/v1/billing/plans')&&options.method==='post'){
    const key=options.headers?.['PayPal-Request-Id'];if(plans.has(key))return result(plans.get(key),201);
    const plan={...JSON.parse(options.payload),id:'P-REWARD'+(plans.size+1)};plans.set(key,plan);return result(plan,201);
   }
   const id=/\/subscriptions\/(I-[A-Z0-9]+)/.exec(url)?.[1];
   if(id&&paypalMissing.has(id))return result({name:'RESOURCE_NOT_FOUND',details:[{issue:'INVALID_RESOURCE_ID'}]},404);
   if(url.includes('/transactions?'))return result(transactions.get(id)||{transactions:[],total_items:0,total_pages:0});
   if(url.endsWith('/cancel')){if(subscriptions.has(id))subscriptions.get(id).status='CANCELLED';return result(null,204);}
   if(id)return result(subscriptions.get(id)||{id,status:'ACTIVE',plan_id:'P-high-ONLINE',subscriber:{payer_id:'LEGACY-PAYER'},billing_info:{next_billing_time:new Date(Date.now()+20*864e5).toISOString()}});
   return result({},404);
  }},ContentService:{MimeType:{JSON:'json'},createTextOutput:()=>({setMimeType(){return this;},setContent(text){this.text=text;return this;}})}
 });
 for(const name of ['Code.gs','Loyalty.gs','Commerce.gs','Passkeys.gs','Razorpay.gs','Billing.gs','Payments.gs'])runInContext(readFileSync(new URL('../../apps-script/'+name,import.meta.url),'utf8'),ctx);
 ctx.archivePayPalCatalog_({tiers});
 const currentTiers=JSON.parse(JSON.stringify(tiers).replaceAll('P-','P-CURRENT-'));
 values.set('PLANS_sandbox',JSON.stringify({productId:'PROD-TEST',tiers:currentTiers,priceVersion:ctx.PRICE_VERSION,prices:ctx.PRICES}));
 const clone=value=>JSON.parse(JSON.stringify(value));
 const call=body=>clone(ctx.handleAccount_(body));
 const envelope=payload=>{const packed=JSON.stringify(payload),timestamp=String(Date.now()),nonce=randomUUID();return {type:'commerce',payload:packed,timestamp,nonce,signature:createHmac('sha256',values.get('COMMERCE_SECRET')).update(timestamp+'.'+nonce+'.'+packed).digest('hex')};};
 // Logic tests re-check history after changing it; the 5-minute preview cache is tested separately (keepHistoryCache).
 const options={keepHistoryCache:false};
 const rpc=(action,data={})=>{if(!options.keepHistoryCache)for(const k of [...cache.keys()])if(k.startsWith('rh:'))cache.delete(k);return clone(ctx.handleCommerceEnvelope_(envelope({action,...data})));};
 const register=email=>{call({step:'code',email,intent:'register'});const code=mails.at(-1).subject.match(/\d{6}/)[0];return call({step:'verify',email,code});};
 return {paypalMissing,options,ctx,github,razorpay,values,mails,requests,cache,sheets,subscriptions,transactions,plans,rows:orders.rows.slice(1),orders,call,rpc,envelope,register,setSignature:value=>signatureValid=value};
}
