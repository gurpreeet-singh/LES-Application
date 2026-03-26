import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import type { Profile } from '@leap/shared';

declare global {
  namespace Express {
    interface Request {
      user?: Profile;
      accessToken?: string;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Auto-create profile from auth metadata if missing
  if (!profile) {
    const meta = user.user_metadata || {};
    const { data: created, error: insertErr } = await supabaseAdmin.from('profiles').insert({
      id: user.id,
      email: user.email!,
      full_name: meta.full_name || user.email!.split('@')[0],
      role: meta.role || 'student',
    }).select().single();

    if (insertErr || !created) {
      console.error('Profile auto-create failed:', insertErr?.message, 'userId:', user.id);
      res.status(401).json({ error: 'User profile not found' });
      return;
    }
    profile = created;
  }

  req.user = profile as Profile;
  req.accessToken = token;
  next();
}
