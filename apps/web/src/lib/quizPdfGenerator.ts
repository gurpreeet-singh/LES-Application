interface QuizQuestion {
  question_text: string;
  question_type: string;
  bloom_level: string;
  options?: { text: string; is_correct: boolean }[];
  correct_answer?: string;
  rubric?: string;
}

interface QuizMeta {
  lessonNumber: number;
  lessonTitle: string;
  gateName: string;
  gateColor: string;
  subject: string;
  classLevel: string;
  section: string;
  teacherName: string;
  schoolName: string;
  duration: number;
}

function groupByType(questions: QuizQuestion[]) {
  const mcq = questions.filter(q => q.question_type === 'mcq');
  const tf = questions.filter(q => q.question_type === 'true_false');
  const short = questions.filter(q => q.question_type === 'short_answer');
  const open = questions.filter(q => q.question_type === 'open_ended');
  return { mcq, tf, short, open };
}

function marksAllocation(groups: ReturnType<typeof groupByType>) {
  return {
    mcq: { count: groups.mcq.length, each: 2, total: groups.mcq.length * 2 },
    tf: { count: groups.tf.length, each: 1, total: groups.tf.length * 1 },
    short: { count: groups.short.length, each: 4, total: groups.short.length * 4 },
    open: { count: groups.open.length, each: 5, total: groups.open.length * 5 },
  };
}

export function generateQuizSheetPDF(questions: QuizQuestion[], meta: QuizMeta) {
  const groups = groupByType(questions);
  const marks = marksAllocation(groups);
  const totalMarks = marks.mcq.total + marks.tf.total + marks.short.total + marks.open.total;

  let qNum = 0;

  const html = `<!DOCTYPE html><html><head><title>Quiz Sheet - Session ${meta.lessonNumber}</title>
<style>
  @page { margin: 20mm 15mm; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #1F2937; font-size: 13px; line-height: 1.5; }
  .header { text-align: center; border-bottom: 2px solid #1B3A6B; padding-bottom: 10px; margin-bottom: 12px; }
  .header h1 { font-size: 18px; color: #1B3A6B; margin: 0; }
  .header p { margin: 2px 0; font-size: 12px; color: #374151; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; font-size: 12px; margin-bottom: 12px; border: 1px solid #D1D5DB; padding: 10px; border-radius: 6px; }
  .info-grid .label { color: #6B7280; }
  .info-grid .value { font-weight: 600; }
  .student-fields { border: 1px solid #1B3A6B; padding: 12px; border-radius: 6px; margin-bottom: 15px; background: #F9FAFB; }
  .student-fields .field { margin-bottom: 8px; font-size: 13px; }
  .student-fields .line { display: inline-block; border-bottom: 1px solid #374151; width: 250px; margin-left: 8px; }
  .student-fields .short-line { width: 100px; }
  .quiz-title { background: #1B3A6B; color: white; padding: 8px 14px; border-radius: 6px; font-size: 14px; font-weight: 700; margin-bottom: 15px; }
  .section-header { background: #F3F4F6; padding: 6px 12px; border-radius: 4px; font-weight: 700; font-size: 12px; color: #374151; margin: 15px 0 10px 0; border-left: 3px solid ${meta.gateColor}; }
  .question { margin-bottom: 14px; page-break-inside: avoid; }
  .q-text { font-weight: 500; margin-bottom: 6px; }
  .q-num { font-weight: 700; color: #1B3A6B; }
  .option { margin-left: 20px; margin-bottom: 3px; font-size: 12px; }
  .bubble { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #374151; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  .bubble.filled { background: #1B3A6B; }
  .answer-line { border-bottom: 1px solid #D1D5DB; height: 28px; margin: 4px 0 4px 20px; }
  .tf-row { display: flex; gap: 30px; margin-left: 20px; margin-top: 4px; }
  .footer { border-top: 2px solid #1B3A6B; padding-top: 10px; margin-top: 20px; display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; }
  .marks-box { border: 2px solid #1B3A6B; padding: 6px 16px; border-radius: 4px; }
</style></head><body>

<div class="header">
  <h1>La Martiniere Girls' College, Lucknow</h1>
  <p>${meta.subject} — Quiz Assessment</p>
</div>

<div class="info-grid">
  <div><span class="label">Subject:</span> <span class="value">${meta.subject}</span></div>
  <div><span class="label">Date:</span> <span class="value">_______________</span></div>
  <div><span class="label">Class:</span> <span class="value">${meta.classLevel} ${meta.section}</span></div>
  <div><span class="label">Duration:</span> <span class="value">${meta.duration} minutes</span></div>
  <div><span class="label">Teacher:</span> <span class="value">${meta.teacherName}</span></div>
  <div><span class="label">Total Marks:</span> <span class="value">${totalMarks}</span></div>
</div>

<div class="student-fields">
  <div class="field">Student Name: <span class="line"></span></div>
  <div class="field">Roll Number: <span class="line short-line"></span> &nbsp;&nbsp;&nbsp; Section: <span class="line short-line"></span></div>
</div>

<div class="quiz-title">
  Quiz — Session ${meta.lessonNumber}: ${meta.lessonTitle} &nbsp;|&nbsp; ${meta.gateName} &nbsp;|&nbsp; ${questions.length} Questions &nbsp;|&nbsp; ${totalMarks} Marks
</div>

${groups.mcq.length > 0 ? `
<div class="section-header">SECTION A: Multiple Choice Questions (${marks.mcq.count} × ${marks.mcq.each} = ${marks.mcq.total} marks)</div>
<p style="font-size:11px;color:#6B7280;margin:-5px 0 10px 0;">Choose the correct option by marking the circle.</p>
${groups.mcq.map(q => { qNum++; return `
<div class="question">
  <div class="q-text"><span class="q-num">Q${qNum}.</span> ${q.question_text}</div>
  ${(q.options || []).map((o, oi) => `
    <div class="option"><span class="bubble"></span> ${String.fromCharCode(97 + oi)}) ${o.text}</div>
  `).join('')}
</div>`; }).join('')}` : ''}

${groups.tf.length > 0 ? `
<div class="section-header">SECTION B: True or False (${marks.tf.count} × ${marks.tf.each} = ${marks.tf.total} marks)</div>
<p style="font-size:11px;color:#6B7280;margin:-5px 0 10px 0;">Mark the correct circle.</p>
${groups.tf.map(q => { qNum++; return `
<div class="question">
  <div class="q-text"><span class="q-num">Q${qNum}.</span> ${q.question_text}</div>
  <div class="tf-row"><span><span class="bubble"></span> True</span> <span><span class="bubble"></span> False</span></div>
</div>`; }).join('')}` : ''}

${groups.short.length > 0 ? `
<div class="section-header">SECTION C: Short Answer (${marks.short.count} × ${marks.short.each} = ${marks.short.total} marks)</div>
<p style="font-size:11px;color:#6B7280;margin:-5px 0 10px 0;">Write your answer in the space provided. Show your working.</p>
${groups.short.map(q => { qNum++; return `
<div class="question">
  <div class="q-text"><span class="q-num">Q${qNum}.</span> ${q.question_text}</div>
  <div class="answer-line"></div>
  <div class="answer-line"></div>
  <div class="answer-line"></div>
</div>`; }).join('')}` : ''}

${groups.open.length > 0 ? `
<div class="section-header">SECTION D: Descriptive / Open Ended (${marks.open.count} × ${marks.open.each} = ${marks.open.total} marks)</div>
<p style="font-size:11px;color:#6B7280;margin:-5px 0 10px 0;">Write a detailed answer. Explain your reasoning.</p>
${groups.open.map(q => { qNum++; return `
<div class="question">
  <div class="q-text"><span class="q-num">Q${qNum}.</span> ${q.question_text}</div>
  <div class="answer-line"></div>
  <div class="answer-line"></div>
  <div class="answer-line"></div>
  <div class="answer-line"></div>
  <div class="answer-line"></div>
</div>`; }).join('')}` : ''}

<div class="footer">
  <div>— End of Quiz —</div>
  <div class="marks-box">Total: _______ / ${totalMarks}</div>
</div>

</body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

export function generateAnswerKeyPDF(questions: QuizQuestion[], meta: QuizMeta) {
  const groups = groupByType(questions);
  const marks = marksAllocation(groups);
  const totalMarks = marks.mcq.total + marks.tf.total + marks.short.total + marks.open.total;

  let qNum = 0;

  const html = `<!DOCTYPE html><html><head><title>Answer Key - Session ${meta.lessonNumber}</title>
<style>
  body { font-family: -apple-system, sans-serif; color: #1F2937; font-size: 13px; max-width: 800px; margin: 20px auto; padding: 20px; }
  h1 { font-size: 18px; color: #1B3A6B; border-bottom: 2px solid #1B3A6B; padding-bottom: 8px; }
  .section { font-weight: 700; color: #374151; background: #F3F4F6; padding: 6px 12px; border-radius: 4px; margin: 15px 0 8px; border-left: 3px solid ${meta.gateColor}; }
  .q { margin-bottom: 12px; padding: 8px; border-radius: 6px; background: #F9FAFB; }
  .q-text { font-weight: 500; }
  .answer { color: #166534; background: #D4EDDA; padding: 6px 10px; border-radius: 4px; margin-top: 4px; font-size: 12px; }
  .rubric { color: #92400E; background: #FEF3C7; padding: 6px 10px; border-radius: 4px; margin-top: 4px; font-size: 11px; }
  .correct-opt { color: #166534; font-weight: 600; }
  .watermark { text-align: center; color: #DC2626; font-size: 16px; font-weight: 700; padding: 10px; border: 2px solid #DC2626; border-radius: 8px; margin-bottom: 15px; }
</style></head><body>

<h1>Answer Key — Session ${meta.lessonNumber}: ${meta.lessonTitle}</h1>
<div class="watermark">⚠ ANSWER KEY — FOR TEACHER USE ONLY</div>
<p style="font-size:12px;color:#6B7280;">${meta.subject} | Class ${meta.classLevel}${meta.section} | ${meta.gateName} | Total: ${totalMarks} marks</p>

${[
  { label: 'SECTION A: MCQ', items: groups.mcq, each: marks.mcq.each },
  { label: 'SECTION B: True/False', items: groups.tf, each: marks.tf.each },
  { label: 'SECTION C: Short Answer', items: groups.short, each: marks.short.each },
  { label: 'SECTION D: Open Ended', items: groups.open, each: marks.open.each },
].filter(s => s.items.length > 0).map(section => `
<div class="section">${section.label} (${section.each} marks each)</div>
${section.items.map(q => { qNum++; return `
<div class="q">
  <div class="q-text"><strong>Q${qNum}.</strong> ${q.question_text}</div>
  ${q.options ? q.options.map((o, oi) => `<div${o.is_correct ? ' class="correct-opt"' : ''}>${String.fromCharCode(97 + oi)}) ${o.text}${o.is_correct ? ' ✓ CORRECT' : ''}</div>`).join('') : ''}
  ${q.correct_answer ? `<div class="answer">Answer: ${q.correct_answer}</div>` : ''}
  ${q.rubric ? `<div class="rubric">Rubric: ${q.rubric}</div>` : ''}
</div>`; }).join('')}
`).join('')}

</body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}
