create extension if not exists pgcrypto;

create table if not exists affiliate_products (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text not null,
  canonical_brand text not null,
  source_brand text,
  title text not null,
  short_title text,
  description text,
  product_type text,
  google_product_category text,
  string_count smallint,
  is_baritone boolean not null default false,
  is_extended_range boolean not null default false,
  is_left_handed boolean not null default false,
  is_semi_hollow boolean not null default false,
  is_travel_or_mini boolean not null default false,
  affiliate_url text,
  merchant_url text,
  image_url text,
  condition text,
  availability text,
  price numeric(12, 2),
  sale_price numeric(12, 2),
  currency text not null default 'USD',
  gtin text,
  mpn text,
  item_group_id text,
  color text,
  material text,
  shipping_weight text,
  custom_label_0 text,
  custom_label_1 text,
  custom_label_2 text,
  custom_label_3 text,
  custom_label_4 text,
  promotion_id_1 text,
  promotion_id_2 text,
  raw_feed jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create table if not exists product_enrichment (
  product_id uuid primary key references affiliate_products(id) on delete cascade,
  model_family text,
  body_shape text,
  pickup_type text,
  bridge_type text,
  scale_length text,
  best_for text[] not null default '{}',
  avoid_for text[] not null default '{}',
  price_band text,
  beginner_friendly_score numeric(4, 2),
  metal_score numeric(4, 2),
  jazz_score numeric(4, 2),
  recording_score numeric(4, 2),
  value_score numeric(4, 2),
  deal_score numeric(4, 2),
  confidence_score numeric(4, 2),
  notes text,
  enriched_by text,
  enriched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_shortlists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_shortlist_items (
  shortlist_id uuid not null references product_shortlists(id) on delete cascade,
  product_id uuid not null references affiliate_products(id) on delete cascade,
  rank integer,
  label text,
  rationale text,
  created_at timestamptz not null default now(),
  primary key (shortlist_id, product_id)
);

create index if not exists affiliate_products_brand_idx on affiliate_products (canonical_brand);
create index if not exists affiliate_products_condition_idx on affiliate_products (condition);
create index if not exists affiliate_products_availability_idx on affiliate_products (availability);
create index if not exists affiliate_products_price_idx on affiliate_products (sale_price, price);
create index if not exists affiliate_products_strings_idx on affiliate_products (string_count);
create index if not exists affiliate_products_flags_idx on affiliate_products (is_baritone, is_extended_range, is_left_handed);
create index if not exists affiliate_products_item_group_idx on affiliate_products (item_group_id);
create index if not exists affiliate_products_raw_feed_idx on affiliate_products using gin (raw_feed);
create index if not exists product_enrichment_best_for_idx on product_enrichment using gin (best_for);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists affiliate_products_set_updated_at on affiliate_products;
create trigger affiliate_products_set_updated_at
before update on affiliate_products
for each row execute function set_updated_at();

drop trigger if exists product_enrichment_set_updated_at on product_enrichment;
create trigger product_enrichment_set_updated_at
before update on product_enrichment
for each row execute function set_updated_at();

drop trigger if exists product_shortlists_set_updated_at on product_shortlists;
create trigger product_shortlists_set_updated_at
before update on product_shortlists
for each row execute function set_updated_at();

alter table affiliate_products enable row level security;
alter table product_enrichment enable row level security;
alter table product_shortlists enable row level security;
alter table product_shortlist_items enable row level security;
