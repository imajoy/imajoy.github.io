/* Secret scan: fails if a tracked file contains something that looks like a real credential.
   Run:  node scripts/check-secrets.mjs      (also run it before every push) */
import {execSync} from 'node:child_process';import {readFileSync} from 'node:fs';
const files=execSync('git ls-files',{encoding:'utf8'}).split('\n').filter(f=>f&&!/\.(png|jpe?g|webp|gif|ico|woff2?|mp4|webm|svg)$/i.test(f)&&!/scene\.bundle\.js|js\/vendor\//.test(f));
const rules=[
 ['JWT / Supabase key',/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
 ['Supabase secret key',/sb_secret_[A-Za-z0-9_-]{16,}/],
 ['Stripe secret/restricted key',/\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}/],
 ['Razorpay live key',/rzp_live_[A-Za-z0-9]{8,}/],
 ['AWS access key',/\bAKIA[0-9A-Z]{16}\b/],
 ['Google API key',/\bAIza[0-9A-Za-z_-]{35}\b/],
 ['GitHub token',/\b(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{30,}/],
 ['Slack token',/\bxox[baprs]-[A-Za-z0-9-]{10,}/],
 ['SendGrid key',/\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/],
 ['Twilio key',/\bSK[0-9a-f]{32}\b/],
 ['Webhook secret',/\bwhsec_[A-Za-z0-9]{16,}/],
 ['Private key block',/-----BEGIN [A-Z ]*PRIVATE KEY-----/],
 ['Database URL with password',/\b(postgres(ql)?|mongodb(\+srv)?|mysql|redis):\/\/[^\s:@\/]+:[^\s@\/]{3,}@/],
 ['Hard-coded secret assignment',/\b(secret|password|passwd|api[_-]?key|access[_-]?token|private[_-]?key)\b['"]?\s*[:=]\s*['"][A-Za-z0-9+\/_=-]{20,}['"]/i]
];
let bad=0;
for(const f of files){let t;try{t=readFileSync(f,'utf8');}catch{continue;}
 t.split('\n').forEach((line,i)=>{for(const [name,re] of rules){if(re.test(line)&&!/fixture|example|placeholder|YOUR[_-]|must_not_be_exposed/i.test(line)){bad++;console.log(`${f}:${i+1}  ${name}`);}}});}
if(bad){console.error(`\n${bad} possible secret(s). Move them to environment variables / Script properties and rotate them.`);process.exit(1);}
console.log(`Secret scan passed: ${files.length} tracked files, no credentials found.`);
