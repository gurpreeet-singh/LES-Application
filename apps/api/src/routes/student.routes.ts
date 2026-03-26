import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireRole } from '../middleware/role.js';

const router = Router({ mergeParams: true });

// GET /courses/:courseId/students
router.get('/', requireRole('teacher'), async (req: Request, res: Response) => {
  const courseId = req.params.courseId;

  const { data: enrollments, error } = await supabaseAdmin
    .from('enrollments')
    .select('student_id, profiles:student_id(id, email, full_name, role, school, class_section)')
    .eq('course_id', courseId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const students = (enrollments || []).map(e => {
    const p = (e as any).profiles || {};
    return {
      id: e.student_id,
      full_name: p.full_name || 'Unknown',
      email: p.email || '',
      class_section: p.class_section || '',
      roll_number: '',
      phone: '',
      parent_name: '',
      parent_phone: '',
    };
  });

  res.json({ students });
});

// POST /courses/:courseId/students — Add a single student
router.post('/', requireRole('teacher'), async (req: Request, res: Response) => {
  const courseId = req.params.courseId;
  const { full_name, email, roll_number, phone, parent_name, parent_phone } = req.body;

  if (!full_name || !email) {
    res.status(400).json({ error: 'full_name and email are required' });
    return;
  }

  // Create user account
  const { data: user, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: 'student123',
    email_confirm: true,
    user_metadata: { full_name, role: 'student' },
  });

  if (createErr) {
    // User might already exist — try to find them
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      // Enroll existing user
      await supabaseAdmin.from('enrollments').insert({ course_id: courseId, student_id: existing.id });
      res.json({ student: { id: existing.id, full_name, email, roll_number, phone, parent_name, parent_phone } });
      return;
    }

    res.status(400).json({ error: createErr.message });
    return;
  }

  // Create profile
  await supabaseAdmin.from('profiles').insert({
    id: user.user.id,
    email,
    full_name,
    role: 'student',
    class_section: roll_number || '',
  });

  // Enroll in course
  await supabaseAdmin.from('enrollments').insert({
    course_id: courseId,
    student_id: user.user.id,
  });

  res.status(201).json({
    student: { id: user.user.id, full_name, email, roll_number, phone, parent_name, parent_phone },
  });
});

// POST /courses/:courseId/students/upload — Bulk CSV upload
router.post('/upload', requireRole('teacher'), async (req: Request, res: Response) => {
  const courseId = req.params.courseId;
  const { students: rows } = req.body;

  if (!Array.isArray(rows)) {
    res.status(400).json({ error: 'students array required' });
    return;
  }

  const created: any[] = [];

  for (const row of rows) {
    const name = row.name || row.full_name || '';
    const email = row.email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.${Date.now()}@student.lmgc.edu`;

    if (!name) continue;

    try {
      const { data: user } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: 'student123',
        email_confirm: true,
        user_metadata: { full_name: name, role: 'student' },
      });

      if (user?.user) {
        await supabaseAdmin.from('profiles').insert({
          id: user.user.id, email, full_name: name, role: 'student',
          class_section: `${row.class || ''}${row.section || ''}`.trim() || row.class_section || '',
        });

        await supabaseAdmin.from('enrollments').insert({
          course_id: courseId,
          student_id: user.user.id,
        });

        created.push({
          id: user.user.id, full_name: name, email,
          roll_number: row.roll_number || '',
          class_section: row.class_section || `${row.class || ''}${row.section || ''}`.trim(),
        });
      }
    } catch { /* skip failed rows */ }
  }

  res.json({ students: created, count: created.length });
});

export default router;
