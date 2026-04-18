-- GoTrue reads several auth.users columns as non-nullable strings. If they are NULL
-- (e.g. after manual SQL inserts), login returns 500: "Database error querying schema".
-- See: https://github.com/supabase/auth/issues/1940

update auth.users set
  confirmation_token = coalesce(confirmation_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where confirmation_token is null
   or email_change is null
   or email_change_token_new is null
   or recovery_token is null
   or email_change_token_current is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;
