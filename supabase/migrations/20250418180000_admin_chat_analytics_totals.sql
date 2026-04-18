-- Aggregate chat analytics for admin dashboard (sums without loading all rows)

create or replace function public.admin_chat_analytics_totals(p_from timestamptz)
returns table (
  event_count bigint,
  sum_user_len bigint,
  sum_assistant_len bigint,
  -- يطابق lib/pinecone-usage-estimate.ts عند cpt=3 و promptExpansion=4
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
    coalesce(sum(
      ceil(coalesce(c.user_message_length, 0)::numeric / 3.0 * 4.0) +
      ceil(coalesce(c.assistant_response_length, 0)::numeric / 3.0)
    ), 0)::bigint
  from public.chat_analytics_events c
  where c.created_at >= p_from;
end;
$$;

grant execute on function public.admin_chat_analytics_totals(timestamptz) to authenticated;
