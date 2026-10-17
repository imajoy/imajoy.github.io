#!/usr/bin/env node
// Local owner utility. Only deploying the resulting registry to Supabase activates a code.
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,realpath,chmod,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),options={};
try{
 if(args.includes('--help')){console.log('Usage: node scripts/create-coupon.mjs --percent 10 --expires 2026-12-31T23:59:59+05:30 --billing monthly --out /tmp/ajoy-coupons.json [--plan online|offline|both] [--countries IN,US] [--max-seats 10] [--code CUSTOM-CODE]');process.exit(0);}
 for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||!args[i+1])throw Error('Every option needs a value.');options[args[i].slice(2)]=args[i+1];}
 const allowed=['percent','expires','billing','out','plan','countries','max-seats','code'];
 if(Object.keys(options).some(k=>!allowed.includes(k)))throw Error('Unknown option. Run with --help.');
 const percent=Number(options.percent),expiry=Date.parse(options.expires);
 if(!Number.isInteger(percent)||percent<1||percent>50)throw Error('Percent must be an integer from 1 to 50.');
 if(!Number.isFinite(expiry)||expiry<=Date.now())throw Error('Provide a future ISO expiry date, including a timezone offset.');
 if(!['monthly','yearly','both'].includes(options.billing))throw Error('Billing must be monthly, yearly, or both.');
 if(options.plan&&!['online','offline','both'].includes(options.plan))throw Error('Plan must be online, offline, or both.');
 if(!options.out)throw Error('Choose a private output file outside this repository.');
 const target=path.resolve(options.out),parent=await realpath(path.dirname(target));
 const repo=await realpath(fileURLToPath(new URL('..',import.meta.url)));
 let actualTarget;try{actualTarget=await realpath(target);}catch{actualTarget=path.join(parent,path.basename(target));}
 const relative=path.relative(repo,actualTarget);
 if(relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error('Keep the coupon registry outside this repository.');
 const code=(options.code||'AJOY-'+randomBytes(8).toString('hex').toUpperCase()).trim().toUpperCase();
 if(!/^[A-Z0-9][A-Z0-9-]{5,31}$/.test(code))throw Error('Code must contain 6–32 letters, numbers or hyphens.');
 const hash=createHash('sha256').update(code).digest('hex');
 let registry={};try{registry=JSON.parse(await readFile(actualTarget,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!registry||typeof registry!=='object'||Array.isArray(registry))throw Error('Existing registry is not a JSON object.');
 if(Object.hasOwn(registry,hash))throw Error('That code already exists; existing entries are never overwritten.');
 const rule={active:true,percent,expiresAt:new Date(expiry).toISOString(),billing:options.billing==='both'?['monthly','yearly']:[options.billing]};
 if(options.plan&&options.plan!=='both')rule.plans=[options.plan];
 if(options.countries){const countries=options.countries.split(',').map(c=>c.trim().toUpperCase());if(countries.some(c=>!/^[A-Z]{2}$/.test(c)))throw Error('Countries must be comma-separated two-letter country codes.');rule.countries=countries;}
 if(options['max-seats']){const count=Number(options['max-seats']);if(!Number.isInteger(count)||count<1||count>100)throw Error('Max seats must be between 1 and 100.');rule.maxSeats=count;}
 registry[hash]=rule;
 const serialized=JSON.stringify(registry,null,2)+'\n';if(serialized.length>60000)throw Error('The registry is too large for an environment secret. Use a database-backed registry.');
 const temporary=actualTarget+'.tmp-'+randomBytes(6).toString('hex');
 await writeFile(temporary,serialized,{mode:0o600,flag:'wx'});await rename(temporary,actualTarget);await chmod(actualTarget,0o600);
 console.log('Coupon code: '+code+'\nDiscount: '+percent+'%\nExpires: '+rule.expiresAt+'\nPrivate registry: '+actualTarget+'\nActivate by setting COUPONS_JSON to this file’s complete JSON in Supabase Edge Function secrets. Keep existing entries.');
}catch(error){console.error(error.message);process.exitCode=1;}
