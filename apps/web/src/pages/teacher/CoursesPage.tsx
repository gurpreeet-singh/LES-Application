import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { Course } from '@leap/shared';

interface CrossEdge { gate_id: string; prerequisite_gate_id: string }
interface GateInfo { id: string; course_id: string; gate_number: number; short_title: string }
interface ProgramKG { courses: any[]; gates: GateInfo[]; cross_edges: CrossEdge[] }

export function CoursesPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', subject: '', class_level: '', section: '', academic_year: '2026-27' });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [crossEdges, setCrossEdges] = useState<{ from_course: string; to_course: string; from_gate: string; to_gate: string }[]>([]);
  const navigate = useNavigate();

  const isCollege = profile?.school === 'Horizon University College' || profile?.email?.includes('college') || profile?.email?.includes('university');

  // College instructor mapping — each course has a different professor
  const getInstructor = (c: Course) => {
    if (!isCollege) return null;
    const map: Record<string, { name: string; color: string }> = {
      'Computer Science': { name: 'Prof. Rajesh Kumar', color: '#2E75B6' },
      'Mathematics': { name: 'Prof. Sunita Iyer', color: '#1E7E34' },
      'Machine Learning': { name: 'Prof. Amit Pandey', color: '#7C3AED' },
    };
    return map[c.subject] || { name: profile?.full_name || 'Professor', color: '#6B7280' };
  };

  useEffect(() => {
    api.get<{ courses: Course[] }>('/courses').then(d => {
      setCourses(d.courses);
      setLoading(false);

      // For college teachers, fetch cross-course edges
      const activeCourses = d.courses.filter(c => c.status === 'active');
      if (activeCourses.length >= 2) {
        api.get<ProgramKG>(`/programs/prog-default/kg`).then(pkg => {
          const gateMap = new Map(pkg.gates.map(g => [g.id, g]));
          const courseMap = new Map(pkg.courses.map((c: any) => [c.id, c]));
          const edges = pkg.cross_edges.map(e => {
            const fg = gateMap.get(e.prerequisite_gate_id);
            const tg = gateMap.get(e.gate_id);
            return {
              from_course: fg ? courseMap.get(fg.course_id)?.title || '' : '',
              to_course: tg ? courseMap.get(tg.course_id)?.title || '' : '',
              from_gate: fg ? `G${fg.gate_number}: ${fg.short_title}` : '',
              to_gate: tg ? `G${tg.gate_number}: ${tg.short_title}` : '',
            };
          });
          setCrossEdges(edges);
        }).catch(() => {});
      }
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { course } = await api.post<{ course: Course }>('/courses', form);
    navigate(`/teacher/courses/${course.id}/upload`);
  };

  const statusConfig: Record<string, { color: string; dotColor: string; label: string; action: string; actionLabel: string }> = {
    draft: { color: 'bg-gray-100 text-gray-700', dotColor: 'bg-gray-400', label: 'Draft', action: 'upload', actionLabel: 'Upload Syllabus' },
    processing: { color: 'bg-yellow-100 text-yellow-800', dotColor: 'bg-yellow-500', label: 'Processing', action: 'upload', actionLabel: 'View Progress' },
    review: { color: 'bg-blue-100 text-blue-800', dotColor: 'bg-blue-500', label: 'Needs Review', action: 'review', actionLabel: 'Review Content' },
    active: { color: 'bg-green-100 text-green-800', dotColor: 'bg-green-500', label: 'Active', action: 'analytics', actionLabel: 'View Analytics' },
    archived: { color: 'bg-gray-100 text-gray-500', dotColor: 'bg-gray-300', label: 'Archived', action: 'detail', actionLabel: 'View' },
  };

  // Determine dependency structure for visual layout
  const activeCourses = courses.filter(c => c.status === 'active');
  const getCourseDepCount = (courseTitle: string) => crossEdges.filter(e => e.to_course === courseTitle).length;
  // Courses with 0 incoming deps are "foundation" (top row), rest are "dependent" (bottom row)
  const foundationCourses = activeCourses.filter(c => getCourseDepCount(c.title) === 0);
  const dependentCourses = activeCourses.filter(c => getCourseDepCount(c.title) > 0);
  const otherCourses = courses.filter(c => c.status !== 'active');

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex items-center justify-between"><div className="h-6 bg-gray-200 rounded w-40" /><div className="h-10 bg-gray-200 rounded-xl w-32" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map(i => <div key={i} className="card p-5 h-40" />)}</div>
      </div>
    );
  }

  const CourseCard = ({ c }: { c: Course }) => {
    const cfg = statusConfig[c.status] || statusConfig.draft;
    const instructor = getInstructor(c);
    // Find cross-course dependencies involving this course
    const incomingDeps = crossEdges.filter(e => e.to_course === c.title);
    const outgoingDeps = crossEdges.filter(e => e.from_course === c.title);

    return (
      <div key={c.id} className="card-interactive p-5">
        <Link to={`/teacher/courses/${c.id}/detail`} className="block mb-3">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-bold text-gray-900 hover:text-leap-blue transition-colors">{c.title}</h3>
            <span className={`badge whitespace-nowrap ${cfg.color}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dotColor} mr-1`} />
              {cfg.label}
            </span>
          </div>
          {instructor && (
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: instructor.color }}>
                {instructor.name.split(' ').pop()?.charAt(0)}
              </div>
              <span className="text-[11px] font-medium text-gray-700">{instructor.name}</span>
            </div>
          )}
          <p className="text-[12px] text-gray-500">{c.subject} {c.class_level && `| Level ${c.class_level}`}{c.section && ` ${c.section}`}</p>
          <p className="text-[11px] text-gray-400 mt-1">{c.academic_year}</p>
        </Link>

        {/* Cross-course dependency badges */}
        {(incomingDeps.length > 0 || outgoingDeps.length > 0) && (
          <div className="mb-3 space-y-1.5">
            {incomingDeps.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-[9px] text-purple-600 font-bold">Requires:</span>
                {[...new Set(incomingDeps.map(d => d.from_course))].map(dep => {
                  const depCourse = courses.find(x => x.title === dep);
                  const depInstructor = depCourse ? getInstructor(depCourse) : null;
                  return (
                    <span key={dep} className="text-[9px] bg-purple-50 text-purple-700 font-medium px-2 py-0.5 rounded-full">
                      {dep}{depInstructor ? ` (${depInstructor.name})` : ''}
                    </span>
                  );
                })}
              </div>
            )}
            {outgoingDeps.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-[9px] text-blue-600 font-bold">Feeds into:</span>
                {[...new Set(outgoingDeps.map(d => d.to_course))].map(dep => {
                  const depCourse = courses.find(x => x.title === dep);
                  const depInstructor = depCourse ? getInstructor(depCourse) : null;
                  return (
                    <span key={dep} className="text-[9px] bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded-full">
                      {dep}{depInstructor ? ` (${depInstructor.name})` : ''}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(c as any).processing_error && (
          <p className="text-[11px] text-red-500 mt-2 bg-red-50 p-2 rounded-lg">{(c as any).processing_error}</p>
        )}
        {c.status === 'processing' && (
          <div className="flex items-center gap-2 mt-2 text-[11px] text-blue-600"><span className="pulse-dot">●</span> AI is processing your syllabus...</div>
        )}

        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <Link to={`/teacher/courses/${c.id}/detail`} className="btn-secondary flex-1 text-center text-[12px] py-2">View Details</Link>
          <Link to={`/teacher/courses/${c.id}/${cfg.action}`} className="btn-primary flex-1 text-center text-[12px] py-2">{cfg.actionLabel}</Link>
          <button onClick={async (e) => { e.stopPropagation(); if (!confirm(`Delete "${c.title}"? This cannot be undone.`)) return; setDeleting(c.id); try { await api.delete(`/courses/${c.id}`); setCourses(prev => prev.filter(x => x.id !== c.id)); } catch { alert('Failed to delete course'); } setDeleting(null); }} disabled={deleting === c.id} className="px-2 py-2 rounded-xl text-[12px] text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" aria-label={`Delete ${c.title}`}>{deleting === c.id ? '...' : '🗑'}</button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-black text-gray-900">My Courses</h1>
        <div className="flex gap-2">
          {isCollege && activeCourses.length >= 2 && (
            <Link to="/teacher/programs/prog-default" className="btn-secondary text-[12px] flex items-center gap-1.5">
              <span className="text-purple-600">◆</span> Program Graph
            </Link>
          )}
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ New Course</button>
        </div>
      </div>

      {showCreate && (
        <div className="card p-6 mb-6 fade-in shadow-card-lg">
          <h2 className="text-lg font-bold mb-4">Create New Course</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="section-header block mb-1.5">Course Title</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field" required placeholder={isCollege ? 'e.g., CS 301 — Machine Learning' : 'e.g., Class 5 Mathematics'} /></div>
            <div><label className="section-header block mb-1.5">Subject</label><input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="input-field" required placeholder={isCollege ? 'e.g., Computer Science' : 'e.g., Mathematics'} /></div>
            <div><label className="section-header block mb-1.5">{isCollege ? 'Course Level' : 'Class Level'}</label><input value={form.class_level} onChange={e => setForm({ ...form, class_level: e.target.value })} className="input-field" placeholder={isCollege ? 'e.g., 301' : 'e.g., 5'} /></div>
            <div><label className="section-header block mb-1.5">Section</label><input value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} className="input-field" placeholder="e.g., A" /></div>
            <div><label className="section-header block mb-1.5">Academic Year</label><input value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })} className="input-field" /></div>
            <div className="col-span-2 flex gap-2 justify-end pt-2"><button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Create & Upload Syllabus</button></div>
          </form>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-lg font-bold text-gray-700 mb-2">No courses yet</p>
          <p className="text-sm text-gray-500">Create your first course and upload a syllabus to get started.</p>
        </div>
      ) : isCollege && crossEdges.length > 0 ? (
        /* College view: dependency-aware layout */
        <div className="space-y-6">
          {/* Foundation courses (no incoming dependencies) */}
          {foundationCourses.length > 0 && (
            <div>
              <h2 className="section-header mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-leap-blue inline-block" />
                Foundation Courses
                <span className="text-[9px] text-gray-300 normal-case tracking-normal font-normal">— can be taken in parallel</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {foundationCourses.map(c => <CourseCard key={c.id} c={c} />)}
              </div>
            </div>
          )}

          {/* Dependency arrows */}
          {foundationCourses.length > 0 && dependentCourses.length > 0 && (
            <div className="flex justify-center py-2">
              <div className="flex flex-col items-center">
                <div className="w-px h-6 bg-purple-300" />
                <div className="text-[10px] font-bold text-purple-500 bg-purple-50 px-3 py-1 rounded-full">
                  Prerequisites feed into ↓
                </div>
                <div className="w-px h-6 bg-purple-300" />
              </div>
            </div>
          )}

          {/* Dependent courses (have incoming dependencies) */}
          {dependentCourses.length > 0 && (
            <div>
              <h2 className="section-header mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                Advanced Courses
                <span className="text-[9px] text-gray-300 normal-case tracking-normal font-normal">— require foundation courses</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dependentCourses.map(c => <CourseCard key={c.id} c={c} />)}
              </div>
            </div>
          )}

          {/* Cross-Course Dependency Summary */}
          <div className="card p-4 bg-purple-50/30 border-l-4 border-l-purple-400">
            <h3 className="text-[10px] font-bold text-purple-800 uppercase tracking-wider mb-2">Cross-Course Gate Dependencies</h3>
            <div className="space-y-1">
              {crossEdges.slice(0, 6).map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="font-medium text-gray-700">{e.from_gate}</span>
                  <span className="text-[9px] text-gray-400">({e.from_course})</span>
                  <span className="text-purple-500 font-bold">→</span>
                  <span className="font-medium text-gray-700">{e.to_gate}</span>
                  <span className="text-[9px] text-gray-400">({e.to_course})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Other (draft/archived) courses */}
          {otherCourses.length > 0 && (
            <div>
              <h2 className="section-header mb-3">Other Courses</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherCourses.map(c => <CourseCard key={c.id} c={c} />)}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* School view: standard grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(c => <CourseCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}
