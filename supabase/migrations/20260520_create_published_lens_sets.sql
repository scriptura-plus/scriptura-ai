-- Scriptura AI published lens-set architecture
-- Public UI reads stable ordered sets per verse/language/lens.
-- Old tables are not touched.

create table if not exists public.published_lens_sets (
  id uuid primary key default gen_random_uuid(),

  canonical_ref text not null,
  reference_label text,
  lang text not null,
  lens_id text not null,

  status text not null default 'published',
  version integer not null default 1,

  source_pipeline text,
  source_model text,

  generated_at timestamptz,
  published_at timestamptz default now(),
  manually_edited_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint published_lens_sets_lang_check
    check (lang in ('ru', 'en', 'es')),

  constraint published_lens_sets_lens_id_check
    check (lens_id in ('pearl', 'lexicon', 'context', 'translations')),

  constraint published_lens_sets_status_check
    check (status in ('published', 'draft', 'archived'))
);

create unique index if not exists published_lens_sets_unique_current
on public.published_lens_sets (canonical_ref, lang, lens_id);

create index if not exists published_lens_sets_lookup_idx
on public.published_lens_sets (canonical_ref, lang, lens_id, status);


create table if not exists public.published_lens_cards (
  id uuid primary key default gen_random_uuid(),

  set_id uuid not null references public.published_lens_sets(id) on delete cascade,

  position integer not null,

  title text not null,
  anchor text,
  teaser text,
  body text,
  why_it_matters text,

  score integer,
  claim_type text,
  weakness_root text,
  scorer_reasoning text,
  weakness_detail text,

  source_angle jsonb,
  raw_card jsonb,
  raw_score jsonb,

  status text not null default 'published',
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint published_lens_cards_position_check
    check (position > 0),

  constraint published_lens_cards_status_check
    check (status in ('published', 'hidden', 'draft')),

  constraint published_lens_cards_score_check
    check (score is null or (score >= 0 and score <= 100))
);

create unique index if not exists published_lens_cards_set_position_unique
on public.published_lens_cards (set_id, position);

create index if not exists published_lens_cards_set_order_idx
on public.published_lens_cards (set_id, position);

create index if not exists published_lens_cards_status_idx
on public.published_lens_cards (set_id, status, position);


create or replace function public.set_published_lens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_published_lens_sets_updated_at on public.published_lens_sets;

create trigger set_published_lens_sets_updated_at
before update on public.published_lens_sets
for each row
execute function public.set_published_lens_updated_at();

drop trigger if exists set_published_lens_cards_updated_at on public.published_lens_cards;

create trigger set_published_lens_cards_updated_at
before update on public.published_lens_cards
for each row
execute function public.set_published_lens_updated_at();

alter table public.published_lens_sets enable row level security;
alter table public.published_lens_cards enable row level security;
