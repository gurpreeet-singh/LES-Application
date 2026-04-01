import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { BloomBadge } from '../../components/shared/BloomBadge';
import { DIKWBadgeFromBloom } from '../../components/shared/DIKWBadge';
import { SkeletonPage } from '../../components/shared/LoadingSkeleton';

export function StudentCourseLessonsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<any>(null);
  const [gates, setGates] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any>(`/courses/${courseId}`),
      api.get<any>(`/courses/${courseId}/kg/gates`),
      api.get<any>(`/courses/${courseId}/lessons`),
    ]).then(([c, g, l]) => {
      setCourse(c.course);
      setGates(g.gates || []);
      setLessons(l.lessons || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [courseId]);

  if (loading) return <SkeletonPage />;
  if (!course) return <div className="text-center py-16 text-gray-500">Course not found</div>;

  return (
    <div>
      <Link to="/student" className="text-[12px] text-blue-600 hover:underline mb-2 inline-block">&larr; Dashboard</Link>
      <h1 className="text-xl font-black text-gray-900 mb-1">{course.title}</h1>
      <p className="text-[12px] text-gray-500 mb-6">{lessons.length} lessons across {gates.length} units</p>

      <div className="space-y-5">
        {gates.map(g => {
          const gateLessons = lessons.filter(l => l.gate_id === g.id).sort((a: any, b: any) => a.lesson_number - b.lesson_number);
          if (gateLessons.length === 0) return null;
          return (
            <div key={g.id} className="card overflow-hidden">
              <div className="p-4 flex items-center gap-3" style={{ borderLeft: `4px solid ${g.color || '#6366f1'}` }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: g.color || '#6366f1' }}>
                  G{g.gate_number}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{g.title}</h3>
                  <p className="text-[11px] text-gray-500">{gateLessons.length} lesson{gateLessons.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="border-t border-gray-100">
                {gateLessons.map((l: any) => (
                  <Link
                    key={l.id}
                    to={`/student/courses/${courseId}/lessons/${l.id}`}
                    className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-blue-50 transition"
                  >
                    <span className="text-[11px] font-bold text-gray-400 w-7 shrink-0">L{l.lesson_number}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{l.title}</p>
                      {l.objective && <p className="text-[11px] text-gray-500 truncate">{l.objective}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {l.bloom_levels?.slice(0, 2).map((bl: string) => <BloomBadge key={bl} level={bl} />)}
                      <DIKWBadgeFromBloom bloomLevels={l.bloom_levels || []} />
                    </div>
                    <span className="text-gray-300 text-sm">&rarr;</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
