-- توكنات حقيقية من رد Pinecone (usage) لكل حدث + تجميع يفضّلها على التقدير

alter table public.chat_analytics_events
  add column if not exists pinecone_prompt_tokens int,
  add column if not exists pinecone_completion_tokens int,
  add column if not exists pinecone_total_tokens int;

create or replace function public.admin_chat_analytics_totals(p_from timestamptz)
returns table (
  event_count bigint,
  sum_user_len bigint,
  sum_assistant_len bigint,
  events_with_pinecone bigint,
  -- لكل صف: pinecone_total_tokens وإلا تقدير chars (3 و 4 كما سابقاً)
  est_total_tokens bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'not allowed';
  end if;

  return query
  select
    count(*)::bigint,
    coalesce(sum(c.user_message_length), 0)::bigint,
    coalesce(sum(c.assistant_response_length), 0)::bigint,
    count(*) filter (where c.pinecone_total_tokens is not null)::bigint,
    coalesce(sum(
      coalesce(c.pinecone_total_tokens::bigint,
        ceil(coalesce(c.user_message_length, 0)::numeric / 3.0 * 4.0) +
        ceil(coalesce(c.assistant_response_length, 0)::numeric / 3.0)
      )
    ), 0)::bigint
  from public.chat_analytics_events c
  where c.created_at >= p_from;
end;
$$;
