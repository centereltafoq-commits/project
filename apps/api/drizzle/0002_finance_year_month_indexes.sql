CREATE INDEX "idx_sessions_year_month" ON "sessions" USING btree ("year_month");--> statement-breakpoint
CREATE INDEX "idx_payment_allocations_year_month" ON "payment_allocations" USING btree ("year_month");--> statement-breakpoint
CREATE INDEX "idx_payments_year_month" ON "payments" USING btree ("year_month");