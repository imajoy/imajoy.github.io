#!/usr/bin/env node
/* Writes the tiny "short address" pages (pro.html, free.html, fbx-exporter.html, pricing.html …).
   GitHub Pages can only serve an address that has a file, so each short address is a one-line forwarder to the real page.
   js/clean-url.js then shows the short address in the browser bar. Keep ALIASES identical to js/clean-url.js
   (tests/clean-aliases.test.mjs checks it). Run:  node scripts/make-aliases.mjs   (add --check to only verify) */
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
export const PAGES={wrapline:'pro','wrapline-free':'free'};
for(const f of readdirSync(root))if(/^tool-.+\.html$/.test(f))PAGES[f.slice(0,-5)]=f.slice(5,-5);
export const SECTIONS={pricing:'pricing',tools:'tools',install:'install',faq:'faq'};
export const ACCOUNT_TABS={'account-info':'account#account','payment-history':'account#history','payment-methods':'account#methods'};
const stub=(to,title)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="dark light"><title>${title}</title><link rel="canonical" href="https://wrapline.in${to.replace(/#.*/,'')}.html"><meta http-equiv="refresh" content="0;url=${to}"><style>body{visibility:hidden}</style><noscript><style>body{visibility:visible}</style></noscript><script>location.replace("${to}"${to.includes("#")?"":"+location.hash"})</script></head><body><p><a href="${to}">Continue to Wrapline</a></p></body></html>\n`;
const out=new Map();
for(const [real,alias] of Object.entries(PAGES))out.set(alias+'.html',stub('/'+real,'Wrapline'));
for(const s of Object.keys(SECTIONS))out.set(s+'.html',stub('/wrapline#'+s,'Wrapline Pro'));
for(const [a,t] of Object.entries(ACCOUNT_TABS))out.set(a+'.html',stub('/'+t,'Wrapline Pro account'));
const check=process.argv.includes('--check');let bad=0;
for(const [name,html] of out){
 const current=existsSync(new URL(name,root))?readFileSync(new URL(name,root),'utf8'):'';
 const norm=t=>t.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>(<script data-csp-meta>[\s\S]*?<\/script>)?/,'');
 if(norm(current)===norm(html))continue;
 if(check){console.error('Out of date: '+name);bad++;}else writeFileSync(new URL(name,root),html);
}
if(bad)process.exit(1);
