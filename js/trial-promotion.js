/* Promote the real Online trial without enabling a trial that PayPal has not configured. */
import {loadTrialConfig,trialPlanId} from './trial.js?v=20261018-j3';
import {detectGeo,cachedGeo} from './geo.js?v=20261018-h8';
import {availability,closedMessage} from './regions.js?v=20261018-g5';
import {getAccountSession,onAccountChange} from './account-session.js?v=20261018-l1';
const ctas=[...document.querySelectorAll('[data-trial-cta]')];
const notices=[...document.querySelectorAll('[data-trial-status]')];
const home=document.querySelector('.trial-showcase')?'#pricing':'index.html#pricing';
let config=null,country='',settled=false;
function render(){
 const alreadyOnline=getAccountSession()?.subscriptions?.some(s=>s.plan==='online'&&s.status==='ACTIVE'&&Date.parse(s.endsAt)>Date.now());
 const known=/^[A-Z]{2}$/.test(country);
 const monthly=known&&trialPlanId(config,'online','monthly',country),yearly=known&&trialPlanId(config,'online','yearly',country);
 const billing=monthly?'monthly':yearly?'yearly':'';
 for(const link of ctas){
  link.href=alreadyOnline?home:billing?'checkout.html?'+new URLSearchParams({plan:'online',billing,offer:'trial',v:'20261018-m1'}):home;
  link.textContent=alreadyOnline?'View your Online plan':billing?'Start my 2-day free trial':'View Online plans';
  link.dataset.trialReady=String(Boolean(billing&&!alreadyOnline));
 }
 const available=known?availability(country,config?.closedCountries||[]):null;
 const message=alreadyOnline?'You already have an active Online subscription. View your account from the plan card.':billing?'Online trial available. Nothing is charged today.':available&&!available.open?closedMessage[available.reason]:settled?'Trial availability could not be confirmed. Review Online plans or check again at checkout.':'Checking Online trial availability…';
 for(const notice of notices)notice.textContent=message;
}
if(ctas.length){
 onAccountChange(render);
 loadTrialConfig().then(async value=>{
  config=value;
  country=/^[A-Z]{2}$/.test(config?.country||'')?config.country:(await detectGeo())||cachedGeo();
  settled=true;render();
 }).catch(()=>{settled=true;render();});
}
