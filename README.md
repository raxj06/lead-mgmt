# Boostify Lead CRM

Quick internal CRM: add leads, import CSV/XLSX, assign, call log + follow-up, kanban.

## Setup
1. `pnpm install`
2. Create Supabase project → run `supabase/schema.sql` in SQL editor → enable Email auth
3. Copy `.env.example` to `.env.local` and fill values
4. `pnpm dev` → http://localhost:3000 → sign up first team account

## Flow
Leads table → select + assign → open lead → Mark as Called + notes + follow-up date → Kanban drag-drop.
