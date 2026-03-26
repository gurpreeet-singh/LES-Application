import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface Student {
  id: string;
  full_name: string;
  email: string;
  roll_number?: string;
  class_section?: string;
  phone?: string;
  parent_name?: string;
  parent_phone?: string;
}

export function StudentsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [courseName, setCourseName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', roll_number: '', phone: '', parent_name: '', parent_phone: '' });
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ students: Student[] }>(`/courses/${courseId}/students`),
      api.get<{ course: any }>(`/courses/${courseId}`),
    ]).then(([s, c]) => {
      setStudents(s.students || []);
      setCourseName(c.course?.title || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [courseId]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await api.post<{ student: Student }>(`/courses/${courseId}/students`, form);
    if (result.student) setStudents(prev => [...prev, result.student]);
    setForm({ full_name: '', email: '', roll_number: '', phone: '', parent_name: '', parent_phone: '' });
    setShowAdd(false);
  };

  const [uploadError, setUploadError] = useState('');

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        setUploadError('CSV must have a header row and at least one student row.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

      // Flexible header matching — accept common variations
      const nameCol = headers.findIndex(h => ['name', 'full_name', 'student name', 'student_name'].includes(h));
      if (nameCol === -1) {
        setUploadError('CSV must have a "name" or "full_name" column. Found headers: ' + headers.join(', '));
        return;
      }

      const emailCol = headers.findIndex(h => ['email', 'email_address', 'student email'].includes(h));
      const rollCol = headers.findIndex(h => ['roll_number', 'roll', 'roll no', 'roll_no'].includes(h));
      const phoneCol = headers.findIndex(h => ['phone', 'mobile', 'phone_number'].includes(h));
      const parentCol = headers.findIndex(h => ['parent_name', 'parent', 'guardian'].includes(h));

      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        return {
          name: vals[nameCol] || '',
          full_name: vals[nameCol] || '',
          email: emailCol >= 0 ? vals[emailCol] : '',
          roll_number: rollCol >= 0 ? vals[rollCol] : '',
          phone: phoneCol >= 0 ? vals[phoneCol] : '',
          parent_name: parentCol >= 0 ? vals[parentCol] : '',
        };
      }).filter(r => r.name.trim());

      if (rows.length === 0) {
        setUploadError('No valid student rows found in CSV.');
        return;
      }

      try {
        const result = await api.post<{ students: Student[]; count: number }>(`/courses/${courseId}/students/upload`, { students: rows });
        if (result.students) setStudents(prev => [...prev, ...result.students]);
        setUploadError(`${result.count || result.students?.length || 0} students added successfully.`);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv = 'name,roll_number,class,section,email,phone,parent_name,parent_phone\nStudent Name,01,5,B,student@school.edu,9876543210,Parent Name,9876543211\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_roster_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="animate-pulse"><div className="h-6 bg-gray-200 rounded w-48 mb-4" /><div className="card p-4 h-64" /></div>;

  return (
    <div>
      <Link to={`/teacher/courses/${courseId}/detail`} className="text-[12px] text-blue-600 hover:underline mb-2 inline-block">&larr; Back to Course</Link>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-gray-900">Students — {courseName}</h1>
          <p className="text-[12px] text-gray-400">{students.length} students enrolled</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="btn-secondary text-[11px] py-1.5">📥 Download CSV Template</button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="btn-secondary text-[11px] py-1.5">📤 Upload CSV</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-[11px] py-1.5">+ Add Student</button>
        </div>
      </div>

      {/* Add student form */}
      {showAdd && (
        <div className="card p-5 mb-5 fade-in shadow-card-lg">
          <h3 className="text-sm font-bold mb-3">Add Student</h3>
          <form onSubmit={handleAddStudent} className="grid grid-cols-3 gap-3">
            <div>
              <label className="section-header block mb-1">Full Name *</label>
              <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="input-field text-[12px]" required />
            </div>
            <div>
              <label className="section-header block mb-1">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field text-[12px]" required />
            </div>
            <div>
              <label className="section-header block mb-1">Roll Number</label>
              <input value={form.roll_number} onChange={e => setForm({ ...form, roll_number: e.target.value })} className="input-field text-[12px]" />
            </div>
            <div>
              <label className="section-header block mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field text-[12px]" />
            </div>
            <div>
              <label className="section-header block mb-1">Parent Name</label>
              <input value={form.parent_name} onChange={e => setForm({ ...form, parent_name: e.target.value })} className="input-field text-[12px]" />
            </div>
            <div>
              <label className="section-header block mb-1">Parent Phone</label>
              <input value={form.parent_phone} onChange={e => setForm({ ...form, parent_phone: e.target.value })} className="input-field text-[12px]" />
            </div>
            <div className="col-span-3 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary text-[12px]">Cancel</button>
              <button type="submit" className="btn-primary text-[12px]">Add Student</button>
            </div>
          </form>
        </div>
      )}

      {uploadError && (
        <div className={`text-sm p-3 rounded-xl mb-4 ${uploadError.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`} role="alert">{uploadError}</div>
      )}

      {/* Students table */}
      {students.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-lg font-bold text-gray-700 mb-2">No students enrolled yet</p>
          <p className="text-[12px] text-gray-500 mb-4">Upload a CSV file or add students manually to get started.</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => fileRef.current?.click()} className="btn-secondary">Upload CSV</button>
            <button onClick={() => setShowAdd(true)} className="btn-primary">Add Student</button>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">#</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Name</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Roll No.</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Section</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Email</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Phone</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">Parent</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="py-2.5 px-4 text-[12px] text-gray-400">{i + 1}</td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-leap-navy text-white flex items-center justify-center text-[10px] font-bold">{s.full_name.charAt(0)}</div>
                      <span className="text-[12px] font-medium text-gray-900">{s.full_name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-[12px] text-gray-600">{s.roll_number || '—'}</td>
                  <td className="py-2.5 px-4 text-[12px] text-gray-600">{s.class_section || '—'}</td>
                  <td className="py-2.5 px-4 text-[12px] text-gray-500">{s.email}</td>
                  <td className="py-2.5 px-4 text-[12px] text-gray-500">{s.phone || '—'}</td>
                  <td className="py-2.5 px-4 text-[12px] text-gray-500">{s.parent_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
