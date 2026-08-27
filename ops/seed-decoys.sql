-- Decoy laws for "Can't Make It Up" — plausible, USC-idiom, entirely invented.
-- Each insert is skipped if a real law happens to share the citation.
-- Idempotent (ON CONFLICT DO NOTHING on unique citation).

INSERT INTO decoys (citation, heading)
SELECT v.citation, v.heading FROM (VALUES
  ('18 U.S.C. § 1247', 'Interstate transportation of untagged beehives'),
  ('16 U.S.C. § 3389', 'Unauthorized feeding of migratory waterfowl on federal levees'),
  ('21 U.S.C. § 469', 'False representation of maple syrup grade'),
  ('18 U.S.C. § 719', 'Unauthorized reproduction of the Presidential Seal on confectionery'),
  ('15 U.S.C. § 1263a', 'Sale of novelty barometers containing free mercury'),
  ('18 U.S.C. § 1739', 'Mailing of live scorpions without conspicuous labeling'),
  ('16 U.S.C. § 470dd-1', 'Removal of petrified wood for commercial souvenir purposes'),
  ('21 U.S.C. § 1049', 'Standards for the curvature of frozen breaded shrimp'),
  ('15 U.S.C. § 6309a', 'Misrepresentation of the weight class of professional axe-throwing implements'),
  ('18 U.S.C. § 47a', 'Use of aircraft to herd wild burros for wagering purposes'),
  ('42 U.S.C. § 3020f', 'Certification of shuffleboard courts at federally assisted senior centers'),
  ('16 U.S.C. § 916m', 'Souvenir rights in beached whale skeletons on federal shores'),
  ('18 U.S.C. § 1170a', 'Sale of replica dinosaur fossils without provenance disclosure'),
  ('21 U.S.C. § 350m', 'Maximum permissible foam height of dispensed root beer'),
  ('15 U.S.C. § 2089', 'Recall authority over self-balancing unicycles'),
  ('18 U.S.C. § 2199a', 'Stowaways aboard federally registered hot-air balloons'),
  ('16 U.S.C. § 668e', 'Commercial photography of bald eagle nests for greeting cards'),
  ('18 U.S.C. § 514a', 'Passing of wooden nickels with intent to defraud'),
  ('21 U.S.C. § 461a', 'Mandatory disclosure of the country of origin of fortune cookie fortunes'),
  ('15 U.S.C. § 7706a', 'Unsolicited facsimile transmission of restaurant menus across state lines'),
  ('18 U.S.C. § 1865a', 'Operation of unlicensed ferris wheels within national parks'),
  ('42 U.S.C. § 300j-27', 'Federal standards for drinking fountain arc height in public buildings'),
  ('18 U.S.C. § 336a', 'Issuance of private currency redeemable in livestock'),
  ('16 U.S.C. § 1338b', 'Adoption of surplus lighthouse foghorns by coastal municipalities'),
  ('21 U.S.C. § 379kk', 'Premarket notification for glow-in-the-dark dental floss'),
  ('18 U.S.C. § 712a', 'Commercial impersonation of a federal groundhog meteorologist'),
  ('15 U.S.C. § 1459a', 'Slack fill limits for novelty gift boxes shipped by air'),
  ('18 U.S.C. § 1387', 'Unauthorized wearing of military-style epaulettes in civil court'),
  ('16 U.S.C. § 4601a', 'Licensing of commercial acorn harvesting on national forest floors'),
  ('42 U.S.C. § 262b', 'Interstate shipment of expired novelty vaccines for display purposes'),
  ('18 U.S.C. § 43a', 'Use of federally protected carrier pigeons for advertising purposes'),
  ('21 U.S.C. § 331z', 'Introduction of left-handed surgical instruments without special labeling'),
  ('15 U.S.C. § 45c', 'Deceptive claims regarding the loudness of decorative wind chimes'),
  ('18 U.S.C. § 894a', 'Collection of debts by singing telegram'),
  ('16 U.S.C. § 703a', 'Compensation for crop damage caused by federally protected parade balloons'),
  ('18 U.S.C. § 1697', 'Private carriage of postcards for hire on interstate ferries')
) AS v(citation, heading)
WHERE NOT EXISTS (SELECT 1 FROM law_nodes n WHERE n.citation = v.citation)
ON CONFLICT (citation) DO NOTHING;
