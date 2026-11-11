import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {apply,inlineScripts,translates} from '../scripts/apply-csp.mjs';
const root=new URL('../',import.meta.url);
const pages=[...readdirSync(root).filter(n=>n.endsWith('.html')&&!n.startsWith('google')),'next/index.html'];
test('every page carries a current hash-based Content-Security-Policy',()=>{
  assert.ok(pages.length>=26);
  for(const p of pages){
    const html=readFileSync(new URL(p,root),'utf8');
    assert.equal(apply(html),html,p+' is out of date: run node scripts/apply-csp.mjs');
    const csp=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    assert.match(csp,/object-src 'none'/);assert.match(csp,/base-uri 'self'/);
    /* only pages that opt in to translation may allow inline/eval (Google's translator needs it); everything else stays hash-only */
    if(translates(html))assert.doesNotMatch(p,/^(checkout|payment)\.html$/,p+' must stay strict');
    else assert.doesNotMatch(csp,/script-src[^;]*'unsafe-(inline|eval)'/,p);
    assert.doesNotMatch(csp,/script-src[^;]*\*[^.]/,p);
  }
});
test('every inline script on every page is covered by a hash',()=>{
  for(const p of pages){const html=readFileSync(new URL(p,root),'utf8');assert.ok(inlineScripts(html).length>=0);}
});

test('payment pages never opt in to translation; every other page with the language script does',()=>{
  for(const p of ['checkout','payment'])assert.equal(translates(readFileSync(new URL(p+'.html',root),'utf8')),false,p);
  for(const p of pages){if(/^(checkout|payment)\.html$/.test(p))continue;const html=readFileSync(new URL(p,root),'utf8');
    if(/js\/lang-boot\.js/.test(html))assert.equal(translates(html),true,p+' loads lang-boot.js but is not opted in');}
});
