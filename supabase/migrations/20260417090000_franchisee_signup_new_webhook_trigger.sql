-- Emit signup.new when a new franchisee signup row is created.
-- Keeps webhook dispatch server-side using pg_net + send-signup-webhook edge function.

create or replace function public.notify_franchisee_signup_new()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
begin
  if TG_OP <> 'INSERT' then
    return NEW;
  end if;

  -- Only fire for new pending signups.
  if NEW.status is distinct from 'pending' then
    return NEW;
  end if;

  perform public.http_post_webhook(
    'https://siinxnmudgrhvmvypoxp.supabase.co/functions/v1/send-signup-webhook',
    jsonb_build_object('franchiseeId', NEW.id, 'event', 'signup.new'),
    jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaW54bm11ZGdyaHZtdnlwb3hwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYyMTA3NiwiZXhwIjoyMDg1MTk3MDc2fQ.hybF0ohXqhC8Dw8tN_kv-aMT0GIsKC64UwBKF_nNhpM'
    )
  );

  return NEW;
end;
$$;

drop trigger if exists on_franchisee_signup_created on public.franchisees;

create trigger on_franchisee_signup_created
  after insert
  on public.franchisees
  for each row
  execute function public.notify_franchisee_signup_new();
