/* Called only after commerce envelope signature/nonce validation. Browser emails grant no role. */
function billingTester_(who){return !!who&&!who.sub&&who.email==='contactmy3dart@gmail.com';}
function billingCountryValid_(value){return typeof value==='string'&&/^[A-Z]{2}$/.test(value)&&['XX','ZZ','EU'].indexOf(value)<0;}
function billingNetworkReason_(network){
  if(!billingCountryValid_(network.country))return 'country_unavailable';
  if(network.status==='disabled'&&network.vpnEnabled===false)return '';
  return network.status==='vpn'?'vpn_detected':network.status!=='clear'?'network_unavailable':'';
}
function billingContext_(d){
  var who=d.accountToken?commerceWho_(d.accountToken):null,network=d.billingNetwork||{},tester=billingTester_(who),reason=billingNetworkReason_(network);
  return {ok:true,country:billingCountryValid_(network.country)?network.country:'',canEditCountry:tester,policyEnabled:true,blocked:!tester&&!!reason,reason:!tester?reason:''};
}
function billingApply_(d,who){
  // Old gateways can finish their rollout without switching on VPN checks. New
  // signed gateways always include billingNetwork and always enforce country rules.
  if(!d.billingNetwork&&props_().getProperty('BILLING_POLICY_ENABLED')!=='true')return;
  var network=d.billingNetwork||{},tester=billingTester_(who);
  if(tester){
    // This is a pricing/testing exemption, not a way around provider restrictions,
    // trial limits, subscription ownership or payment verification.
    if(d.billingCountry&&!billingCountryValid_(d.billingCountry))throw commerceError_('country_mismatch','Choose a valid billing country.');
    d.country=d.billingCountry||network.country||'';d.sandboxCountry='';return;
  }
  if(!billingCountryValid_(network.country))throw commerceError_('country_unavailable','Your connection country could not be verified. Please retry.');
  if(network.status==='vpn')throw commerceError_('vpn_detected','Your connection was flagged as a VPN or proxy. Turn it off, then retry to continue.');
  if(billingNetworkReason_(network))throw commerceError_('network_unavailable','We could not complete the network check. Please retry or contact support.');
  if(d.billingCountry&&d.billingCountry!==network.country)throw commerceError_('country_mismatch','Your billing country must match your verified connection country. Please refresh the country check.');
  d.country=network.country;d.sandboxCountry='';
}
