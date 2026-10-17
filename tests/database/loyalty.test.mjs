// Run explicitly with PGLITE_TEST_MODULE pointing to a pinned, temporary install.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emailHash} from '../../supabase/functions/_shared/customer.js';
const {PGlite}=await import(process.env.PGLITE_TEST_MODULE||'@electric-sql/pglite');
test('Private payment ledger: linking, RLS, paid-period counting and consumed rewards',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key);`);
  await db.exec(await readFile(new URL('../../supabase/migrations/202610170001_storefront_payment_history.sql',import.meta.url),'utf8'));
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
  const hash=await emailHash('old-subscriber@example.test');
  await db.query('insert into auth.users values ($1),($2)',[a,b]);
  async function invoice(id,billing,months,status='paid',reward=null,user=null,amount=89900,qualifying=true){
   await db.query(`insert into public.storefront_payment_history
    (provider,invoice_id,provider_customer_id,customer_user_id,customer_email_hash,billing,qualifying_period,period_start,paid_at,amount_minor,currency,status,verification_source,provider_event_id,provider_event_at,loyalty_reward)
    values ('test-provider',$1,'test-customer',$2,$3,$4,$9,date_trunc('month',now())-($5*interval '1 month'),now()-interval '1 day',$6,'INR',$7,'verified-import',$1,now(),$8)`,[id,user,hash,billing,months,amount,status,reward,qualifying]);
  }
  await invoice('monthly-one','monthly',3);
  await invoice('monthly-two','monthly',2);
  await invoice('same-month-second-invoice','monthly',2);
  await invoice('annual-one','yearly',13);
  await invoice('refunded-month','monthly',1,'refunded');
  await invoice('disputed-month','monthly',1,'disputed');
  await invoice('pending-month','monthly',1,'pending',null,null,0);
  await invoice('future-month','monthly',-1);
  await invoice('prorated-top-up','monthly',1,'paid',null,null,1000,false);
  // Reads do not claim an account or mutate the ledger.
  const before=await db.query('select public.storefront_loyalty_history($1,$2) as h',[a,hash]);assert.equal(before.rows[0].h.paidPurchases,0);
  assert.equal((await db.query('select count(*)::int as n from public.storefront_payment_history where customer_user_id is null')).rows[0].n,9);
  await db.query('select public.storefront_link_customer($1,$2)',[a,hash]);
  const h=(await db.query('select public.storefront_loyalty_history($1,$2) as h',[a,hash])).rows[0].h;
  assert.equal(h.paidPurchases,4);assert.equal(h.monthlyPaidPeriods,2);assert.equal(h.yearlyPaidPeriods,1);assert.deepEqual(h.usedRewards,[]);
  // Owning the same email later cannot steal records already linked to account A.
  await db.query('select public.storefront_link_customer($1,$2)',[b,hash]);
  assert.equal((await db.query('select public.storefront_loyalty_history($1,$2) as h',[b,hash])).rows[0].h.paidPurchases,0);
  await invoice('consumed-then-refunded','monthly',4,'refunded','monthly_second',a);
  const after=(await db.query('select public.storefront_loyalty_history($1,$2) as h',[a,hash])).rows[0].h;assert.deepEqual(after.usedRewards,['monthly_second']);
  await assert.rejects(invoice('reuse-reward','monthly',5,'paid','monthly_second',a),/unique/i);
  await assert.rejects(invoice('monthly-one','monthly',6),/unique/i);
  await assert.rejects(invoice('free-not-paid','monthly',6,'paid',null,a,0),/check/i);
  // Real billing cycles may have different start dates within one calendar month.
  await invoice('another-full-period','monthly',2,'paid',null,a);
  await db.query("update public.storefront_payment_history set period_start=period_start+interval '15 days' where invoice_id='another-full-period'");
  assert.equal((await db.query('select public.storefront_loyalty_history($1,$2) as h',[a,hash])).rows[0].h.monthlyPaidPeriods,3);
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   await assert.rejects(db.query('select * from public.storefront_payment_history'),/permission denied/i);
   await assert.rejects(db.query('select public.storefront_loyalty_history($1,$2)',[a,hash]),/permission denied/i);
   await assert.rejects(db.query('select public.storefront_link_customer($1,$2)',[b,hash]),/permission denied/i);
   await db.exec('reset role');
  }
  // Even an accidental read grant cannot bypass row-level security.
  await db.exec('grant select on public.storefront_payment_history to authenticated;set role authenticated');
  assert.deepEqual((await db.query('select * from public.storefront_payment_history')).rows,[]);
  await db.exec('reset role;revoke select on public.storefront_payment_history from authenticated;set role service_role');
  assert.equal((await db.query('select public.storefront_loyalty_history($1,$2) as h',[a,hash])).rows[0].h.monthlyPaidPeriods,3);
 }finally{await db.close();}
});
