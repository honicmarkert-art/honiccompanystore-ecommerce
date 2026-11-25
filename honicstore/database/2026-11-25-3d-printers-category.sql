-- New subcategory "3D Printers & Supplies" under the (empty) "Tools & Industries" department,
-- and move the 3D printers and filament there (they sat in the components department next to resistors).
--
-- Undo (previous values):
--   213, 271, 272, 274, 275, 276 -> category 'Tools',       category_id 30c28aa2-bab3-49fd-a969-3fc44e72de91
--   270, 273                     -> category 'Accessories', category_id c8654729-d7aa-4231-a426-f8184521c3fb
--   then: delete from categories where slug = '3d-printers-supplies';
-- Safe to run more than once.

begin;

insert into public.categories (name, slug, parent_id, description, image_url, is_active, display_order)
select '3D Printers & Supplies', '3d-printers-supplies', d.id,
       '3D printers, filament and printing supplies',
       (select image from public.products where id = 270),
       true, 1
from public.categories d
where d.slug = 'tools--industries'
  and not exists (select 1 from public.categories where slug = '3d-printers-supplies');

update public.products p
set category_id = c.id, category = c.name
from public.categories c
where c.slug = '3d-printers-supplies'
  and p.id in (213, 270, 271, 272, 273, 274, 275, 276);

commit;

select p.id, p.name, p.category, c.slug, parent.name as department
from public.products p
join public.categories c on c.id = p.category_id
left join public.categories parent on parent.id = c.parent_id
where p.id in (213, 270, 271, 272, 273, 274, 275, 276)
order by p.id;
