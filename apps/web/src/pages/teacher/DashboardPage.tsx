import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { JourneySteps } from '../../components/shared/JourneySteps';
import { MyDayPanel } from '../../components/teacher/MyDayPanel';
import type { Course } from '@leap/shared';

interface SessionAnalytics {
  current_session: number;
  total_sessions: number;
  sessions: { session_number: number; lesson_title: string; gate_number: number; gate_color: string; gate_short_title: string; status: string }[];
  course_stats: { overall_completion_pct: number; students_on_track: number; students_at_risk: number };
}

export function TeacherDashboardPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessionData, setSessionData] = useState<Record<string, SessionAnalytics>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ courses: Course[] }>('/courses').then(async d => {
      setCourses(d.courses);

      // Fetch session analytics for active courses
      const activeCourses = d.courses.filter(c => c.status === 'active');
      const sessionPromises = activeCourses.map(async c => {
        try {
          const sa = await api.get<SessionAnalytics>(`/courses/${c.id}/analytics/sessions`);
          return { courseId: c.id, data: sa };
        } catch {
          return null;
        }
      });
      const results = await Promise.all(sessionPromises);
      const map: Record<string, SessionAnalytics> = {};
      results.forEach(r => { if (r) map[r.courseId] = r.data; });
      setSessionData(map);
      setLoading(false);
    });
  }, []);

  const activeCourses = courses.filter(c => c.status === 'active');
  const reviewCourses = courses.filter(c => c.status === 'review');
  const draftCourses = courses.filter(c => c.status === 'draft' || c.status === 'processing');
  const isCollege = profile?.school === 'Horizon University College' || profile?.email?.includes('hu.ac.ae') || profile?.email?.includes('college') || profile?.email?.includes('university') || profile?.email?.includes('hu.ac.ae');

  // Calculate real totals
  const totalStudents = Object.values(sessionData).reduce((max, sa) => {
    const studentCount = sa.course_stats.students_on_track + sa.course_stats.students_at_risk;
    return Math.max(max, studentCount);
  }, 0);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-6 bg-gray-200 rounded w-56 mb-2" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="card p-4 h-24" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="card p-5 h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-gray-900">Welcome, {profile?.full_name}</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <Link to="/teacher/courses" className="btn-primary">Manage Courses</Link>
      </div>

      {/* My Day Schedule */}
      <MyDayPanel />

      {/* Program Banner — shown for college teachers with 3+ active courses */}
      {activeCourses.length >= 1 && isCollege && (
        <div className="card p-5 mb-6 border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50/50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-purple-900 mb-1">Cross-Course Knowledge Graph</h2>
              <p className="text-[12px] text-gray-600">Your courses have cross-course dependencies. View the unified knowledge graph to see how topics connect across courses and identify student bottlenecks.</p>
            </div>
            <Link to={`/teacher/programs/prog-default`} className="btn-primary text-[11px] py-1.5 bg-purple-700 whitespace-nowrap ml-4">View Program Graph</Link>
          </div>
        </div>
      )}

      {/* Welcome Guide Banner — shown when teacher has only demo course or just signed up */}
      {courses.length <= 1 && (
        <div className="card p-5 mb-6 border-l-4 border-l-leap-blue bg-gradient-to-r from-blue-50/50 to-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-black text-leap-navy mb-1">Welcome to LEAP</h2>
              <p className="text-[12px] text-gray-600 mb-3 max-w-lg">
                We've set up a <strong>demo course</strong> (Class 5 Mathematics) so you can explore all features — lessons, Socratic scripts, analytics, AI grading, and more.
                When you're ready, create your own course with your syllabus.
              </p>
              <div className="flex gap-2">
                <Link to="/teacher/guide" className="btn-secondary text-[11px] py-1.5">Read the Platform Guide</Link>
                <Link to="/teacher/courses" className="btn-primary text-[11px] py-1.5">Create Your Own Course</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-leap-navy/10 flex items-center justify-center text-lg">📚</div>
            <div>
              <p className="text-2xl font-black text-leap-navy">{courses.length}</p>
              <p className="text-[11px] text-gray-500">Total Courses</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-lg">✅</div>
            <div>
              <p className="text-2xl font-black text-leap-green">{activeCourses.length}</p>
              <p className="text-[11px] text-gray-500">Active Courses</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-lg">🎓</div>
            <div>
              <p className="text-2xl font-black text-leap-blue">{totalStudents || '—'}</p>
              <p className="text-[11px] text-gray-500">Total Students</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-lg">⚠️</div>
            <div>
              <p className="text-2xl font-black text-leap-amber">{reviewCourses.length + draftCourses.length}</p>
              <p className="text-[11px] text-gray-500">Needs Action</p>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Agenda — from real session data */}
      {activeCourses.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="section-header mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-leap-blue inline-block" />
            Today's Agenda — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          </h2>
          <div className="space-y-4">
            {activeCourses.map(c => {
              const sa = sessionData[c.id];
              const currentSessionNum = sa?.current_session || 1;
              const totalSessions = sa?.total_sessions || c.total_sessions || 30;
              const currentSessionInfo = sa?.sessions.find(s => s.session_number === currentSessionNum);
              const completionPct = sa?.course_stats.overall_completion_pct || 0;

              return (
                <div key={c.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-leap-navy/10 flex items-center justify-center">
                        <span className="text-leap-navy font-black text-[13px]">{c.class_level || 'C'}{c.section || ''}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{c.title}</p>
                        <p className="text-[11px] text-gray-400">Class {c.class_level}{c.section && `-${c.section}`} | {c.academic_year}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-gray-400">Progress</p>
                      <p className="text-sm font-black text-leap-navy">{completionPct}%</p>
                    </div>
                  </div>

                  {/* Today's lesson from real data */}
                  <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="badge bg-leap-navy text-white text-[9px]">Session {currentSessionNum}</span>
                          {currentSessionInfo && (
                            <span className="badge text-white text-[9px]" style={{ background: currentSessionInfo.gate_color }}>
                              G{currentSessionInfo.gate_number}: {currentSessionInfo.gate_short_title}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-gray-900">
                          {currentSessionInfo?.lesson_title || `Session ${currentSessionNum}`}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {c.session_duration_minutes || 40} min | Lesson plan, Socratic script & quiz ready
                        </p>
                      </div>
                      <Link to={`/teacher/courses/${c.id}/detail`} className="btn-primary text-[10px] py-1.5">
                        Open Course
                      </Link>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Link to={`/teacher/courses/${c.id}/detail`} className="btn-secondary text-[10px] py-1.5 flex-1 text-center">Course Detail</Link>
                    <Link to={`/teacher/courses/${c.id}/analytics`} className="btn-secondary text-[10px] py-1.5 flex-1 text-center">Analytics</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="card p-12 text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Get Started</h2>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">Create your first course and upload a syllabus to generate lesson plans, quizzes, and knowledge graphs with AI.</p>
          <Link to="/teacher/courses" className="btn-primary inline-block">Create Course</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Needs Review → links to AI Guide (analytics page) */}
          {reviewCourses.length > 0 && (
            <div>
              <h2 className="section-header mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
                <span className="text-yellow-700">Needs Review — AI Suggestions Ready</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviewCourses.map(c => (
                  <Link key={c.id} to={`/teacher/courses/${c.id}/analytics`} className="card-interactive p-5 border-l-4 border-l-yellow-400">
                    <h3 className="font-bold text-gray-900">{c.title}</h3>
                    <p className="text-[12px] text-gray-500 mt-1">{c.subject} | AI has generated suggestions — review and approve</p>
                    <div className="mt-2"><JourneySteps status={c.status} compact /></div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {activeCourses.length > 0 && (
            <div>
              <h2 className="section-header mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <span className="text-green-700">Active Courses</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeCourses.map(c => {
                  const sa = sessionData[c.id];
                  return (
                    <Link key={c.id} to={`/teacher/courses/${c.id}/detail`} className="card-interactive p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900">{c.title}</h3>
                        {sa && <span className="badge bg-blue-100 text-blue-700">Session {sa.current_session}/{sa.total_sessions}</span>}
                      </div>
                      <p className="text-[12px] text-gray-500 mt-1">{c.subject} {c.class_level && `| Class ${c.class_level}${c.section || ''}`}</p>
                      <div className="mt-2"><JourneySteps status={c.status} compact /></div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {draftCourses.length > 0 && (
            <div>
              <h2 className="section-header mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                <span className="text-gray-500">Drafts</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {draftCourses.map(c => (
                  <Link key={c.id} to={`/teacher/courses/${c.id}/upload`} className="card-interactive p-5 opacity-75">
                    <h3 className="font-bold text-gray-900">{c.title}</h3>
                    <p className="text-[12px] text-gray-500 mt-1">{c.status === 'processing' ? 'Processing...' : 'Upload syllabus to continue'}</p>
                    <div className="mt-2"><JourneySteps status={c.status} compact /></div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
