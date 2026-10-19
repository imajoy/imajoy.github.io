/* Static SEO regression check. No network requests, credentials or dependencies. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),base='https://imajoy.github.io/';
const read=path=>readFileSync(resolve(root,path),'utf8');
const decode=text=>text.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
function tags(html,name){
 return [...html.matchAll(new RegExp('<'+name+'\\b[^>]*>','gi'))].map(match=>Object.fromEntries([...match[0].matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(([,key,,value])=>[key.toLowerCase(),decode(value)])));
}
function meta(head,key){const tag=tags(head,'meta').filter(tag=>tag.name===key||tag.property===key);assert.equal(tag.length,1,`Exactly one ${key} expected`);return tag[0].content;}
const htmlPages=readdirSync(root).filter(name=>name.endsWith('.html'));
const publicPages=htmlPages.filter(name=>!tags(read(name),'meta').some(tag=>tag.name==='robots'&&/\bnoindex\b/.test(tag.content)));
const tools=publicPages.filter(name=>name.startsWith('tool-'));
const sitemap=read('sitemap.xml');
assert.match(sitemap,/<urlset\s+xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>decode(match[1]));
assert.equal(new Set(urls).size,urls.length,'Sitemap URLs must be unique');
assert.deepEqual(new Set(urls),new Set(publicPages.map(name=>base+(name==='index.html'?'':name))),'Sitemap must cover every indexable page and exclude noindex pages');
const titles=new Set(),descriptions=new Set();
for(const filename of publicPages){
 const html=read(filename),head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];assert(head,`${filename}: head missing`);
 const titleTags=[...head.matchAll(/<title>([\s\S]*?)<\/title>/gi)];assert.equal(titleTags.length,1,`${filename}: exactly one title required`);
 const title=decode(titleTags[0][1]);assert(title.length>=10&&title.length<=75,`${filename}: title length ${title.length}`);assert(!titles.has(title),`${filename}: duplicate title`);titles.add(title);
 const description=meta(head,'description');assert(description.length>=40&&description.length<=200,`${filename}: description length ${description.length}`);assert(!descriptions.has(description),`${filename}: duplicate description`);descriptions.add(description);
 if(filename==='index.html')assert(description.length>=150&&description.length<=160,'Homepage description should be 150–160 characters');
 const expected=base+(filename==='index.html'?'':filename),canonical=tags(head,'link').filter(tag=>tag.rel==='canonical');assert.equal(canonical.length,1,`${filename}: exactly one canonical required`);assert.equal(canonical[0].href,expected,`${filename}: wrong canonical`);
 assert.equal(meta(head,'og:url'),expected);assert.equal(meta(head,'og:title'),title);assert.equal(meta(head,'og:description'),description);assert.equal(meta(head,'twitter:title'),title);assert.equal(meta(head,'twitter:description'),description);
 const scripts=[...head.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];assert(scripts.length,`${filename}: structured data missing`);
 const nodes=scripts.flatMap(match=>{const json=JSON.parse(match[1]);assert.equal(json['@context'],'https://schema.org');return json['@graph']||[json];});
 const webpage=nodes.find(node=>node['@type']==='WebPage');assert.equal(webpage?.url,expected);assert.equal(webpage.description,description);
 if(filename==='index.html'){
  const org=nodes.find(node=>node['@type']==='Organization');assert.equal(org?.name,'Ajoy Tools');
  const products=nodes.find(node=>node['@type']==='ItemList');assert(products?.itemListElement.some(item=>item.url===base+'wrapline.html'),'Ajoy Tools home must list Wrapline');
 }else if(filename==='wrapline.html'){
  const app=nodes.find(node=>node['@type']==='SoftwareApplication');assert(app,'SoftwareApplication missing');assert.equal(app.name,'Wrapline');assert.equal(app.operatingSystem,'Windows');assert.match(app.softwareRequirements,/Maya 2023/);assert.equal(app.featureList.length,tools.length);
  const list=nodes.find(node=>node['@type']==='ItemList');assert.equal(list.numberOfItems,tools.length);assert.deepEqual(new Set(list.itemListElement.map(item=>item.url)),new Set(tools.map(name=>base+name)));
 }else{
  const breadcrumb=nodes.find(node=>node['@type']==='BreadcrumbList');assert(breadcrumb&&[base,base+'wrapline.html'].includes(breadcrumb.itemListElement[0].item),`${filename}: breadcrumb must start at a home page`);assert.equal(breadcrumb.itemListElement.at(-1).item,expected);
 }
 for(const link of tags(html,'a')){
  if(!link.href||/^(mailto:|tel:|#)/.test(link.href))continue;
  const url=new URL(link.href,expected);if(url.origin!==new URL(base).origin)continue;
  const file=decodeURIComponent(url.pathname.slice(1))||'index.html';
  if(file.endsWith('.html'))assert(existsSync(resolve(root,file)),`${filename}: broken internal page ${file}`);
 }
 assert.equal((html.match(/<h1\b/gi)||[]).length,1,`${filename}: exactly one main heading expected`);
}
for(const filename of ['checkout.html','download.html','404.html','next/index.html']){
 assert(tags(read(filename),'meta').some(tag=>tag.name==='robots'&&/\bnoindex\b/.test(tag.content)),`${filename}: noindex missing`);
}
const robots=read('robots.txt');assert.match(robots,/^User-agent:\s*\*/m);assert(robots.includes('Sitemap: '+base+'sitemap.xml'));assert(!/^Disallow:\s*\/\s*$/m.test(robots),'Do not block the public site');
console.log(`SEO checks passed: ${publicPages.length} public pages, ${tools.length} linked tool guides, unique metadata, canonical/schema consistency, sitemap coverage, internal page links and 4 noindex routes.`);
