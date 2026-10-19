/* Private passkey storage. Only the HMAC-authenticated Supabase function can call these operations. */
function passkeyWho_(token,fresh) {
  var who=commerceWho_(token);
  if(fresh&&(who.sub||Date.now()-(who.expiresAt-30*86400000)>10*60000))throw commerceError_('reauth_required','Verify your email or sign in with a passkey again before changing passkeys.');
  return who;
}
function passkeyRows_() {
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Passkeys');
  if(!sheet||sheet.getLastRow()<2)return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,5).getValues().map(function(row){try{return JSON.parse(row[2]);}catch(error){return null;}}).filter(function(row){return row&&typeof row.id==='string';});
}
function passkeyWrite_(record) {
  var ss=SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getSheetByName('Passkeys');
  if(!sheet){sheet=ss.insertSheet('Passkeys');sheet.appendRow(['Credential ID','Account email','Public credential record','Created at','Status']);sheet.setFrozenRows(1);}
  var ids=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues():[],index=ids.findIndex(function(row){return row[0]==='credential:'+record.id;});
  // Prefix user-controlled strings; JSON starts with a brace, so no cell can become a Sheet formula.
  var row=['credential:'+record.id,'email:'+record.email,JSON.stringify(record),new Date(record.createdAt),record.revoked?'Removed':'Active'];
  if(index<0)sheet.appendRow(row);else sheet.getRange(index+2,1,1,5).setValues([row]);
}
function handlePasskeys_(d) {
  return commerceLock_(function(){
    var operation=d.operation,cache=CacheService.getScriptCache();
    if(operation==='config')return {ok:true,enabled:true};
    if(operation==='context'||operation==='list'){
      var who=passkeyWho_(d.accountToken,operation==='context'),rows=passkeyRows_().filter(function(row){return row.email===who.email&&!row.revoked;});
      if(operation==='context'&&rows.length>=5)throw commerceError_('limit','Remove an old passkey before adding another.');
      return {ok:true,email:who.email,userId:sign_('passkey-user:'+who.email),credentials:rows.map(function(row){return {id:row.id,name:row.name,transports:row.transports,createdAt:row.createdAt,lastUsedAt:row.lastUsedAt};})};
    }
    if(operation==='challenge'){
      if(!/^[-a-f0-9]{36}$/i.test(d.challengeId||'')||!/^[-_a-zA-Z0-9]{32,128}$/.test(d.challenge||'')||!['register','authenticate'].includes(d.kind))throw commerceError_('invalid','Invalid passkey request.');
      var rateKey='passkey-options:'+Math.floor(Date.now()/3600000),rate=Number(cache.get(rateKey)||0);if(rate>=400)throw commerceError_('limit','Passkey requests are busy. Use an email code or try later.');cache.put(rateKey,String(rate+1),3600);
      var email=d.kind==='register'?passkeyWho_(d.accountToken,true).email:'';
      cache.put('passkey-challenge:'+d.challengeId,JSON.stringify({challenge:d.challenge,kind:d.kind,email:email,expiresAt:Date.now()+120000}),120);
      return {ok:true};
    }
    if(operation==='consume'){
      if(!/^[-a-f0-9]{36}$/i.test(d.challengeId||''))throw commerceError_('challenge','Request a new passkey prompt.');
      var key='passkey-challenge:'+d.challengeId,record=JSON.parse(cache.get(key)||'null');cache.remove(key);
      if(!record||record.expiresAt<=Date.now()||record.kind!==d.kind)throw commerceError_('challenge','This passkey prompt expired. Please try again.');
      if(record.kind==='register'&&passkeyWho_(d.accountToken,true).email!==record.email)throw commerceError_('signin_required','Verify the same account before adding a passkey.');
      return {ok:true,challenge:record.challenge,email:record.email};
    }
    if(operation==='save'){
      var who=passkeyWho_(d.accountToken,true),row=d.credential;
      if(!row||!/^[-_a-zA-Z0-9]{1,2048}$/.test(row.id||'')||!/^[-_a-zA-Z0-9]{1,8192}$/.test(row.publicKey||'')||!Number.isSafeInteger(row.counter)||row.counter<0||row.userId!==sign_('passkey-user:'+who.email))throw commerceError_('invalid','Invalid passkey credential.');
      var rows=passkeyRows_();if(rows.some(function(item){return item.id===row.id;}))throw commerceError_('duplicate','This passkey is already registered.');
      if(rows.filter(function(item){return item.email===who.email&&!item.revoked;}).length>=5)throw commerceError_('limit','Remove an old passkey before adding another.');
      row.email=who.email;row.name='Passkey '+(rows.filter(function(item){return item.email===who.email;}).length+1);row.createdAt=Date.now();row.lastUsedAt=null;row.revoked=false;
      passkeyWrite_(row);return {ok:true};
    }
    if(operation==='credential'){
      var found=passkeyRows_().find(function(row){return row.id===d.credentialId&&!row.revoked;});
      if(!found||!registeredEmail_(found.email))throw commerceError_('credential_missing','This passkey is no longer registered. Use your email code.');
      return {ok:true,credential:found};
    }
    if(operation==='login'){
      var found=passkeyRows_().find(function(row){return row.id===d.credentialId&&!row.revoked;});
      if(!found||!registeredEmail_(found.email)||found.counter!==d.previousCounter||!Number.isSafeInteger(d.newCounter)||d.newCounter<found.counter||(found.counter>0&&d.newCounter===found.counter))throw commerceError_('verification','Passkey verification failed. Please try again.');
      found.counter=d.newCounter;found.lastUsedAt=Date.now();passkeyWrite_(found);
      var token=makeSession_(found.email),identity=readSession_(token);
      return {ok:true,email:found.email,token:token,expiresAt:identity.expiresAt,subscriptions:null};
    }
    if(operation==='remove'||operation==='rename'){
      var who=passkeyWho_(d.accountToken,operation==='remove'),found=passkeyRows_().find(function(row){return row.id===d.credentialId&&row.email===who.email&&!row.revoked;});
      if(!found)throw commerceError_('credential_missing','This passkey is no longer registered.');
      if(operation==='rename'){
        var name=typeof d.name==='string'?d.name.trim():'';
        if(!name||name.length>60||/[\x00-\x1f]/.test(name))throw commerceError_('invalid','Use a passkey name of 1–60 characters.');
        found.name=name;
      }else found.revoked=true;
      passkeyWrite_(found);return {ok:true};
    }
    throw commerceError_('action','Unknown passkey operation.');
  });
}
