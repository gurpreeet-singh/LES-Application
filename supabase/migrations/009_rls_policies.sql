-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_bloom_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socratic_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_gate_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_profiles ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Courses
CREATE POLICY "Teachers manage own courses" ON public.courses FOR ALL USING (teacher_id = auth.uid());
CREATE POLICY "Students see enrolled courses" ON public.courses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = courses.id AND student_id = auth.uid())
);

-- Enrollments
CREATE POLICY "Teachers manage enrollments" ON public.enrollments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.courses WHERE id = enrollments.course_id AND teacher_id = auth.uid())
);
CREATE POLICY "Students see own enrollment" ON public.enrollments FOR SELECT USING (student_id = auth.uid());

-- Gates (read access for enrolled students and course teacher)
CREATE POLICY "Course participants view gates" ON public.gates FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    LEFT JOIN public.enrollments e ON e.course_id = c.id
    WHERE c.id = gates.course_id AND (c.teacher_id = auth.uid() OR e.student_id = auth.uid())
  )
);
CREATE POLICY "Teachers manage gates" ON public.gates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.courses WHERE id = gates.course_id AND teacher_id = auth.uid())
);

-- Sub-concepts, prerequisites, bloom targets follow gates pattern
CREATE POLICY "View sub-concepts" ON public.sub_concepts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.gates g JOIN public.courses c ON c.id = g.course_id
    WHERE g.id = sub_concepts.gate_id AND (c.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = c.id AND student_id = auth.uid()))
  )
);
CREATE POLICY "Teachers manage sub-concepts" ON public.sub_concepts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.gates g JOIN public.courses c ON c.id = g.course_id WHERE g.id = sub_concepts.gate_id AND c.teacher_id = auth.uid())
);

-- Lessons
CREATE POLICY "View lessons" ON public.lessons FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = lessons.course_id AND (c.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = c.id AND student_id = auth.uid()))
  )
);
CREATE POLICY "Teachers manage lessons" ON public.lessons FOR ALL USING (
  EXISTS (SELECT 1 FROM public.courses WHERE id = lessons.course_id AND teacher_id = auth.uid())
);

-- Socratic scripts follow lessons
CREATE POLICY "View scripts" ON public.socratic_scripts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.lessons l JOIN public.courses c ON c.id = l.course_id WHERE l.id = socratic_scripts.lesson_id AND (c.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = c.id AND student_id = auth.uid())))
);
CREATE POLICY "Teachers manage scripts" ON public.socratic_scripts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.lessons l JOIN public.courses c ON c.id = l.course_id WHERE l.id = socratic_scripts.lesson_id AND c.teacher_id = auth.uid())
);

-- Questions
CREATE POLICY "View questions" ON public.questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.courses c WHERE c.id = questions.course_id AND (c.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = c.id AND student_id = auth.uid())))
);
CREATE POLICY "Teachers manage questions" ON public.questions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.courses WHERE id = questions.course_id AND teacher_id = auth.uid())
);

-- Student progress
CREATE POLICY "Students manage own progress" ON public.student_gate_progress FOR ALL USING (student_id = auth.uid());
CREATE POLICY "Teachers view student progress" ON public.student_gate_progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.courses WHERE id = student_gate_progress.course_id AND teacher_id = auth.uid())
);

-- Question attempts
CREATE POLICY "Students manage own attempts" ON public.question_attempts FOR ALL USING (student_id = auth.uid());
CREATE POLICY "Teachers view attempts" ON public.question_attempts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.gates g JOIN public.courses c ON c.id = g.course_id WHERE g.id = question_attempts.gate_id AND c.teacher_id = auth.uid())
);

-- AI Suggestions
CREATE POLICY "Teachers manage suggestions" ON public.ai_suggestions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.courses WHERE id = ai_suggestions.course_id AND teacher_id = auth.uid())
);

-- Learning profiles
CREATE POLICY "Students see own profile" ON public.learning_profiles FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Teachers view profiles" ON public.learning_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.courses WHERE id = learning_profiles.course_id AND teacher_id = auth.uid())
);

-- Gate prerequisites
CREATE POLICY "View prerequisites" ON public.gate_prerequisites FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.gates g JOIN public.courses c ON c.id = g.course_id WHERE g.id = gate_prerequisites.gate_id AND (c.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = c.id AND student_id = auth.uid())))
);
CREATE POLICY "Teachers manage prerequisites" ON public.gate_prerequisites FOR ALL USING (
  EXISTS (SELECT 1 FROM public.gates g JOIN public.courses c ON c.id = g.course_id WHERE g.id = gate_prerequisites.gate_id AND c.teacher_id = auth.uid())
);

-- Bloom targets
CREATE POLICY "View bloom targets" ON public.gate_bloom_targets FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.gates g JOIN public.courses c ON c.id = g.course_id WHERE g.id = gate_bloom_targets.gate_id AND (c.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = c.id AND student_id = auth.uid())))
);
CREATE POLICY "Teachers manage bloom targets" ON public.gate_bloom_targets FOR ALL USING (
  EXISTS (SELECT 1 FROM public.gates g JOIN public.courses c ON c.id = g.course_id WHERE g.id = gate_bloom_targets.gate_id AND c.teacher_id = auth.uid())
);
