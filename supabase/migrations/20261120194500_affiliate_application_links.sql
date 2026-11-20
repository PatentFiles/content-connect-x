alter table public.ccx_shop_partners add column if not exists application_url text;
update public.ccx_shop_partners set application_url=case slug
 when 'liberator' then 'https://www.liberator.com/pages/affiliates'
 when 'hismith' then 'https://www.hismith.com/en/content/13-affiliate-program'
 when 'motorbunny' then 'https://ui.awin.com/merchant-profile/120317'
 when 'pleasure-chest' then 'https://www.thepleasurechest.com/content/c/affiliates/'
 when 'shark-spot' then 'https://shockspot.postaffiliatepro.com/affiliates/login.php'
 else application_url end,
 updated_at=now()
where slug in ('liberator','hismith','motorbunny','pleasure-chest','shark-spot');