-- Register Mido's 3 approved real businesses as `startups` rows so the
-- CEO/CXO heartbeat crons pick them up. Additive only — does not touch or
-- remove any existing rows (e.g. placeholder demo businesses).
insert into startups (name, description, business_type, status)
select v.name, v.description, v.business_type, v.status
from (
  values
    ('JapanUnlocked', 'English-language Japan travel SEO/affiliate site', 'affiliate_seo', 'active'),
    ('Kanso Templates', 'Notion templates & ebooks for Japan travelers/expats, sold on Gumroad', 'digital_product', 'active'),
    ('CareBot Japan', 'AI appointment scheduling SaaS for Japanese clinics via LINE/web — live, priority is first paying customer', 'saas_subscription', 'active')
) as v(name, description, business_type, status)
where not exists (
  select 1 from startups s where s.name = v.name
);
