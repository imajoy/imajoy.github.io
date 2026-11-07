#!/usr/bin/env node
/* Adds (or refreshes) the Content-Security-Policy meta tag on every page.
   GitHub Pages cannot send real HTTP headers, so the policy travels inside each page. Inline scripts are allowed only by
   their SHA-256 hash, so a script injected into a page does not run. Run after editing any inline <script>:
     node scripts/apply-csp.mjs          rewrite pages
     node scripts/apply-csp.mjs --check  fail if a page is out of date (used by the tests) */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
export const BUSTER="if(window.top!==window.self){try{window.top.location=window.self.location}catch(e){document.documentElement.style.display='none'}}";
const hash=text=>"'sha256-"+createHash('sha256').update(text,'utf8').digest('base64')+"'";
const PAYPAL='https://www.paypal.com https://*.paypal.com https://www.paypalobjects.com https://*.paypalobjects.com';
const RAZORPAY='https://checkout.razorpay.com https://*.razorpay.com';
export function inlineScripts(html){
  return [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/type\s*=\s*["']?application\/(ld\+json|json)/i.test(m[1])&&m[2].trim()&&!/data-csp-meta/.test(m[1])).map(m=>m[2]);
}
export function policyFor(html){
  const hashes=[...new Set([BUSTER,...inlineScripts(html)])].map(hash);
  return [
    "default-src 'self'",
    "script-src 'self' "+hashes.join(' ')+' '+PAYPAL+' '+RAZORPAY,
    "style-src 'self' 'unsafe-inline' "+RAZORPAY,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://wsadhewcmpdhojgqzstw.supabase.co https://script.google.com https://script.googleusercontent.com https://open.er-api.com https://api.country.is https://get.geojs.io "+PAYPAL+' '+RAZORPAY,
    "frame-src "+PAYPAL+' '+RAZORPAY,
    "media-src 'self' blob:","worker-src 'self' blob:","manifest-src 'self'",
    "object-src 'none'","base-uri 'self'","form-action 'self'",
  ].join('; ');
}
export function apply(html){
  let out=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/i,'').replace(/<script data-csp-meta>[\s\S]*?<\/script>/,'');
  const tag='<meta http-equiv="Content-Security-Policy" content="'+policyFor(out).replace(/"/g,'&quot;')+'"><script data-csp-meta>'+BUSTER+'</script>';
  if(!/<head[^>]*>/i.test(out))throw new Error('no <head>');
  return out.replace(/<head[^>]*>/i,m=>m+tag);
}
if(process.argv[1]&&process.argv[1].endsWith('apply-csp.mjs')){
  const check=process.argv.includes('--check');let stale=0;
  for(const name of [...readdirSync(root).filter(n=>n.endsWith('.html')&&!n.startsWith('google')),'next/index.html']){
    const file=new URL(name,root),html=readFileSync(file,'utf8'),next=apply(html);
    if(next!==html){stale++;if(!check)writeFileSync(file,next);}
  }
  if(check&&stale){console.error(stale+' page(s) have an out-of-date Content-Security-Policy. Run: node scripts/apply-csp.mjs');process.exit(1);}
  console.log(check?'CSP up to date.':'CSP written to '+stale+' page(s).');
}
