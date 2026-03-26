-- Performance indexes for analytics and progress queries
CREATE INDEX IF NOT EXISTS idx_student_gate_progress_student ON student_gate_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_student_gate_progress_course ON student_gate_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_student_gate_progress_gate ON student_gate_progress(gate_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_student ON question_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_gate ON question_attempts(gate_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_question ON question_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_student ON enrollments(course_id, student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_gate ON lessons(gate_id);
CREATE INDEX IF NOT EXISTS idx_questions_gate_course ON questions(gate_id, course_id);
CREATE INDEX IF NOT EXISTS idx_gates_course ON gates(course_id);
