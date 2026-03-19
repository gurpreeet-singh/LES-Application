import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Course } from '@les/shared';

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', subject: '', class_level: '', section: '', academic_year: '2026-27' });
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ courses: Course[] }>('/courses').then(d => {
      setCourses(d.courses);
      setLoading(false);
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

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-gray-200 rounded w-40" />
          <div className="h-10 bg-gray-200 rounded-xl w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="card p-5 h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-black text-gray-900">My Courses</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + New Course
        </button>
      </div>

      {showCreate && (
        <div className="card p-6 mb-6 fade-in shadow-card-lg">
          <h2 className="text-lg font-bold mb-4">Create New Course</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="section-header block mb-1.5">Course Title</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field" required placeholder="e.g., Class 5 Mathematics" />
            </div>
            <div>
              <label className="section-header block mb-1.5">Subject</label>
              <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="input-field" required placeholder="e.g., Mathematics" />
            </div>
            <div>
              <label className="section-header block mb-1.5">Class Level</label>
              <input value={form.class_level} onChange={e => setForm({ ...form, class_level: e.target.value })} className="input-field" placeholder="e.g., 5" />
            </div>
            <div>
              <label className="section-header block mb-1.5">Section</label>
              <input value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} className="input-field" placeholder="e.g., B" />
            </div>
            <div>
              <label className="section-header block mb-1.5">Academic Year</label>
              <input value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })} className="input-field" />
            </div>
            <div className="col-span-2 flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Create & Upload Syllabus</button>
            </div>
          </form>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-lg font-bold text-gray-700 mb-2">No courses yet</p>
          <p className="text-sm text-gray-500">Create your first course and upload a syllabus to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(c => {
            const cfg = statusConfig[c.status] || statusConfig.draft;
            return (
              <div key={c.id} className="card-interactive p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-gray-900">{c.title}</h3>
                  <span className={`badge whitespace-nowrap ${cfg.color}`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dotColor} mr-1`} />
                    {cfg.label}
                  </span>
                </div>
                <p className="text-[12px] text-gray-500">{c.subject} {c.class_level && `| Class ${c.class_level}`}{c.section && ` ${c.section}`}</p>
                <p className="text-[11px] text-gray-400 mt-1">{c.academic_year}</p>

                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                  <Link
                    to={`/teacher/courses/${c.id}/detail`}
                    className="btn-secondary flex-1 text-center text-[12px] py-2"
                  >
                    View Details
                  </Link>
                  <Link
                    to={`/teacher/courses/${c.id}/${cfg.action}`}
                    className="btn-primary flex-1 text-center text-[12px] py-2"
                  >
                    {cfg.actionLabel}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
