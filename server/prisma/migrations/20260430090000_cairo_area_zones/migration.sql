WITH cairo AS (
  SELECT id FROM "zones" WHERE name = 'القاهرة'
)
INSERT INTO "zones" ("id", "name", "description", "basePrice", "parentId", "createdAt", "updatedAt")
SELECT area.id, area.name, 'منطقة ' || area.name || ' - القاهرة', 0, cairo.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  VALUES
    ('8a333001-0001-4000-9000-000000000001', 'مدينة نصر'),
    ('8a333001-0002-4000-9000-000000000002', 'مصر الجديدة'),
    ('8a333001-0003-4000-9000-000000000003', 'المعادي'),
    ('8a333001-0004-4000-9000-000000000004', 'التجمع الخامس'),
    ('8a333001-0005-4000-9000-000000000005', 'وسط البلد'),
    ('8a333001-0006-4000-9000-000000000006', 'شبرا'),
    ('8a333001-0007-4000-9000-000000000007', 'حلوان'),
    ('8a333001-0008-4000-9000-000000000008', 'المرج'),
    ('8a333001-0009-4000-9000-000000000009', 'عين شمس'),
    ('8a333001-0010-4000-9000-000000000010', 'الزمالك'),
    ('8a333001-0011-4000-9000-000000000011', 'المقطم')
) AS area(id, name)
CROSS JOIN cairo
ON CONFLICT ("name") DO UPDATE SET
  "parentId" = (SELECT id FROM "zones" WHERE name = 'القاهرة'),
  "description" = EXCLUDED."description",
  "updatedAt" = CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "zones_parentId_idx" ON "zones"("parentId");
