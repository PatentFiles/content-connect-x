-- Correct merchant name after verifying the maker's site; preserve stable prospect slug.
update public.ccx_shop_partners
set name='Shockspot',
    official_url='https://shockspot.net/',
    description='US-assembled precision robotic machines with 8-inch and 12-inch long-stroke options and adjustable motion. Manufacturer lists an affiliate program; approved referral link must be entered separately.',
    categories=array['machines','attachments'],
    partner_status='prospect',
    shipping_by_partner=true,
    updated_at=now()
where slug='shark-spot' and (partner_status='prospect' or affiliate_url is null);
