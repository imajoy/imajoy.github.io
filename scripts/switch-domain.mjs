/* One-shot: move every site address from imajoy.github.io to the custom domain.
   Run only after GitHub Pages shows "DNS check successful" for the domain.
     node scripts/switch-domain.mjs wrapline.in            (apply)
     node scripts/switch-domain.mjs wrapline.in --dry      (list what would change) */
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
const domain=process.argv[2],dry=process.argv.includes('--dry');
if(!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain||'')){console.error('Usage: node scripts/switch-domain.mjs wrapline.in [--dry]');process.exit(1);}
const OLD='imajoy.github.io',skip=new Set(['.git','node_modules','switch-domain.mjs']);
const exts=/\.(html|js|mjs|ts|gs|md|xml|txt|json|css)$/i;
let changed=0;
(function walk(dir){for(const n of readdirSync(dir)){if(skip.has(n))continue;const p=join(dir,n),st=statSync(p);
 if(st.isDirectory())walk(p);else if(exts.test(n)){let s=readFileSync(p,'utf8');if(!s.includes(OLD))continue;
  let out=s.split(OLD).join(domain);
  /* Servers keep accepting the old address too, so nothing breaks while people still use it. */
  out=out.replace(new RegExp("\\|\\|\\s*'https://"+domain.replace(/\./g,'\\.')+"'",'g'),"|| 'https://"+domain+",https://www."+domain+",https://"+OLD+"'");
  if(out!==s){changed++;console.log((dry?'would change ':'changed ')+p);if(!dry)writeFileSync(p,out);}}}})('.');
if(!dry){writeFileSync('CNAME',domain+'\n');console.log('wrote CNAME');}
console.log(changed+' file(s)');
