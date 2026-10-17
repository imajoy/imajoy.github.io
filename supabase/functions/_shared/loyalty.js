/* One-time renewal rewards, computed only from the server's private paid ledger. */
export const LOYALTY_VERSION='2026-10-17-v2';
export function applyLoyalty(quote,customer,history){
 if(quote.loyalty||quote.coupon)throw new Error('Start loyalty pricing from the current catalog quote.');
 let reward=null,percent=0;
 const nextPayment=(quote.billing==='yearly'?history.yearlyPaidPeriods:history.monthlyPaidPeriods)+1;
 if(quote.billing==='monthly'&&nextPayment===2){reward='monthly_second';percent=5;}
 if(quote.billing==='monthly'&&nextPayment===3){reward='monthly_third';percent=5;}
 if(quote.billing==='yearly'&&nextPayment===2){reward='yearly_return';percent=10;}
 const alreadyUsed=Boolean(reward&&history.usedRewards.includes(reward));
 const eligible=Boolean(reward&&!alreadyUsed);
 const discountAmount=eligible?Math.round(quote.subtotal*percent/100):0;
 return {...quote,customerId:customer.id,historyVersion:history.historyVersion,
  subtotal:quote.subtotal-discountAmount,
  loyalty:{version:LOYALTY_VERSION,verified:true,eligible,returning:history.paidPurchases>0,nextPayment,
   reward:eligible?reward:null,percent:eligible?percent:0,discountAmount,
   reason:eligible?'eligible':alreadyUsed?'already_used':history.paidPurchases?'not_due':'new_customer',
   // Explicit owner exception: yearly renewal loyalty may go below the INR floor.
   belowCatalogFloor:discountAmount>0&&quote.subtotal-discountAmount<quote.minimumSubtotal}
 };
}
export function betterPromotion(loyaltyQuote,couponQuote){
 if(!loyaltyQuote?.loyalty)return couponQuote;
 if(loyaltyQuote.loyalty.discountAmount>0&&loyaltyQuote.subtotal<=couponQuote.subtotal){
  return {...loyaltyQuote,promotionMessage:'Your returning subscriber reward gives the better price. No coupon is applied.'};
 }
 return {...couponQuote,customerId:loyaltyQuote.customerId,historyVersion:loyaltyQuote.historyVersion,
  loyalty:{...loyaltyQuote.loyalty,discountAmount:0,belowCatalogFloor:false,reason:'coupon_selected'},
  promotionMessage:'The coupon gives the better price. Loyalty rewards and coupons do not stack.'};
}
