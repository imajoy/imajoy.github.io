export function trustedIp(req,env){
 // Set this only to a header the deployed ingress strips and overwrites; never trust arbitrary X-Forwarded-For.
 const name=env('COMMERCE_CLIENT_IP_HEADER');
 if(!['cf-connecting-ip','x-real-ip'].includes(name))return '';
 const value=(req.headers.get(name)||'').trim().toLowerCase();
 if(value.includes(',')||!(/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)||/^[0-9a-f:]+$/.test(value)&&value.includes(':')))return '';
 if(value.includes('.'))return value.split('.').every(n=>Number(n)<=255)?value.split('.').map(Number).join('.'):'';
 // URL canonicalizes equivalent IPv6 spellings so the same address cannot claim twice by changing notation.
 try{return new URL('http://['+value+']/').hostname.slice(1,-1);}catch{return '';}
}
