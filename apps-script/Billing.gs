/* Called only after commerce envelope signature/nonce validation. Browser emails grant no role. */
function billingTester_(who){return !!who&&!who.sub&&who.email==='contactmy3dart@gmail.com';}
function billingCountryValid_(value){return typeof value==='string'&&/^[A-Z]{2}$/.test(value)&&['XX','ZZ','EU'].indexOf(value)<0;}
function billingContext_(d){
  var who=d.accountToken?commerceWho_(d.accountToken):null,network=d.billingNetwork||{},enabled=props_().getProperty('BILLING_POLICY_ENABLED')==='true',tester=billingTester_(who);
  if(!enabled)throw commerceError_('unavailable','Billing protection is not activated on the account service.');
  var reason=!billingCountryValid_(network.country)?'country_unavailable':network.status==='vpn'?'vpn_detected':network.status!=='clear'?'network_unavailable':'';
  return {ok:true,country:billingCountryValid_(network.country)?network.country:'',canEditCountry:tester,policyEnabled:enabled,blocked:enabled&&!tester&&!!reason,reason:enabled&&!tester?reason:''};
}
function billingApply_(d,who){
  if(props_().getProperty('BILLING_POLICY_ENABLED')!=='true'){if(d.billingNetwork)throw commerceError_('unavailable','Billing protection is not activated on the account service.');return;}
  var network=d.billingNetwork||{},tester=billingTester_(who);
  if(tester){
    // This is a pricing/testing exemption, not a way around provider restrictions,
    // trial limits, subscription ownership or payment verification.
    if(d.billingCountry&&!billingCountryValid_(d.billingCountry))throw commerceError_('country_mismatch','Choose a valid billing country.');
    d.country=d.billingCountry||network.country||'';d.sandboxCountry='';return;
  }
  if(!billingCountryValid_(network.country))throw commerceError_('country_unavailable','Your connection country could not be verified. Please retry.');
  if(network.status==='vpn')throw commerceError_('vpn_detected','Your connection was flagged as a VPN or proxy. Turn it off, then retry to continue.');
  if(network.status!=='clear')throw commerceError_('network_unavailable','We could not complete the network check. Please retry or contact support.');
  if(d.billingCountry&&d.billingCountry!==network.country)throw commerceError_('country_mismatch','Your billing country must match your verified connection country. Please refresh the country check.');
  d.country=network.country;d.sandboxCountry='';
}
