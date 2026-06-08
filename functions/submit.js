const SECTIONS = {
  'B-001': 'Section 1 — Regulations and Policies',
  'B-002': 'Section 2 — Operating and Procedures',
  'B-003': 'Section 3 — Station Assembly, Practice and Safety',
  'B-004': 'Section 4 — Circuit Components',
  'B-005': 'Section 5 — Basic Electronics and Theory',
  'B-006': 'Section 6 — Feedlines and Antenna Systems',
  'B-007': 'Section 7 — Radio Wave Propagation',
  'B-008': 'Section 8 — Interference and Suppression',
};

export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    let emailSent = false;
    if (data.email && env.RESEND_API_KEY) {
      emailSent = await sendResultsEmail(data, env);
    }
    return Response.json({ success: true, emailSent });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}

async function sendResultsEmail(data, env) {
  const { name, email, score, total, sectionScores, wrongAnswers } = data;
  const pct = Math.round((score / total) * 100);
  const status =
    pct >= 80 ? '🏆 Basic with Honours' : pct >= 70 ? '✅ Basic Qualification — PASS' : '❌ Not Passed';

  const sectionRows = Object.entries(sectionScores || {})
    .map(([sec, s]) => `<tr><td>${SECTIONS[sec] || sec}</td><td>${s.correct}/${s.total}</td></tr>`)
    .join('');

  const wrongRows = (wrongAnswers || [])
    .slice(0, 30)
    .map(
      (w) =>
        `<tr><td style="font-size:12px;color:#666">${w.id}</td><td>${w.question}</td>` +
        `<td>Your: ${w.userAns}) ${w.userText}</td><td>Correct: ${w.ans}) ${w.correctText}</td></tr>`
    )
    .join('');

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:700px;margin:auto;padding:20px">
<h1 style="color:#D52B1E">🇨🇦 Canadian Amateur Radio</h1>
<h2>Basic Qualification — Exam Results</h2>
<p>Hello <strong>${name}</strong>,</p>
<div style="text-align:center;padding:30px;background:#f5f5f5;border-radius:8px;margin:20px 0">
  <div style="font-size:64px;font-weight:bold;color:#D52B1E">${score}/${total}</div>
  <div style="font-size:28px;margin:8px 0">${pct}%</div>
  <div style="font-size:20px">${status}</div>
</div>
<h3>Section Breakdown</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse">
  <tr style="background:#D52B1E;color:white"><th align="left">Section</th><th>Score</th></tr>
  ${sectionRows}
</table>
${wrongRows ? `<h3>Incorrect Answers (first 30)</h3>
<table border="1" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr style="background:#333;color:white"><th>ID</th><th>Question</th><th>Your Answer</th><th>Correct Answer</th></tr>
  ${wrongRows}
</table>` : ''}
<p style="margin-top:30px;color:#666;font-size:12px">Canadian Amateur Radio Basic Qualification Practice Exam — ISED official question bank (effective 15 July 2025)</p>
</body></html>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL || 'HAM Exam <results@hamexam.ca>',
        to: [email],
        subject: `Your Basic Qualification Exam Results — ${score}/${total} (${pct}%)`,
        html,
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
