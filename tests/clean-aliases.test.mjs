import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {PAGES,SECTIONS} from '../scripts/make-aliases.mjs';
const js=readFileSync(new URL('../js/clean-url.js',import.meta.url),'utf8');
const mapOf=name=>Function('return '+new RegExp('var '+name+'=(\\{[^}]*\\});').exec(js)[1])();
test('clean-url.js and make-aliases.mjs list the same short addresses',()=>{
 assert.deepEqual(mapOf('PAGES'),PAGES);
 assert.deepEqual(Object.keys(mapOf('SECTIONS')).sort(),Object.keys(SECTIONS).sort());
});
test('every short address has a forwarder page and a real target',()=>{
 for(const [real,alias] of Object.entries(PAGES)){
  assert.ok(existsSync(new URL('../'+real+'.html',import.meta.url)),real+' target page');
  const stub=readFileSync(new URL('../'+alias+'.html',import.meta.url),'utf8');
  assert.match(stub,new RegExp('http-equiv="refresh" content="0;url=/'+real+'"'));
  assert.match(stub,/noindex/);
 }
 for(const s of Object.keys(SECTIONS))assert.match(readFileSync(new URL('../'+s+'.html',import.meta.url),'utf8'),new RegExp('url=/wrapline#'+s+'"'));
});
test('short addresses never collide with a real page',()=>{
 const names=[...Object.values(PAGES),...Object.keys(SECTIONS)];
 assert.equal(new Set(names).size,names.length);
 for(const n of names)assert.ok(!(n in PAGES),n+' must not also be a real page name');
});
