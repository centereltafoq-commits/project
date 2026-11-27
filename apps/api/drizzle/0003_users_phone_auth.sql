ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
UPDATE "users" SET "phone" = NULLIF(BTRIM("phone"), '') WHERE "phone" IS NOT NULL;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE "phone" IS NOT NULL
    GROUP BY "phone"
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_phone" ON "users" USING btree ("phone") WHERE "phone" IS NOT NULL;
  ELSE
    CREATE INDEX IF NOT EXISTS "idx_users_phone" ON "users" USING btree ("phone");
  END IF;
END $$;
