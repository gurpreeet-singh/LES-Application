import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { seedDemoCourse } from '../services/demo-seeder.service.js';
import { seedHUCDemoCourses } from '../services/huc-demo-seeder.service.js';

const router = Router();

// POST /auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  const { email, password, full_name, role } = req.body;

  if (!email || !password || !full_name || !role) {
    res.status(400).json({ error: 'email, password, full_name, and role are required' });
    return;
  }

  if (!['student', 'teacher'].includes(role)) {
    res.status(400).json({ error: 'role must be student or teacher' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  // Ensure profile exists (trigger may not fire in all Supabase configs)
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', data.user.id)
    .single();

  if (!existingProfile) {
    await supabaseAdmin.from('profiles').insert({
      id: data.user.id,
      email,
      full_name,
      role,
    });
  }

  // Generate a session for the new user
  const { data: session, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    res.status(500).json({ error: 'Account created but failed to sign in' });
    return;
  }

  // Seed demo course for new teacher accounts (non-blocking)
  if (role === 'teacher') {
    const isCollege = email.includes('college') || email.includes('university') || email.includes('hu.ac.ae') || req.body.demo_type === 'college';
    if (isCollege) {
      seedHUCDemoCourses(supabaseAdmin, data.user.id).then(result => {
        console.log(`College demo seeded for ${email}: ${result.courseIds}`);
      }).catch(err => {
        console.error(`College demo seed failed for ${email}:`, err.message);
      });
    } else {
      seedDemoCourse(supabaseAdmin, data.user.id).then(courseId => {
        console.log(`Demo course seeded for ${email}: ${courseId}`);
      }).catch(err => {
        console.error(`Demo seed failed for ${email}:`, err.message);
      });
    }
  }

  res.status(201).json({
    user: data.user,
    session: session.session,
  });
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    res.status(401).json({ error: error.message });
    return;
  }

  // Seed demo course for teachers with no courses (non-blocking)
  const role = data.user?.user_metadata?.role;
  if (role === 'teacher') {
    const { count } = await supabaseAdmin.from('courses').select('id', { count: 'exact', head: true }).eq('teacher_id', data.user.id);
    if (count === 0) {
      seedDemoCourse(supabaseAdmin, data.user.id).then(courseId => {
        console.log(`Demo course seeded on login for ${email}: ${courseId}`);
      }).catch(err => {
        console.error(`Demo seed failed for ${email}:`, err.message);
      });
    }
  }

  res.json({
    user: data.user,
    session: data.session,
  });
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    res.status(400).json({ error: 'refresh_token is required' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token });
  if (error || !data.session) {
    res.status(401).json({ error: 'Failed to refresh session' });
    return;
  }

  res.json({ session: data.session });
});

// POST /auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  if (req.accessToken) {
    await supabaseAdmin.auth.admin.signOut(req.accessToken);
  }
  res.json({ message: 'Logged out' });
});

// GET /auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  res.json({ profile: req.user });
});

// PUT /auth/me
router.put('/me', authenticate, async (req: Request, res: Response) => {
  const { full_name, school, class_section, role } = req.body;

  const updates: Record<string, string> = {};
  if (full_name) updates.full_name = full_name;
  if (school) updates.school = school;
  if (class_section) updates.class_section = class_section;
  if (role && ['student', 'teacher'].includes(role)) updates.role = role;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', req.user!.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ profile: data });
});

export default router;
