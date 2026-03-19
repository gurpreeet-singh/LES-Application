import type { SupabaseClient } from '@supabase/supabase-js';

interface LessonRow {
  id: string;
  gate_id: string;
  lesson_number: number;
  title: string;
  objective: string;
  duration_minutes: number;
  sort_order: number;
}

interface SessionInsert {
  course_id: string;
  session_number: number;
  lesson_id: string;
  lesson_portion: string;
  topic_summary: string;
  quiz_included: boolean;
}

export class SessionPlannerService {
  constructor(private db: SupabaseClient) {}

  async generateSessionPlan(courseId: string): Promise<void> {
    // Get course config
    const { data: course } = await this.db
      .from('courses')
      .select('total_sessions, session_duration_minutes')
      .eq('id', courseId)
      .single();

    if (!course?.total_sessions) {
      return; // No timetable config, skip
    }

    const totalSessions = course.total_sessions;
    const sessionDuration = course.session_duration_minutes || 40;

    // Get accepted lessons in order
    const { data: lessons } = await this.db
      .from('lessons')
      .select('id, gate_id, lesson_number, title, objective, duration_minutes, sort_order')
      .eq('course_id', courseId)
      .in('status', ['accepted', 'edited'])
      .order('sort_order', { ascending: true });

    if (!lessons || lessons.length === 0) return;

    // Clear existing session plan
    await this.db.from('session_plan').delete().eq('course_id', courseId);

    // Auto-distribute lessons across sessions
    const sessionInserts: SessionInsert[] = [];
    let currentSession = 1;
    let remainingTime = sessionDuration;

    for (const lesson of lessons as LessonRow[]) {
      if (currentSession > totalSessions) break;

      const lessonDuration = lesson.duration_minutes || 40;

      if (lessonDuration <= remainingTime) {
        // Fits in current session
        sessionInserts.push({
          course_id: courseId,
          session_number: currentSession,
          lesson_id: lesson.id,
          lesson_portion: 'full',
          topic_summary: `${lesson.title}: ${lesson.objective}`,
          quiz_included: true,
        });
        remainingTime -= lessonDuration;

        // If very little time left, move to next session
        if (remainingTime < 10) {
          currentSession++;
          remainingTime = sessionDuration;
        }
      } else if (lessonDuration <= sessionDuration * 1.2) {
        // Slightly over — give it a full session
        if (remainingTime < sessionDuration) {
          currentSession++;
          remainingTime = sessionDuration;
        }
        if (currentSession > totalSessions) break;

        sessionInserts.push({
          course_id: courseId,
          session_number: currentSession,
          lesson_id: lesson.id,
          lesson_portion: 'full',
          topic_summary: `${lesson.title}: ${lesson.objective}`,
          quiz_included: true,
        });
        currentSession++;
        remainingTime = sessionDuration;
      } else {
        // Need to split across sessions
        const halfDuration = Math.ceil(lessonDuration / 2);

        // First half
        if (remainingTime < halfDuration) {
          currentSession++;
          remainingTime = sessionDuration;
        }
        if (currentSession > totalSessions) break;

        sessionInserts.push({
          course_id: courseId,
          session_number: currentSession,
          lesson_id: lesson.id,
          lesson_portion: 'first-half',
          topic_summary: `${lesson.title} (Part 1): ${lesson.objective}`,
          quiz_included: false,
        });
        currentSession++;
        remainingTime = sessionDuration;

        if (currentSession > totalSessions) break;

        // Second half
        sessionInserts.push({
          course_id: courseId,
          session_number: currentSession,
          lesson_id: lesson.id,
          lesson_portion: 'second-half',
          topic_summary: `${lesson.title} (Part 2): Review & Practice`,
          quiz_included: true,
        });
        remainingTime = sessionDuration - halfDuration;

        if (remainingTime < 10) {
          currentSession++;
          remainingTime = sessionDuration;
        }
      }
    }

    // Insert all session plan rows
    if (sessionInserts.length > 0) {
      await this.db.from('session_plan').insert(sessionInserts);
    }
  }
}
