DO $$
DECLARE
  conflicting_pairs text;
BEGIN
  SELECT string_agg(format('group_id=%s student_id=%s active_count=%s', group_id, student_id, active_count), '; ')
  INTO conflicting_pairs
  FROM (
    SELECT group_id, student_id, count(*) AS active_count
    FROM enrollments
    WHERE status = 'ACTIVE'
    GROUP BY group_id, student_id
    HAVING count(*) > 1
    ORDER BY group_id, student_id
    LIMIT 20
  ) AS duplicates;

  IF conflicting_pairs IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add the active enrollment unique index. Review these duplicate group/student pairs first: %', conflicting_pairs;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_enrollments_group_student_active" ON "enrollments" USING btree ("group_id","student_id") WHERE "enrollments"."status" = 'ACTIVE';
