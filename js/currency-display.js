/* Formatting never changes server quotes, expected totals or payment currencies. */
import {currencyForCountry,exchangeRates,formatCurrency,convertMinor} from './fx.js?v=20261020-local1';
let rates=null,settled=false,pending;
export function prepareCurrency(country,source='USD'){
 const target=currencyForCountry(country)||source;
 if(target===source&&source==='USD'||settled)return Promise.resolve();
 if(!pending)pending=exchangeRates().then(value=>{rates=value;settled=true;refreshMoney();document.dispatchEvent(new Event('ajoy:currency-ready'));});
 return pending;
}
export function displayMoney(minor,source='USD',country=document.querySelector('#billing-form')?.elements.country.value||''){
 if(!Number.isFinite(minor))return '—';
 const target=currencyForCountry(country)||source,converted=convertMinor(minor,source,target,rates);
 if(converted===null)return formatCurrency(minor/100,source);
 return (target!==source&&minor!==0?'≈ ':'')+formatCurrency(converted/100,target);
}
export function setMoney(element,minor,source='USD',country=document.querySelector('#billing-form')?.elements.country.value||''){
 if(!element)return;
 if(!Number.isFinite(minor)){delete element.dataset.moneyAmount;delete element.dataset.moneyCurrency;delete element.dataset.moneyCountry;if(element.textContent!=='—')element.textContent='—';if(element.id==='summary-total')usdTotal(element);return;}
 element.dataset.moneyAmount=String(minor);element.dataset.moneyCurrency=source;element.dataset.moneyCountry=country;
 const text=displayMoney(minor,source,country);if(element.textContent!==text)element.textContent=text;
 if(element.id==='summary-total')usdTotal(element);
 prepareCurrency(country,source);
}
function usdTotal(total){
 let line=document.querySelector('#local-total');if(!line){line=document.createElement('small');line.id='local-total';line.className='local-amt';total.after(line);}
 const amount=total.dataset.moneyAmount===undefined?null:Number(total.dataset.moneyAmount),source=total.dataset.moneyCurrency||'USD',target=currencyForCountry(total.dataset.moneyCountry)||source;
 const local=amount===null?null:convertMinor(amount,source,target,rates),usd=amount===null?null:convertMinor(amount,source,'USD',rates);
 const shown=local!==null?target:source;
 const text=shown!=='USD'&&usd!==null?(source==='USD'?'USD total: ':'≈ USD equivalent: ')+formatCurrency(usd/100,'USD'):'';
 if(line.textContent!==text)line.textContent=text;currencyFallback(total);
}
function refreshMoney(){
 for(const el of document.querySelectorAll('[data-money-amount]'))setMoney(el,Number(el.dataset.moneyAmount),el.dataset.moneyCurrency,el.dataset.moneyCountry);
}
function currencyFallback(total){
 const source=total.dataset.moneyCurrency,target=currencyForCountry(total.dataset.moneyCountry)||source;
 let note=document.querySelector('#currency-fallback');
 const missing=settled&&total.dataset.moneyAmount!==undefined&&((target!==source&&(!rates?.[source]||!rates?.[target]))||(source==='INR'&&!rates?.INR));
 if(!missing){if(note)note.hidden=true;return;}
 if(!note){note=document.createElement('p');note.id='currency-fallback';note.className='form-hint';note.setAttribute('role','status');document.querySelector('#quote-note')?.after(note);}
 note.hidden=false;note.textContent=target!==source?'Local-currency conversion is unavailable. Amounts are shown in '+source+'.':'The USD equivalent is unavailable. Razorpay charges INR.';
}
