-- Add Website field to leads. Run in Supabase SQL editor.
alter table leads add column if not exists website text;
