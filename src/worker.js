import { QUESTIONS } from './questions_data.js';

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '')) {
      return new Response(buildHTML(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    if (request.method === 'POST' && url.pathname === '/submit') {
      return handleSubmit(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleSubmit(request, env) {
  try {
    const data = await request.json();
    let emailSent = false;

    if (data.email && env.RESEND_API_KEY) {
      emailSent = await sendResultsEmail(data, env);
    }

    return new Response(JSON.stringify({ success: true, emailSent }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
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

function buildHTML() {
  const questionsJson = JSON.stringify(QUESTIONS);
  const sectionsJson = JSON.stringify(SECTIONS);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Canadian Amateur Radio — Basic Qualification Exam</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --red: #D52B1E;
  --red-dark: #b02318;
  --bg: #f0f2f5;
  --card: #ffffff;
  --border: #e0e0e0;
  --text: #1a1a1a;
  --muted: #666;
  --green: #2e7d32;
  --amber: #e65100;
}
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
.screen { display: none; }
.screen.active { display: block; }

/* ── START SCREEN ── */
#screen-start { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
.start-card { background: var(--card); border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,.10); padding: 40px; max-width: 520px; width: 100%; }
.logo { text-align: center; margin-bottom: 24px; }
.logo .maple { font-size: 48px; }
.logo h1 { font-size: 22px; color: var(--red); font-weight: 700; margin-top: 8px; }
.logo h2 { font-size: 15px; color: var(--muted); font-weight: 400; margin-top: 4px; }
.info-box { background: #fff8f0; border-left: 4px solid var(--red); border-radius: 4px; padding: 14px 16px; margin-bottom: 24px; font-size: 14px; line-height: 1.6; }
.info-box strong { color: var(--red); }
label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; margin-top: 16px; }
label span { font-weight: 400; color: var(--muted); }
input[type=text], input[type=email] {
  width: 100%; padding: 12px 14px; border: 1px solid var(--border);
  border-radius: 8px; font-size: 15px; outline: none; transition: border .15s;
}
input:focus { border-color: var(--red); box-shadow: 0 0 0 3px rgba(213,43,30,.12); }
.btn-primary {
  display: block; width: 100%; margin-top: 24px; padding: 14px;
  background: var(--red); color: white; border: none; border-radius: 8px;
  font-size: 16px; font-weight: 600; cursor: pointer; transition: background .15s;
}
.btn-primary:hover { background: var(--red-dark); }
.btn-primary:disabled { background: #ccc; cursor: not-allowed; }

/* ── EXAM SCREEN ── */
#screen-exam { max-width: 900px; margin: 0 auto; padding: 16px; }
.exam-header { background: var(--card); border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.exam-header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.exam-title { font-size: 14px; color: var(--muted); }
.exam-counter { font-size: 14px; font-weight: 600; }
.progress-bar { height: 6px; background: #e0e0e0; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--red); border-radius: 3px; transition: width .3s; }
.question-card { background: var(--card); border-radius: 12px; padding: 28px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.question-id { font-size: 11px; color: var(--muted); margin-bottom: 10px; font-family: monospace; }
.question-text { font-size: 17px; line-height: 1.6; font-weight: 500; margin-bottom: 24px; }
.options { display: flex; flex-direction: column; gap: 10px; }
.option-label {
  display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px;
  border: 2px solid var(--border); border-radius: 10px; cursor: pointer;
  transition: border-color .15s, background .15s; font-size: 15px; line-height: 1.5;
}
.option-label:hover { border-color: #aaa; background: #fafafa; }
.option-label.selected { border-color: var(--red); background: #fff2f1; }
.option-label.correct { border-color: var(--green); background: #f1fdf2; }
.option-label.wrong { border-color: #c62828; background: #fff3f3; }
.option-label input[type=radio] { display: none; }
.option-key {
  flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px; background: #f0f0f0; color: var(--text);
}
.option-label.selected .option-key { background: var(--red); color: white; }
.option-label.correct .option-key { background: var(--green); color: white; }
.option-label.wrong .option-key { background: #c62828; color: white; }

.nav-row { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.btn-nav {
  padding: 10px 20px; border: 2px solid var(--border); background: white;
  border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all .15s;
}
.btn-nav:hover:not(:disabled) { border-color: var(--red); color: var(--red); }
.btn-nav:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-submit {
  padding: 12px 28px; background: var(--green); color: white; border: none;
  border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background .15s;
}
.btn-submit:hover { background: #1b5e20; }
.btn-flag {
  padding: 10px 14px; border: 2px solid #f9a825; background: white;
  border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; color: #f9a825;
}
.btn-flag.flagged { background: #fff8e1; }

/* Question grid */
.q-grid-wrap { background: var(--card); border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.q-grid-title { font-size: 12px; color: var(--muted); margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.q-grid { display: flex; flex-wrap: wrap; gap: 5px; }
.q-dot {
  width: 30px; height: 30px; border-radius: 6px; font-size: 11px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  border: 2px solid transparent; transition: all .1s; background: #eee; color: #666;
}
.q-dot.answered { background: #c8e6c9; color: #1b5e20; }
.q-dot.current { border-color: var(--red); }
.q-dot.flagged { background: #fff3cd; color: #856404; }

/* ── RESULTS SCREEN ── */
#screen-results { max-width: 800px; margin: 0 auto; padding: 20px; }
.results-header { background: var(--card); border-radius: 16px; padding: 36px; text-align: center; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
.score-big { font-size: 72px; font-weight: 800; color: var(--red); line-height: 1; }
.score-pct { font-size: 32px; font-weight: 700; margin-top: 6px; }
.status-badge {
  display: inline-block; margin-top: 14px; padding: 8px 24px;
  border-radius: 999px; font-size: 18px; font-weight: 700;
}
.status-honours { background: #fff9c4; color: #f57f17; }
.status-pass { background: #e8f5e9; color: var(--green); }
.status-fail { background: #ffebee; color: #c62828; }
.result-name { margin-top: 16px; color: var(--muted); font-size: 15px; }

.results-card { background: var(--card); border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.results-card h3 { font-size: 16px; margin-bottom: 16px; color: var(--text); }
.section-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.section-name { flex: 1; font-size: 14px; }
.section-score { font-size: 14px; font-weight: 600; min-width: 50px; text-align: right; }
.section-bar-bg { flex: 0 0 120px; height: 8px; background: #eee; border-radius: 4px; overflow: hidden; }
.section-bar { height: 100%; border-radius: 4px; background: var(--red); }

.wrong-list { display: flex; flex-direction: column; gap: 12px; }
.wrong-item { border: 1px solid #ffcdd2; border-radius: 8px; padding: 14px; background: #fff8f8; }
.wrong-item .wi-id { font-size: 11px; color: var(--muted); font-family: monospace; margin-bottom: 4px; }
.wrong-item .wi-q { font-size: 14px; font-weight: 500; margin-bottom: 8px; }
.wrong-item .wi-yours { font-size: 13px; color: #c62828; }
.wrong-item .wi-correct { font-size: 13px; color: var(--green); margin-top: 3px; }

.results-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
.btn-retake { padding: 12px 24px; background: var(--red); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
.btn-retake:hover { background: var(--red-dark); }
.email-form { display: flex; gap: 10px; flex-wrap: wrap; }
.email-form input { flex: 1; min-width: 220px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 15px; }
.btn-email { padding: 12px 20px; background: #1565c0; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
.btn-email:hover { background: #0d47a1; }
.email-status { font-size: 14px; margin-top: 8px; }

@media (max-width: 600px) {
  .score-big { font-size: 56px; }
  .section-bar-bg { display: none; }
  .exam-header-top { flex-direction: column; gap: 4px; align-items: flex-start; }
}
</style>
</head>
<body>

<!-- START SCREEN -->
<div id="screen-start" class="screen active">
  <div class="start-card">
    <div class="logo">
      <div class="maple">🍁</div>
      <h1>Canadian Amateur Radio</h1>
      <h2>Basic Qualification Practice Exam</h2>
    </div>
    <div class="info-box">
      <strong>100 questions</strong> drawn randomly from the official ISED question bank
      (984 questions across 8 sections).<br>
      <strong>Pass:</strong> 70/100 (70%) &nbsp;|&nbsp; <strong>Honours:</strong> 80/100 (80%)<br>
      Source: ISED Basic Qualification (effective 15 July 2025)
    </div>
    <form id="start-form" onsubmit="startExam(event)">
      <label for="inp-name">Full Name <span>(required)</span></label>
      <input type="text" id="inp-name" required placeholder="Your full name" autocomplete="name">
      <label for="inp-email">Email Address <span>(optional — to receive your results)</span></label>
      <input type="email" id="inp-email" placeholder="your@email.com" autocomplete="email">
      <button type="submit" class="btn-primary">Start Exam →</button>
    </form>
  </div>
</div>

<!-- EXAM SCREEN -->
<div id="screen-exam" class="screen">
  <div class="exam-header">
    <div class="exam-header-top">
      <span class="exam-title">🍁 Basic Qualification Exam</span>
      <span class="exam-counter" id="exam-counter">Question 1 of 100</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:1%"></div></div>
  </div>

  <div class="question-card">
    <div class="question-id" id="q-id"></div>
    <div class="question-text" id="q-text"></div>
    <div class="options" id="q-options"></div>
  </div>

  <div class="q-grid-wrap">
    <div class="q-grid-title">Question Overview — click to jump</div>
    <div class="q-grid" id="q-grid"></div>
  </div>

  <div class="nav-row">
    <button class="btn-nav" id="btn-prev" onclick="goTo(currentQ - 1)" disabled>← Previous</button>
    <button class="btn-flag" id="btn-flag" onclick="toggleFlag()">🚩 Flag</button>
    <button class="btn-nav" id="btn-next" onclick="goTo(currentQ + 1)">Next →</button>
    <button class="btn-submit" id="btn-submit" onclick="confirmSubmit()" style="display:none">Submit Exam ✓</button>
  </div>
</div>

<!-- RESULTS SCREEN -->
<div id="screen-results" class="screen">
  <div class="results-header">
    <div id="res-name" class="result-name"></div>
    <div class="score-big" id="res-score"></div>
    <div class="score-pct" id="res-pct"></div>
    <div class="status-badge" id="res-badge"></div>
  </div>

  <div class="results-actions">
    <button class="btn-retake" onclick="retake()">↺ New Exam</button>
    <div style="flex:1"></div>
  </div>

  <div class="results-card" id="email-card">
    <h3>📧 Receive Results by Email</h3>
    <div class="email-form">
      <input type="email" id="res-email" placeholder="your@email.com">
      <button class="btn-email" onclick="submitEmail()">Send Results</button>
    </div>
    <div class="email-status" id="email-status"></div>
  </div>

  <div class="results-card">
    <h3>Section Breakdown</h3>
    <div id="section-breakdown"></div>
  </div>

  <div class="results-card" id="wrong-card">
    <h3>Incorrect Answers</h3>
    <div class="wrong-list" id="wrong-list"></div>
  </div>
</div>

<script>
const ALL_QUESTIONS = ${questionsJson};
const SECTIONS = ${sectionsJson};

let userName = '';
let userEmail = '';
let examQuestions = [];
let userAnswers = {}; // index -> 'a'|'b'|'c'|'d'
let flagged = new Set();
let currentQ = 0;
let submitted = false;
let lastResults = null;

function pickExam(all) {
  const byTopic = {};
  for (const q of all) {
    const t = q.id.substring(0, 9);
    if (!byTopic[t]) byTopic[t] = [];
    byTopic[t].push(q);
  }
  return Object.values(byTopic).map(arr => arr[Math.floor(Math.random() * arr.length)]);
}

function startExam(e) {
  e.preventDefault();
  userName = document.getElementById('inp-name').value.trim();
  userEmail = document.getElementById('inp-email').value.trim();
  examQuestions = pickExam(ALL_QUESTIONS);
  userAnswers = {};
  flagged = new Set();
  currentQ = 0;
  submitted = false;
  buildGrid();
  goTo(0);
  showScreen('exam');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  window.scrollTo(0, 0);
}

function buildGrid() {
  const grid = document.getElementById('q-grid');
  grid.innerHTML = '';
  for (let i = 0; i < examQuestions.length; i++) {
    const d = document.createElement('div');
    d.className = 'q-dot';
    d.id = 'dot-' + i;
    d.textContent = i + 1;
    d.onclick = () => goTo(i);
    grid.appendChild(d);
  }
}

function updateGrid() {
  for (let i = 0; i < examQuestions.length; i++) {
    const d = document.getElementById('dot-' + i);
    if (!d) continue;
    d.className = 'q-dot';
    if (userAnswers[i] !== undefined) d.classList.add('answered');
    if (flagged.has(i)) d.classList.add('flagged');
    if (i === currentQ) d.classList.add('current');
  }
}

function goTo(idx) {
  if (idx < 0 || idx >= examQuestions.length) return;
  currentQ = idx;
  renderQuestion(idx);
}

function renderQuestion(idx) {
  const q = examQuestions[idx];
  const total = examQuestions.length;

  document.getElementById('exam-counter').textContent = 'Question ' + (idx + 1) + ' of ' + total;
  document.getElementById('progress-fill').style.width = ((idx + 1) / total * 100) + '%';
  document.getElementById('q-id').textContent = q.id;
  document.getElementById('q-text').textContent = q.q;

  const opts = document.getElementById('q-options');
  opts.innerHTML = '';
  ['a', 'b', 'c', 'd'].forEach(key => {
    const lbl = document.createElement('label');
    lbl.className = 'option-label' + (userAnswers[idx] === key ? ' selected' : '');
    lbl.innerHTML =
      '<input type="radio" name="opt" value="' + key + '"' + (userAnswers[idx] === key ? ' checked' : '') + '>' +
      '<span class="option-key">' + key.toUpperCase() + '</span>' +
      '<span>' + q[key] + '</span>';
    lbl.onclick = () => selectAnswer(idx, key);
    opts.appendChild(lbl);
  });

  document.getElementById('btn-prev').disabled = idx === 0;
  document.getElementById('btn-next').disabled = idx === total - 1;
  document.getElementById('btn-flag').classList.toggle('flagged', flagged.has(idx));
  document.getElementById('btn-flag').textContent = flagged.has(idx) ? '🚩 Flagged' : '🚩 Flag';

  const answered = Object.keys(userAnswers).length;
  const submitBtn = document.getElementById('btn-submit');
  submitBtn.style.display = answered === total ? 'inline-block' : 'none';

  updateGrid();
}

function selectAnswer(idx, key) {
  if (submitted) return;
  userAnswers[idx] = key;
  renderQuestion(idx);
}

function toggleFlag() {
  if (flagged.has(currentQ)) flagged.delete(currentQ);
  else flagged.add(currentQ);
  renderQuestion(currentQ);
}

function confirmSubmit() {
  const answered = Object.keys(userAnswers).length;
  const total = examQuestions.length;
  if (answered < total) {
    if (!confirm('You have ' + (total - answered) + ' unanswered questions. Submit anyway?')) return;
  } else {
    if (!confirm('Submit your exam? You cannot change your answers after submission.')) return;
  }
  submitExam();
}

function submitExam() {
  submitted = true;
  const results = calculateResults();
  lastResults = { ...results, name: userName, email: userEmail };
  showResults(results);
}

function calculateResults() {
  let score = 0;
  const sectionScores = {};
  const wrongAnswers = [];

  examQuestions.forEach((q, i) => {
    const sec = q.id.substring(0, 5);
    if (!sectionScores[sec]) sectionScores[sec] = { correct: 0, total: 0 };
    sectionScores[sec].total++;

    const userAns = userAnswers[i];
    if (userAns === q.ans) {
      score++;
      sectionScores[sec].correct++;
    } else {
      wrongAnswers.push({
        id: q.id,
        question: q.q,
        userAns: userAns || '—',
        userText: userAns ? q[userAns] : 'No answer',
        ans: q.ans,
        correctText: q[q.ans],
      });
    }
  });

  return { score, total: examQuestions.length, sectionScores, wrongAnswers };
}

function showResults(results) {
  const { score, total, sectionScores, wrongAnswers } = results;
  const pct = Math.round((score / total) * 100);

  document.getElementById('res-name').textContent = 'Results for ' + userName;
  document.getElementById('res-score').textContent = score + '/' + total;
  document.getElementById('res-pct').textContent = pct + '%';

  const badge = document.getElementById('res-badge');
  if (pct >= 80) {
    badge.textContent = '🏆 Basic with Honours';
    badge.className = 'status-badge status-honours';
  } else if (pct >= 70) {
    badge.textContent = '✅ Basic Qualification — PASS';
    badge.className = 'status-badge status-pass';
  } else {
    badge.textContent = '❌ Not Passed — ' + (70 - score) + ' more correct needed';
    badge.className = 'status-badge status-fail';
  }

  // Pre-fill email if provided
  if (userEmail) {
    document.getElementById('res-email').value = userEmail;
  }

  // Section breakdown
  const breakdown = document.getElementById('section-breakdown');
  breakdown.innerHTML = '';
  Object.entries(sectionScores).sort().forEach(([sec, s]) => {
    const pctSec = Math.round((s.correct / s.total) * 100);
    const row = document.createElement('div');
    row.className = 'section-row';
    row.innerHTML =
      '<span class="section-name">' + (SECTIONS[sec] || sec) + '</span>' +
      '<div class="section-bar-bg"><div class="section-bar" style="width:' + pctSec + '%"></div></div>' +
      '<span class="section-score">' + s.correct + '/' + s.total + '</span>';
    breakdown.appendChild(row);
  });

  // Wrong answers
  const wrongCard = document.getElementById('wrong-card');
  const wrongList = document.getElementById('wrong-list');
  if (wrongAnswers.length === 0) {
    wrongCard.style.display = 'none';
  } else {
    wrongCard.querySelector('h3').textContent = 'Incorrect Answers (' + wrongAnswers.length + ')';
    wrongList.innerHTML = wrongAnswers.map(w =>
      '<div class="wrong-item">' +
      '<div class="wi-id">' + w.id + '</div>' +
      '<div class="wi-q">' + w.question + '</div>' +
      '<div class="wi-yours">✗ Your answer: ' + w.userAns + ') ' + w.userText + '</div>' +
      '<div class="wi-correct">✓ Correct: ' + w.ans + ') ' + w.correctText + '</div>' +
      '</div>'
    ).join('');
  }

  showScreen('results');
}

async function submitEmail() {
  const email = document.getElementById('res-email').value.trim();
  if (!email) { alert('Please enter an email address.'); return; }

  const statusEl = document.getElementById('email-status');
  statusEl.textContent = 'Sending…';
  statusEl.style.color = '#666';

  try {
    const payload = {
      name: userName,
      email,
      ...lastResults,
    };
    const resp = await fetch('/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (data.emailSent) {
      statusEl.textContent = '✓ Results sent to ' + email;
      statusEl.style.color = 'var(--green)';
    } else {
      statusEl.textContent = '✓ Received! (Email delivery requires server configuration)';
      statusEl.style.color = '#f57f17';
    }
  } catch {
    statusEl.textContent = '✗ Failed to send. Please try again.';
    statusEl.style.color = '#c62828';
  }
}

function retake() {
  document.getElementById('inp-name').value = userName;
  document.getElementById('inp-email').value = userEmail;
  showScreen('start');
}
</script>
</body>
</html>`;
}
