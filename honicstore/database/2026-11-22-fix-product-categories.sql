-- =====================================================================================
-- Fix product categories — 2026-11-22
-- 81 products had a category_id that contradicted their visible category name; most pointed to
-- "Motors & Actuators" (93 products incl. filaments, displays, ESP32 boards...).
-- Each reviewed product gets the right existing subcategory, and `category` (the visible name) is
-- set to that category's name so id and name can't disagree again.
-- Backup of the previous values: private._product_category_backup_20261122 (restore query at bottom).
-- =====================================================================================
begin;

create schema if not exists private;

create table if not exists private._product_category_backup_20261122 as
  select id, category, category_id, now() as backed_up_at from public.products;

with m(id, slug) as (values
  -- communication / function modules, displays, input devices, relays, buzzers, misc -> Accessories
  (112,'accessories'),(117,'accessories'),(116,'accessories'),(115,'accessories'),(119,'accessories'),
  (121,'accessories'),(114,'accessories'),(120,'accessories'),(107,'accessories'),(110,'accessories'),
  (245,'accessories'),(288,'accessories'),(295,'accessories'),(297,'accessories'),(296,'accessories'),
  (228,'accessories'),(229,'accessories'),(230,'accessories'),(220,'accessories'),(231,'accessories'),
  (293,'accessories'),(106,'accessories'),(105,'accessories'),(191,'accessories'),(190,'accessories'),
  (103,'accessories'),(104,'accessories'),(253,'accessories'),(300,'accessories'),
  -- microcontrollers
  (113,'microcontrollers'),(216,'microcontrollers'),
  -- development boards
  (219,'development-boards'),(218,'development-boards'),(217,'development-boards'),
  -- sensors
  (215,'sensors'),(111,'sensors'),(419,'sensors'),(281,'sensors'),(262,'sensors'),(264,'sensors'),
  (280,'sensors'),(294,'sensors'),(246,'sensors'),(237,'sensors'),(238,'sensors'),(243,'sensors'),
  (244,'sensors'),(247,'sensors'),
  -- integrated circuits / timing
  (242,'integrated-circuits'),(258,'integrated-circuits'),(250,'integrated-circuits'),
  -- diodes, transistors, thyristors, LED/diode/transistor kits
  (417,'diodes-transistors'),(416,'diodes-transistors'),(418,'diodes-transistors'),
  (282,'diodes-transistors'),(283,'diodes-transistors'),
  -- capacitor kits
  (415,'resistors-capacitors'),(414,'resistors-capacitors'),
  -- power
  (232,'power-supply'),(261,'power-supply'),(249,'power-supply'),(248,'power-supply'),(252,'power-supply'),
  -- cables & connectors
  (290,'connectors-cables'),(291,'connectors-cables'),(292,'connectors-cables'),(306,'connectors-cables'),
  -- kits
  (421,'starter-kits'),(422,'starter-kits'),(423,'starter-kits'),(420,'project-kits'),
  -- robotics (chassis, mechanical)
  (240,'robotics'),(239,'robotics'),(95,'robotics'),
  -- tools & prototyping supplies (filaments, PCBs, glue, measuring)
  (274,'tools'),(276,'tools'),(275,'tools'),(271,'tools'),(272,'tools'),(277,'tools'),
  (241,'tools'),(260,'tools'),(259,'tools'),(298,'tools'),(255,'tools'),(254,'tools'),
  -- genuine motors & actuators and motor drivers (stay)
  (267,'motors-actuators'),(263,'motors-actuators'),(201,'motors-actuators'),(93,'motors-actuators'),
  (87,'motors-actuators'),(102,'motors-actuators'),(211,'motors-actuators'),(96,'motors-actuators'),
  (99,'motors-actuators'),(92,'motors-actuators'),(101,'motors-actuators'),(100,'motors-actuators'),
  (188,'motors-actuators'),(90,'motors-actuators'),(91,'motors-actuators'),(98,'motors-actuators'),
  (88,'motors-actuators'),(94,'motors-actuators'),(234,'motors-actuators'),(256,'motors-actuators')
)
update public.products p
   set category_id = c.id,
       category = c.name,
       updated_at = now()
  from m
  join public.categories c on c.slug = m.slug
 where p.id = m.id;

commit;

-- RESTORE (only if needed):
--   update public.products p set category = b.category, category_id = b.category_id
--   from private._product_category_backup_20261122 b where b.id = p.id;
