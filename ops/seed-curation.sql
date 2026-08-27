-- Curation seed: browse-category tags + conservative starter assignments.
-- Idempotent: safe to re-run after any ingest.

INSERT INTO tags (slug, name) VALUES
  ('crime-punishment', 'Crime & Punishment'),
  ('food-drugs', 'Food & Drugs'),
  ('taxes-money', 'Taxes & Money'),
  ('everyday-life', 'Everyday Life'),
  ('weird', 'Weird & Obscure'),
  ('speech-expression', 'Speech & Expression'),
  ('guns-weapons', 'Guns & Weapons'),
  ('privacy-surveillance', 'Privacy & Surveillance')
ON CONFLICT (slug) DO NOTHING;

-- Known crowd-pleasers, pinned by identifier.
WITH pins(identifier, slug) AS (
  VALUES
    ('/us/usc/t18/s700',    'speech-expression'), -- flag desecration
    ('/us/usc/t18/s700',    'weird'),
    ('/us/usc/t21/s347',    'weird'),             -- filled milk / margarine-adjacent
    ('/us/usc/t21/s347',    'food-drugs'),
    ('/us/usc/t18/s1111',   'crime-punishment'),  -- murder
    ('/us/usc/t26/s5000A',  'taxes-money'),       -- individual mandate
    ('/us/usc/t26/s5000A',  'everyday-life')
)
INSERT INTO node_tags (node_id, tag_id)
SELECT n.id, t.id FROM pins p
JOIN law_nodes n ON n.identifier = p.identifier
JOIN tags t ON t.slug = p.slug
ON CONFLICT DO NOTHING;

-- Conservative regex-based assignments, scoped to the relevant titles so the
-- match stays precise. Each block caps nothing: the WHERE clauses are narrow.
INSERT INTO node_tags (node_id, tag_id)
SELECT n.id, t.id FROM law_nodes n, tags t
WHERE t.slug = 'guns-weapons' AND n.node_type = 'section' AND n.status = 'active'
  AND n.identifier LIKE '/us/usc/t18/%'
  AND n.heading ~* '\y(firearm|machinegun|ammunition|armor piercing)\y'
ON CONFLICT DO NOTHING;

INSERT INTO node_tags (node_id, tag_id)
SELECT n.id, t.id FROM law_nodes n, tags t
WHERE t.slug = 'privacy-surveillance' AND n.node_type = 'section' AND n.status = 'active'
  AND n.identifier LIKE '/us/usc/t18/%'
  AND n.heading ~* '\y(wire|electronic communication|pen register|stored communication|interception)\y'
ON CONFLICT DO NOTHING;

INSERT INTO node_tags (node_id, tag_id)
SELECT n.id, t.id FROM law_nodes n, tags t
WHERE t.slug = 'crime-punishment' AND n.node_type = 'section' AND n.status = 'active'
  AND n.identifier LIKE '/us/usc/t18/%'
  AND n.heading ~* '\y(murder|manslaughter|kidnapping|assault|robbery|arson|extortion)\y'
ON CONFLICT DO NOTHING;

INSERT INTO node_tags (node_id, tag_id)
SELECT n.id, t.id FROM law_nodes n, tags t
WHERE t.slug = 'food-drugs' AND n.node_type = 'section' AND n.status = 'active'
  AND n.identifier LIKE '/us/usc/t21/%'
  AND n.heading ~* '\y(adulterated|misbranded|food|drug|dietary supplement)\y'
ON CONFLICT DO NOTHING;

INSERT INTO node_tags (node_id, tag_id)
SELECT n.id, t.id FROM law_nodes n, tags t
WHERE t.slug = 'weird' AND n.node_type = 'section' AND n.status = 'active'
  AND n.heading ~* '\y(margarine|filled milk|dentures|whale|golden eagle|smokey bear|woodsy owl|swiss army knife)\y'
ON CONFLICT DO NOTHING;

INSERT INTO node_tags (node_id, tag_id)
SELECT n.id, t.id FROM law_nodes n, tags t
WHERE t.slug = 'taxes-money' AND n.node_type = 'section' AND n.status = 'active'
  AND n.identifier LIKE '/us/usc/t26/%'
  AND n.heading ~* '\y(income tax|standard deduction|earned income|child tax credit|estate tax)\y'
ON CONFLICT DO NOTHING;

-- Chapter-scoped assignments where section headings are generic ("Unlawful
-- acts") but the chapter is unambiguous.
INSERT INTO node_tags (node_id, tag_id)
SELECT n.id, t.id FROM law_nodes n, tags t
WHERE t.slug = 'guns-weapons' AND n.node_type = 'section' AND n.status = 'active'
  AND n.identifier ~ '^/us/usc/t18/s9(2[0-9]|3[01])[a-zA-Z]?$'  -- ch. 44 Firearms, §§ 921-931
ON CONFLICT DO NOTHING;

INSERT INTO node_tags (node_id, tag_id)
SELECT n.id, t.id FROM law_nodes n, tags t
WHERE t.slug = 'privacy-surveillance' AND n.node_type = 'section' AND n.status = 'active'
  AND n.identifier ~ '^/us/usc/t18/s25(1[0-9]|2[0-3])[a-zA-Z]?$'  -- ch. 119 Wiretap Act, §§ 2510-2523
ON CONFLICT DO NOTHING;

-- Tag landing pages surface featured first; make sure everything tagged at
-- least reaches tier 1 so it gets a summary in the generation queue.
UPDATE law_nodes SET featured_tier = 1
WHERE featured_tier = 0
  AND id IN (SELECT node_id FROM node_tags);
