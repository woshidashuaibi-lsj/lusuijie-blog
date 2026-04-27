-- 用户自定义人物图鉴表
-- 存储用户通过「+ 添加人物」功能生成并保存的人物卡片
-- 在 Supabase SQL Editor 执行此文件

create table if not exists user_characters (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,           -- auth.uid()::text
  book_slug    text not null,           -- 所属书籍，如 "dao-gui-yi-xian"
  char_id      text not null,           -- 人物唯一标识，如 "bai-ling-miao"
  name         text not null,           -- 人物姓名
  avatar       text not null default '👤',
  role         text not null default '',
  traits       jsonb not null default '[]',
  speech_style text not null default '',
  persona      text not null default '',
  relations    jsonb not null default '[]',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  -- 同一用户在同一本书里不能有重复 char_id
  unique (user_id, book_slug, char_id)
);

-- 开启行级别安全
alter table user_characters enable row level security;

-- 用户只能读/写自己的数据
create policy "user can select own characters"
  on user_characters for select
  to authenticated
  using (user_id = auth.uid()::text);

create policy "user can insert own characters"
  on user_characters for insert
  to authenticated
  with check (user_id = auth.uid()::text);

create policy "user can update own characters"
  on user_characters for update
  to authenticated
  using (user_id = auth.uid()::text);

create policy "user can delete own characters"
  on user_characters for delete
  to authenticated
  using (user_id = auth.uid()::text);

-- 索引：按 user_id + book_slug 查询最常用
create index if not exists idx_user_characters_user_book
  on user_characters (user_id, book_slug);
