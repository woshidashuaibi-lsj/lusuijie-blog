-- 邀请码表
-- 在 Supabase SQL Editor 执行此文件

create table if not exists invite_codes (
  code        text primary key,
  bound_uid   text unique,
  bound_at    timestamptz,
  note        text,
  created_at  timestamptz default now()
);

alter table invite_codes enable row level security;

-- 已登录用户查自己绑定的码
create policy "user can read own code"
  on invite_codes for select
  to authenticated
  using (bound_uid = auth.uid()::text);

-- ── RPC：原子绑定邀请码 ──────────────────────────────────────────
-- security definer 让函数以表所有者权限运行，绕过 RLS
-- 返回值：'ok' | 'not_found' | 'already_used' | 'already_bound'
create or replace function claim_invite_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   text := auth.uid()::text;
  v_row   invite_codes%rowtype;
begin
  -- 未登录
  if v_uid is null then
    return 'error';
  end if;

  -- 当前用户已绑定过
  if exists (select 1 from invite_codes where bound_uid = v_uid) then
    return 'already_bound';
  end if;

  -- 锁定目标行（for update 防并发）
  select * into v_row
    from invite_codes
   where code = upper(trim(p_code))
     for update;

  if not found then
    return 'not_found';
  end if;

  if v_row.bound_uid is not null then
    return 'already_used';
  end if;

  -- 绑定
  update invite_codes
     set bound_uid = v_uid,
         bound_at  = now()
   where code = upper(trim(p_code));

  return 'ok';
end;
$$;

-- check_invite_access：检查当前用户是否已绑定邀请码
create or replace function check_invite_access()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
begin
  if v_uid is null then
    return false;
  end if;
  return exists (
    select 1 from invite_codes where bound_uid = v_uid
  );
end;
$$;

-- 手动插入邀请码（在 SQL Editor 里执行）：
-- insert into invite_codes (code, note) values
--   ('BOOK-XKJF-2024', '发给张三'),
--   ('BOOK-MWQR-2024', '发给李四');
insert into invite_codes (code, note) values
    ('BOOK-7BD1-R3TI', ''),
    ('BOOK-0YOL-Q05J', ''),
    ('BOOK-RR1F-I8L7', ''),
    ('BOOK-I468-8JOF', ''),
    ('BOOK-IR64-T9Y7', ''),
    ('BOOK-IVWF-FU3J', ''),
    ('BOOK-3LOJ-QOZH', ''),
    ('BOOK-DNNN-S842', ''),
    ('BOOK-L1F6-RKMG', ''),
    ('BOOK-NIII-NQJA', '')
on conflict (code) do nothing;
