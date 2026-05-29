create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create index if not exists product_shortlist_items_product_id_idx
  on product_shortlist_items (product_id);
