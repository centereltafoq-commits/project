CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_trgm_students_name ON students USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_students_code ON students USING gin (student_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_students_phone ON students USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_students_guardian ON students USING gin (guardian_phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trgm_teachers_name ON teachers USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_teachers_code ON teachers USING gin (teacher_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trgm_assistants_name ON assistants USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_groups_name ON groups USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_payments_receipt ON payments USING gin (receipt_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_users_name ON users USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trgm_users_email ON users USING gin (email gin_trgm_ops);

