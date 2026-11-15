CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"module" varchar(64) NOT NULL,
	"name_ar" varchar(150) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" varchar(64),
	"user_agent" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name_ar" varchar(120) NOT NULL,
	"description" varchar(255),
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"is_granted" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"email" varchar(160) NOT NULL,
	"phone" varchar(30),
	"password_hash" varchar(255) NOT NULL,
	"role_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_name" varchar(150),
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" varchar(100),
	"before_data" jsonb,
	"after_data" jsonb,
	"metadata" jsonb,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assistant_code" varchar(40) NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"calculation_method" varchar(48) DEFAULT 'SESSION_COMMISSION_PERCENT' NOT NULL,
	"rate_value" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"custom_formula_note" text,
	"status" varchar(24) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_code" varchar(40) NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"phone" varchar(30),
	"guardian_phone" varchar(30),
	"grade_level" varchar(80) NOT NULL,
	"registration_date" date NOT NULL,
	"status" varchar(24) DEFAULT 'ACTIVE' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(8) NOT NULL,
	"end_time" varchar(8) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_code" varchar(40) NOT NULL,
	"user_id" uuid,
	"full_name" varchar(160) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"specialization" varchar(100) NOT NULL,
	"contract_date" date NOT NULL,
	"employment_status" varchar(24) DEFAULT 'ACTIVE' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom_maintenances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"classroom_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"reason" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classrooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_number" varchar(32) NOT NULL,
	"name" varchar(120) NOT NULL,
	"max_capacity" integer NOT NULL,
	"seats_count" integer NOT NULL,
	"equipment" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(24) DEFAULT 'AVAILABLE' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"agreed_monthly_price" numeric(12, 2) NOT NULL,
	"agreed_sessions_count" integer NOT NULL,
	"agreed_session_price" numeric(12, 2) NOT NULL,
	"status" varchar(24) DEFAULT 'ACTIVE' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"revenue_split_method" varchar(48) DEFAULT 'ACTUAL_ATTENDANCE_RATIO' NOT NULL,
	"teacher_share_per_student" numeric(12, 2) NOT NULL,
	"center_share_per_student" numeric(12, 2) NOT NULL,
	"teacher_percentage" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"full_month_absence_policy" varchar(48) DEFAULT 'EXEMPT_FULL_ABSENCE' NOT NULL,
	"full_absence_fixed_fee" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"charge_excused_absence" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_assistants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"assistant_id" uuid NOT NULL,
	"override_calculation_method" varchar(48),
	"override_rate_value" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code" varchar(40) NOT NULL,
	"name" varchar(160) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"grade_level" varchar(80) NOT NULL,
	"primary_teacher_id" uuid NOT NULL,
	"default_classroom_id" uuid,
	"monthly_sessions_count" integer NOT NULL,
	"monthly_price" numeric(12, 2) NOT NULL,
	"calculated_session_price" numeric(12, 2) NOT NULL,
	"schedule_slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_students" integer DEFAULT 50 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" varchar(24) NOT NULL,
	"recorded_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"notes" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"classroom_id" uuid,
	"session_date" date NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"start_time" varchar(8) NOT NULL,
	"end_time" varchar(8) NOT NULL,
	"status" varchar(24) DEFAULT 'SCHEDULED' NOT NULL,
	"topic" varchar(200),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_dues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assistant_id" uuid NOT NULL,
	"group_id" uuid,
	"year_month" varchar(7) NOT NULL,
	"calculation_method" varchar(48) NOT NULL,
	"sessions_count" integer DEFAULT 0 NOT NULL,
	"students_count" integer DEFAULT 0 NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"calculation_breakdown" text,
	"is_locked" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_monthly_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assistant_id" uuid NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"calculation_method_snapshot" varchar(48) NOT NULL,
	"total_dues" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_paid_out" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"remaining_balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"details_note" text,
	"is_closed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_number" varchar(50) NOT NULL,
	"assistant_id" uuid NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payout_date" date NOT NULL,
	"payment_method" varchar(32) DEFAULT 'CASH' NOT NULL,
	"paid_by_user_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(48) NOT NULL,
	"title" varchar(180) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"expense_date" date NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"payment_method" varchar(32) DEFAULT 'CASH' NOT NULL,
	"recorded_by_user_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"student_monthly_record_id" uuid,
	"group_id" uuid NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"allocated_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_number" varchar(50) NOT NULL,
	"student_id" uuid NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"payment_method" varchar(32) DEFAULT 'CASH' NOT NULL,
	"received_by_user_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_monthly_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"total_group_sessions" integer DEFAULT 0 NOT NULL,
	"eligible_sessions" integer DEFAULT 0 NOT NULL,
	"present_count" integer DEFAULT 0 NOT NULL,
	"absent_count" integer DEFAULT 0 NOT NULL,
	"excused_count" integer DEFAULT 0 NOT NULL,
	"makeup_attended_count" integer DEFAULT 0 NOT NULL,
	"session_price_snapshot" numeric(12, 2) NOT NULL,
	"extra_makeup_fees" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_due" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_paid" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"remaining_balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_dues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"executed_sessions_count" integer DEFAULT 0 NOT NULL,
	"students_count" integer DEFAULT 0 NOT NULL,
	"gross_group_revenue" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"teacher_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"center_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"calculation_breakdown" text,
	"is_locked" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_monthly_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"groups_count" integer DEFAULT 0 NOT NULL,
	"executed_sessions_count" integer DEFAULT 0 NOT NULL,
	"total_dues" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_paid_out" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"remaining_balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_number" varchar(50) NOT NULL,
	"teacher_id" uuid NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payout_date" date NOT NULL,
	"payment_method" varchar(32) DEFAULT 'CASH' NOT NULL,
	"paid_by_user_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(64),
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"trigger_type" varchar(32) NOT NULL,
	"destinations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checksum" varchar(64),
	"status" varchar(24) NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auto_backup_enabled" boolean DEFAULT true NOT NULL,
	"schedule_time" varchar(8) DEFAULT '02:00' NOT NULL,
	"retention_count" integer DEFAULT 30 NOT NULL,
	"local_path" varchar(500),
	"google_drive_enabled" boolean DEFAULT false NOT NULL,
	"google_drive_tokens" jsonb,
	"dropbox_enabled" boolean DEFAULT false NOT NULL,
	"dropbox_tokens" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" varchar(32) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"center_name" varchar(200) DEFAULT 'سنتر النخبة التعليمي' NOT NULL,
	"center_subtitle" varchar(255) DEFAULT 'نظام الإدارة المتكامل',
	"logo_url" text,
	"phone" varchar(50),
	"address" varchar(255),
	"academic_year" varchar(50) DEFAULT '2026 / 2027',
	"currency_symbol" varchar(20) DEFAULT 'ج.م',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_maintenances" ADD CONSTRAINT "classroom_maintenances_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_policies" ADD CONSTRAINT "financial_policies_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_assistants" ADD CONSTRAINT "group_assistants_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_assistants" ADD CONSTRAINT "group_assistants_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_teachers" ADD CONSTRAINT "group_teachers_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_teachers" ADD CONSTRAINT "group_teachers_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_primary_teacher_id_teachers_id_fk" FOREIGN KEY ("primary_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_default_classroom_id_classrooms_id_fk" FOREIGN KEY ("default_classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_dues" ADD CONSTRAINT "assistant_dues_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_dues" ADD CONSTRAINT "assistant_dues_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_monthly_records" ADD CONSTRAINT "assistant_monthly_records_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_payouts" ADD CONSTRAINT "assistant_payouts_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_payouts" ADD CONSTRAINT "assistant_payouts_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_student_monthly_record_id_student_monthly_records_id_fk" FOREIGN KEY ("student_monthly_record_id") REFERENCES "public"."student_monthly_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_monthly_records" ADD CONSTRAINT "student_monthly_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_monthly_records" ADD CONSTRAINT "student_monthly_records_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_dues" ADD CONSTRAINT "teacher_dues_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_dues" ADD CONSTRAINT "teacher_dues_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_monthly_records" ADD CONSTRAINT "teacher_monthly_records_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_payouts" ADD CONSTRAINT "teacher_payouts_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_payouts" ADD CONSTRAINT "teacher_payouts_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_permissions_code" ON "permissions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_permissions_module" ON "permissions" USING btree ("module");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_expires" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_role_permission" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_role" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_roles_code" ON "roles" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_permission_override" ON "user_permissions" USING btree ("user_id","permission_id");--> statement-breakpoint
CREATE INDEX "idx_user_permissions_user" ON "user_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_users_active_created" ON "users" USING btree ("is_active","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assistants_code" ON "assistants" USING btree ("assistant_code");--> statement-breakpoint
CREATE INDEX "idx_assistants_name" ON "assistants" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "idx_assistants_status" ON "assistants" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_students_code" ON "students" USING btree ("student_code");--> statement-breakpoint
CREATE INDEX "idx_students_name" ON "students" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "idx_students_phone" ON "students" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_students_guardian_phone" ON "students" USING btree ("guardian_phone");--> statement-breakpoint
CREATE INDEX "idx_students_status_grade" ON "students" USING btree ("status","grade_level");--> statement-breakpoint
CREATE INDEX "idx_teacher_avail_teacher_day" ON "teacher_availability" USING btree ("teacher_id","day_of_week");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_teachers_code" ON "teachers" USING btree ("teacher_code");--> statement-breakpoint
CREATE INDEX "idx_teachers_name" ON "teachers" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "idx_teachers_specialization" ON "teachers" USING btree ("specialization");--> statement-breakpoint
CREATE INDEX "idx_teachers_status" ON "teachers" USING btree ("employment_status");--> statement-breakpoint
CREATE INDEX "idx_teachers_user" ON "teachers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_classroom_maint_range" ON "classroom_maintenances" USING btree ("classroom_id","start_at","end_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_classrooms_room_number" ON "classrooms" USING btree ("room_number");--> statement-breakpoint
CREATE INDEX "idx_classrooms_status" ON "classrooms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_enrollments_student_status" ON "enrollments" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "idx_enrollments_group_status" ON "enrollments" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "idx_enrollments_dates" ON "enrollments" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_financial_policies_group" ON "financial_policies" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_group_assistant" ON "group_assistants" USING btree ("group_id","assistant_id");--> statement-breakpoint
CREATE INDEX "idx_group_assistants_assistant" ON "group_assistants" USING btree ("assistant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_group_teacher" ON "group_teachers" USING btree ("group_id","teacher_id");--> statement-breakpoint
CREATE INDEX "idx_group_teachers_teacher" ON "group_teachers" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_groups_code" ON "groups" USING btree ("group_code");--> statement-breakpoint
CREATE INDEX "idx_groups_teacher" ON "groups" USING btree ("primary_teacher_id");--> statement-breakpoint
CREATE INDEX "idx_groups_active_grade" ON "groups" USING btree ("is_active","grade_level");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_attendance_session_student" ON "attendance" USING btree ("session_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_student" ON "attendance" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_status" ON "attendance" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sessions_group_month" ON "sessions" USING btree ("group_id","year_month");--> statement-breakpoint
CREATE INDEX "idx_sessions_date" ON "sessions" USING btree ("session_date");--> statement-breakpoint
CREATE INDEX "idx_sessions_teacher_date" ON "sessions" USING btree ("teacher_id","session_date");--> statement-breakpoint
CREATE INDEX "idx_sessions_classroom_date" ON "sessions" USING btree ("classroom_id","session_date");--> statement-breakpoint
CREATE INDEX "idx_assistant_dues_assistant_month" ON "assistant_dues" USING btree ("assistant_id","year_month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assistant_monthly" ON "assistant_monthly_records" USING btree ("assistant_id","year_month");--> statement-breakpoint
CREATE INDEX "idx_assistant_monthly_month" ON "assistant_monthly_records" USING btree ("year_month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assistant_payouts_ref" ON "assistant_payouts" USING btree ("reference_number");--> statement-breakpoint
CREATE INDEX "idx_assistant_payouts_assistant_month" ON "assistant_payouts" USING btree ("assistant_id","year_month");--> statement-breakpoint
CREATE INDEX "idx_expenses_month_category" ON "expenses" USING btree ("year_month","category");--> statement-breakpoint
CREATE INDEX "idx_expenses_date" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "idx_payment_alloc_payment" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_payment_alloc_group_month" ON "payment_allocations" USING btree ("group_id","year_month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payments_receipt" ON "payments" USING btree ("receipt_number");--> statement-breakpoint
CREATE INDEX "idx_payments_student_month" ON "payments" USING btree ("student_id","year_month");--> statement-breakpoint
CREATE INDEX "idx_payments_date" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_student_monthly_group" ON "student_monthly_records" USING btree ("student_id","group_id","year_month");--> statement-breakpoint
CREATE INDEX "idx_student_monthly_month" ON "student_monthly_records" USING btree ("year_month");--> statement-breakpoint
CREATE INDEX "idx_student_monthly_group" ON "student_monthly_records" USING btree ("group_id","year_month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_teacher_dues_group_month" ON "teacher_dues" USING btree ("teacher_id","group_id","year_month");--> statement-breakpoint
CREATE INDEX "idx_teacher_dues_month" ON "teacher_dues" USING btree ("year_month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_teacher_monthly" ON "teacher_monthly_records" USING btree ("teacher_id","year_month");--> statement-breakpoint
CREATE INDEX "idx_teacher_monthly_month" ON "teacher_monthly_records" USING btree ("year_month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_teacher_payouts_ref" ON "teacher_payouts" USING btree ("reference_number");--> statement-breakpoint
CREATE INDEX "idx_teacher_payouts_teacher_month" ON "teacher_payouts" USING btree ("teacher_id","year_month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_grade_levels_name" ON "grade_levels" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_grade_levels_code" ON "grade_levels" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_grade_levels_order" ON "grade_levels" USING btree ("order_index");--> statement-breakpoint
CREATE INDEX "idx_grade_levels_active" ON "grade_levels" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_backup_records_created" ON "backup_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_backup_records_status" ON "backup_records" USING btree ("status");