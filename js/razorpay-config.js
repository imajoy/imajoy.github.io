let pending;
export function loadRazorpayConfig(){
 const url=window.AJOY_CONFIG?.razorpayUrl;
 if(!url)return Promise.resolve(null);
 if(!pending)pending=fetch(url+'/config',{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():null).catch(()=>null);
 return pending;
}
/* countries ['*'] means international: every country except the owner's closed list. */
export const razorpayAvailable=(config,country)=>!!(config?.enabled&&/^[A-Z]{2}$/.test(country||'')&&(config.countries?.includes(country)||config.countries?.includes('*')&&!(config.closedCountries||[]).includes(country)));
