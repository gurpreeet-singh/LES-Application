import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { JourneySteps } from '../../components/shared/JourneySteps';
import type { Course } from '@les/shared';

export function TeacherDashboardPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ courses: Course[] }>('/courses').then(d => {
      setCourses(d.courses);
      setLoading(false);
    });
  }, []);

  const activeCourses = courses.filter(c => c.status === 'active');
  const reviewCourses = courses.filter(c => c.status === 'review');
  const draftCourses = courses.filter(c => c.status === 'draft' || c.status === 'processing');

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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-gray-900">Welcome, {profile?.full_name}</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <Link to="/teacher/courses" className="btn-primary">
          Manage Courses
        </Link>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-les-navy/10 flex items-center justify-center text-lg">📚</div>
            <div>
              <p className="text-2xl font-black text-les-navy">{courses.length}</p>
              <p className="text-[11px] text-gray-500">Total Courses</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-lg">✅</div>
            <div>
              <p className="text-2xl font-black text-les-green">{activeCourses.length}</p>
              <p className="text-[11px] text-gray-500">Active Courses</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-lg">🎓</div>
            <div>
              <p className="text-2xl font-black text-les-blue">8</p>
              <p className="text-[11px] text-gray-500">Total Students</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-lg">⚠️</div>
            <div>
              <p className="text-2xl font-black text-les-amber">{reviewCourses.length + draftCourses.length}</p>
              <p className="text-[11px] text-gray-500">Needs Action</p>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Agenda — specific lessons per class */}
      {activeCourses.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="section-header mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-les-blue inline-block" />
            Today's Agenda — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          </h2>
          <div className="space-y-4">
            {activeCourses.map(c => {
              // Mock: current session for each active course
              const currentSession = 18;
              const totalSessions = c.total_sessions || 30;
              // Session-specific lesson info
              const lessonTitles: Record<string, { title: string; gate: string; gateColor: string }> = {
                'course-001': { title: 'Operations with Decimals', gate: 'G4: Decimals', gateColor: '#B45309' },
              };
              const lessonInfo = lessonTitles[c.id] || { title: `Session ${currentSession} Lesson`, gate: c.subject, gateColor: '#2E75B6' };

              return (
                <div key={c.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-les-navy/10 flex items-center justify-center">
                        <span className="text-les-navy font-black text-[13px]">{c.class_level || 'C'}{c.section || ''}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{c.title}</p>
                        <p className="text-[11px] text-gray-400">Class {c.class_level}{c.section && `-${c.section}`} | {c.academic_year}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-gray-400">Progress</p>
                      <p className="text-sm font-black text-les-navy">{Math.round((currentSession / totalSessions) * 100)}%</p>
                    </div>
                  </div>

                  {/* Today's lesson for this class */}
                  <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="badge bg-les-navy text-white text-[9px]">Session {currentSession}</span>
                          <span className="badge text-white text-[9px]" style={{ background: lessonInfo.gateColor }}>{lessonInfo.gate}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-900">{lessonInfo.title}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">40 min | Lesson plan, Socratic script & quiz ready</p>
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/teacher/courses/${c.id}/lessons/lesson-${currentSession}`} className="btn-primary text-[10px] py-1.5">
                          Open Lesson
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Quick links */}
                  <div className="flex gap-2 mt-3">
                    <Link to={`/teacher/courses/${c.id}/detail`} className="btn-secondary text-[10px] py-1.5 flex-1 text-center">Course Detail</Link>
                    <Link to={`/teacher/courses/${c.id}/analytics`} className="btn-secondary text-[10px] py-1.5 flex-1 text-center">Analytics</Link>
                    <Link to={`/teacher/courses/${c.id}/detail`} className="btn-secondary text-[10px] py-1.5 flex-1 text-center" onClick={() => {}}>Timetable</Link>
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
          <Link to="/teacher/courses" className="btn-primary inline-block">
            Create Course
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {reviewCourses.length > 0 && (
            <div>
              <h2 className="section-header mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
                <span className="text-yellow-700">Needs Review</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviewCourses.map(c => (
                  <Link key={c.id} to={`/teacher/courses/${c.id}/review`} className="card-interactive p-5 border-l-4 border-l-yellow-400">
                    <h3 className="font-bold text-gray-900">{c.title}</h3>
                    <p className="text-[12px] text-gray-500 mt-1">{c.subject} | AI-generated content ready for review</p>
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
                {activeCourses.map(c => (
                  <Link key={c.id} to={`/teacher/courses/${c.id}/detail`} className="card-interactive p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900">{c.title}</h3>
                      {c.total_sessions && (
                        <span className="badge bg-blue-100 text-blue-700">{c.total_sessions} sessions</span>
                      )}
                    </div>
                    <p className="text-[12px] text-gray-500 mt-1">{c.subject} {c.class_level && `| Class ${c.class_level}${c.section || ''}`}</p>
                    <div className="mt-2"><JourneySteps status={c.status} compact /></div>
                  </Link>
                ))}
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
