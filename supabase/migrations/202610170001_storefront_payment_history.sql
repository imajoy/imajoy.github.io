-- New storefront data only. Do not modify the existing Maya activation tables.
begin;

create table public.storefront_payment_history (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (length(provider) between 1 and 80),
  invoice_id text not null check (length(invoice_id) between 1 and 200),
  provider_customer_id text not null check (length(provider_customer_id) between 1 and 200),
  customer_user_id uuid references auth.users(id) on delete set null,
  customer_email_hash text not null check (customer_email_hash ~ '^[a-f0-9]{64}$'),
  billing text not null check (billing in ('monthly', 'yearly')),
  qualifying_period boolean not null default false,
  period_start timestamptz not null,
  paid_at timestamptz,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'disputed', 'void')),
  verification_source text not null check (verification_source in ('provider-webhook', 'verified-import')),
  provider_event_id text not null check (length(provider_event_id) between 1 and 200),
  provider_event_at timestamptz not null,
  loyalty_reward text check (loyalty_reward in ('monthly_second', 'monthly_third', 'yearly_return')),
  updated_at timestamptz not null default now(),
  unique (provider, invoice_id),
  unique (provider, provider_event_id),
  unique (customer_user_id, loyalty_reward),
  check (loyalty_reward is null or (customer_user_id is not null and paid_at is not null)),
  check (status <> 'paid' or (paid_at is not null and amount_minor > 0))
);

create index storefront_history_customer on public.storefront_payment_history(customer_user_id);
create index storefront_history_email on public.storefront_payment_history(customer_email_hash);
alter table public.storefront_payment_history enable row level security;
revoke all on public.storefront_payment_history from public, anon, authenticated;
grant select, insert, update, delete on public.storefront_payment_history to service_role;

create function public.storefront_history_touch()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.storefront_history_touch() from public, anon, authenticated;
create trigger storefront_history_updated before update on public.storefront_payment_history
for each row execute function public.storefront_history_touch();

-- Explicit account linking is a POST action after email verification.
create function public.storefront_link_customer(p_user_id uuid, p_email_hash text)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  if p_user_id is null or p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid verified customer';
  end if;

  -- Bind verified historical imports once; later checks use the stable account ID.
  update public.storefront_payment_history
    set customer_user_id = p_user_id
    where customer_user_id is null and customer_email_hash = p_email_hash;
end;
$$;
revoke all on function public.storefront_link_customer(uuid, text) from public, anon, authenticated;
grant execute on function public.storefront_link_customer(uuid, text) to service_role;

-- No browser can look up somebody else's billing email or payment history.
create function public.storefront_loyalty_history(p_user_id uuid, p_email_hash text)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare result jsonb;
begin
  if p_user_id is null or p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid verified customer';
  end if;
  select jsonb_build_object(
    'paidPurchases', count(*),
    -- Count full billing periods, never license quantity, retries or prorations.
    'monthlyPaidPeriods', count(distinct period_start) filter (where billing = 'monthly'),
    'yearlyPaidPeriods', count(distinct period_start) filter (where billing = 'yearly'),
    'usedRewards', (select coalesce(jsonb_agg(distinct loyalty_reward), '[]'::jsonb)
      from public.storefront_payment_history
      where customer_user_id = p_user_id and loyalty_reward is not null and paid_at <= now()),
    'historyVersion', coalesce(max(updated_at)::text, 'none')
  ) into result
  from public.storefront_payment_history
  where customer_user_id = p_user_id
    and status = 'paid' and amount_minor > 0 and qualifying_period
    and paid_at <= now() and period_start <= now();
  return result;
end;
$$;
revoke all on function public.storefront_loyalty_history(uuid, text) from public, anon, authenticated;
grant execute on function public.storefront_loyalty_history(uuid, text) to service_role;

comment on table public.storefront_payment_history is
  'Private verified payment ledger. Populate only from signature-verified provider events or owner-verified paid receipts. Never from browser claims or return URLs.';
commit;
