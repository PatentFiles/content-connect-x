create table if not exists public.ccx_shop_partners(
 slug text primary key check (slug ~ '^[a-z0-9-]{2,60}$'),
 name text not null,official_url text,affiliate_url text,
 categories text[] not null default '{}',
 description text not null default '',
 partner_status text not null default 'prospect' check(partner_status in('prospect','approved','paused')),
 shipping_by_partner boolean not null default true,
 updated_by uuid references auth.users(id),updated_at timestamptz not null default now()
);
alter table public.ccx_shop_partners enable row level security;
revoke all on public.ccx_shop_partners from public,anon,authenticated;
insert into public.ccx_shop_partners(slug,name,official_url,categories,description)
values
 ('liberator','Liberator','https://www.liberator.com/',array['bdsm-furniture','positioning','restraints'],'Premium positioning furniture and pillows; official affiliate program available'),
 ('hismith','Hismith','https://www.hismith.com/',array['machines','attachments'],'Motorized machines, long-stroke options and attachments; official affiliate program available'),
 ('motorbunny','Motorbunny','https://motorbunny.com/',array['machines','bdsm-furniture'],'Premium machines, accessories and restraint products; official Awin program available'),
 ('pleasure-chest','The Pleasure Chest','https://www.thepleasurechest.com/',array['lingerie','gender-affirming','toys','lubricants'],'Inclusive lingerie, gender-affirming accessories, wellness and adult products'),
 ('shark-spot','Shark Spot',null,array['machines'],'Manufacturer and approved official product catalog pending verification')
on conflict(slug) do nothing;