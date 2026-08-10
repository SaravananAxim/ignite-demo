-- Fire send-signup-webhook from the DB on contract status changes so the webhook
-- is never lost due to client-side page navigation or network interruptions.
--
-- IMPORTANT: Both functions must be SECURITY DEFINER (owned by postgres).
-- net.http_post silently fails when called from the authenticator role context
-- (PostgREST), even through a SECURITY DEFINER wrapper. The trigger function
-- itself must run as postgres for pg_net to queue requests successfully.

create extension if not exists pg_net with schema extensions;

-- Helper with exception logging so errors surface in postgres logs
create or replace function public.http_post_webhook(url text, body jsonb, headers jsonb)
returns void
language plpgsql
security definer
set search_path = net, public
as $$
declare
  req_id bigint;
begin
  select net.http_post(url := url, body := body, headers := headers) into req_id;
exception when others then
  raise warning 'http_post_webhook failed: % %', sqlerrm, sqlstate;
end;
$$;

create or replace function public.notify_contract_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  event_name text;
begin
  if TG_OP = 'INSERT' and NEW.status = 'signed_by_franchisee' then
    event_name := 'signup.ready_for_countersign';
  elsif TG_OP = 'UPDATE'
    and NEW.status = 'fully_signed'
    and (OLD.status is null or OLD.status <> 'fully_signed') then
    event_name := 'signup.completed';
  else
    return NEW;
  end if;

  -- pg_net queues the request asynchronously — trigger returns immediately
  perform public.http_post_webhook(
    'https://siinxnmudgrhvmvypoxp.supabase.co/functions/v1/send-signup-webhook',
    jsonb_build_object('contractId', NEW.id, 'event', event_name),
    jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaW54bm11ZGdyaHZtdnlwb3hwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYyMTA3NiwiZXhwIjoyMDg1MTk3MDc2fQ.hybF0ohXqhC8Dw8tN_kv-aMT0GIsKC64UwBKF_nNhpM'
    )
  );

  return NEW;
end;
$$;

drop trigger if exists on_contract_status_change on public.generated_contracts;

create trigger on_contract_status_change
  after insert or update of status
  on public.generated_contracts
  for each row
  execute function public.notify_contract_status_change();
