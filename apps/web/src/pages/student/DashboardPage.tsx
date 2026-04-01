import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { BloomRadar } from '../../components/shared/BloomRadar';
import { VelocitySVG } from '../../components/shared/VelocitySVG';
import { BloomBadge } from '../../components/shared/BloomBadge';
import { getMasteryColor, getMasteryLabel } from '../../lib/utils';
import type { Course, StudentGateProgress, Gate, LearningProfile } from '@leap/shared';
import { getDIKWFromBloomScores, getMasteryLevel } from '@leap/shared';
import { DIKWPyramid } from '../../components/shared/DIKWPyramid';

export function StudentDashboardPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [progress, setProgress] = useState<(StudentGateProgress & { gate?: { gate_number: number; title: string; short_title: string; color: string } })[]>([]);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [selectedGate, setSelectedGate] = useState<string | null>(null);
  const [selectedCourseIdx, setSelectedCourseIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadCourseData = async (coursesList: Course[], idx: number) => {
    if (coursesList.length === 0 || idx >= coursesList.length) return;
    const courseId = coursesList[idx].id;
    try {
      const [kgData, progData] = await Promise.all([
        api.get<{ gates: Gate[] }>(`/courses/${courseId}/kg/gates`),
        api.get<{ progress: typeof progress; learning_profile: LearningProfile }>(`/students/${profile!.id}/progress?course_id=${courseId}`),
      ]);
      setGates(kgData.gates);
      setProgress(progData.progress);
      setLearningProfile(progData.learning_profile);
      setSelectedGate(null);
    } catch { /* keep current state */ }
  };

  useEffect(() => {
    api.get<{ courses: Course[] }>('/courses').then(async (d) => {
      setCourses(d.courses);
      if (d.courses.length > 0) {
        await loadCourseData(d.courses, 0);
      }
      setLoading(false);
    });
  }, [profile]);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-48" /><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="card p-4 h-20" />)}</div><div className="card p-6 h-64" /></div>;

  if (courses.length === 0) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">No courses yet</h2>
        <p className="text-sm text-gray-500">Your teacher will enroll you in a course.</p>
      </div>
    );
  }

  const gatesMastered = progress.filter(p => p.mastery_pct >= 80).length;
  const gatesAtRisk = progress.filter(p => p.mastery_pct > 0 && p.mastery_pct < 60).length;
  const overallMastery = progress.length > 0
    ? Math.round(progress.filter(p => p.mastery_pct > 0).reduce((s, p) => s + p.mastery_pct, 0) / Math.max(1, progress.filter(p => p.mastery_pct > 0).length))
    : 0;

  const selProgress = progress.find(p => p.gate_id === selectedGate);
  const selGate = gates.find(g => g.id === selectedGate);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hello, {profile?.full_name}</h1>
          <p className="text-sm text-gray-500">{courses[selectedCourseIdx]?.title} | Overall: {overallMastery}%</p>
        </div>
        {courses.length > 1 && (
          <select
            value={selectedCourseIdx}
            onChange={e => { const idx = Number(e.target.value); setSelectedCourseIdx(idx); loadCourseData(courses, idx); }}
            className="input-field py-2 px-3 text-[12px] w-auto"
          >
            {courses.map((c, i) => (
              <option key={c.id} value={i}>{c.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-600">{gatesMastered}</p>
          <p className="text-xs text-gray-500">Gates Mastered</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-red-600">{gatesAtRisk}</p>
          <p className="text-xs text-gray-500">At Risk</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-600">{overallMastery}%</p>
          <p className="text-xs text-gray-500">Overall Mastery</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-purple-600">{gates.length}</p>
          <p className="text-xs text-gray-500">Total Gates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* KG Journey + Detail */}
        <div className="col-span-3">
          {/* Gate Journey */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Knowledge Graph Journey</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {gates.map(g => {
                const p = progress.find(pr => pr.gate_id === g.id);
                const mastery = p?.mastery_pct || 0;
                const mc = getMasteryColor(mastery);
                const isLocked = !p?.is_unlocked;

                return (
                  <button
                    key={g.id}
                    onClick={() => !isLocked && setSelectedGate(selectedGate === g.id ? null : g.id)}
                    className={`gate-node flex-shrink-0 w-32 p-3 rounded-xl border text-center ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${selectedGate === g.id ? 'ring-2 ring-offset-1' : ''}`}
                    style={{ borderColor: g.color, background: mc.bg, ...(selectedGate === g.id ? { ringColor: g.color } : {}) }}
                    disabled={isLocked}
                  >
                    <div className="text-lg font-bold" style={{ color: mc.txt }}>{mastery}%</div>
                    <div className="text-xs font-semibold mt-1" style={{ color: g.color }}>G{g.gate_number}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{g.short_title}</div>
                    {isLocked && <div className="text-xs mt-1">🔒</div>}
                    {!isLocked && <Link to={`/student/courses/${courses[selectedCourseIdx]?.id}/quiz/${g.id}`} className="text-[9px] font-bold text-white px-2 py-0.5 rounded-lg mt-1 inline-block" style={{ background: g.color }} onClick={e => e.stopPropagation()}>Take Quiz</Link>}
                    {p?.bloom_ceiling && <BloomBadge level={p.bloom_ceiling} className="mt-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gate Detail */}
          {selProgress && selGate && (
            <div className="fade-in bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">G{selGate.gate_number}: {selGate.title}</h3>
                <button onClick={() => setSelectedGate(null)} className="text-gray-400 hover:text-gray-600">&#10005;</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Sub-Concepts</p>
                  {selGate.sub_concepts?.map(sc => (
                    <div key={sc.id} className="flex items-center justify-between py-1 text-sm">
                      <span className="text-gray-700">{sc.title}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Bloom's Radar</p>
                  <BloomRadar data={selProgress.bloom_scores} color={selGate.color} size={180} />
                  <BloomBadge level={selProgress.bloom_ceiling} className="mt-2" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Progress</p>
                  <VelocitySVG data={selProgress.velocity} color={selGate.color} />
                  <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-lg font-bold" style={{ color: selGate.color }}>{selProgress.mastery_pct}%</p>
                      <p className="text-xs text-gray-500">Mastery</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-gray-700">{getMasteryLabel(selProgress.mastery_pct)}</p>
                      <p className="text-xs text-gray-500">Status</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* DIKW Learning Journey */}
          {progress.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Your Learning Journey</h3>
              {(() => {
                // Aggregate DIKW from all gate bloom_scores
                const totals = { data: 0, information: 0, knowledge: 0, wisdom: 0 };
                let count = 0;
                for (const p of progress) {
                  if (p.bloom_scores) {
                    const dikw = getDIKWFromBloomScores(p.bloom_scores as Record<string, number>);
                    totals.data += dikw.data;
                    totals.information += dikw.information;
                    totals.knowledge += dikw.knowledge;
                    totals.wisdom += dikw.wisdom;
                    count++;
                  }
                }
                const avg = count > 0 ? {
                  data: Math.round(totals.data / count) as number,
                  information: Math.round(totals.information / count) as number,
                  knowledge: Math.round(totals.knowledge / count) as number,
                  wisdom: Math.round(totals.wisdom / count) as number,
                } : { data: 0, information: 0, knowledge: 0, wisdom: 0 };

                // Determine strongest level
                const levels = Object.entries(avg).sort((a, b) => b[1] - a[1]);
                const strongest = levels[0];
                const developing = levels.find(l => l[1] > 0 && l[1] < 50);

                return (
                  <>
                    <DIKWPyramid scores={avg} size={180} />
                    <p className="text-[11px] text-gray-600 text-center mt-2">
                      Strong at <span className="font-bold text-gray-800">{strongest[0]}</span> ({strongest[1]}%)
                      {developing && <>, developing <span className="font-bold text-gray-800">{developing[0]}</span> ({developing[1]}%)</>}
                    </p>
                  </>
                );
              })()}
            </div>
          )}

          {learningProfile && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Learning Style</h3>
              {(['logical', 'visual', 'reflective', 'kinesthetic', 'auditory'] as const).map(key => (
                <div key={key} className="mb-2">
                  <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                    <span className="capitalize">{key}</span>
                    <span>{learningProfile[key]}%</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${learningProfile[key]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Mastery Progression</h3>
            {progress.map(p => {
              const g = gates.find(g => g.id === p.gate_id);
              if (!g) return null;
              const ml = getMasteryLevel(p.mastery_pct);
              return (
                <div key={p.gate_id} className="flex items-center gap-2 mb-2 text-xs">
                  <span className="text-gray-500 w-5 font-bold">G{g.gate_number}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-gray-600">{g.short_title}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: ml.bg, color: ml.color }}>{ml.label}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${p.mastery_pct}%`, background: ml.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
