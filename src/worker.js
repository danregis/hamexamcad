import { QUESTIONS } from './questions_data.js';
import { QUESTIONS_FR } from './questions_data_fr.js';
import { QUESTIONS_ADV } from './questions_data_advanced.js';
import { QUESTIONS_ADV_FR } from './questions_data_advanced_fr.js';

const SECTIONS_EN = {
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
    if (request.method === 'POST' && url.pathname === '/register') {
      return handleRegister(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/submit') {
      return handleSubmit(request, env);
    }
    return new Response('Not Found', { status: 404 });
  },
};

async function handleRegister(request, env) {
  try {
    const { name, email } = await request.json();
    if (!name || !email) {
      return Response.json({ success: false, error: 'Name and email required' }, { status: 400 });
    }
    let registrationId = null;
    if (env.DB) {
      await env.DB.exec(`CREATE TABLE IF NOT EXISTS registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, email TEXT NOT NULL,
        registered_at TEXT DEFAULT (datetime('now')),
        score INTEGER, total INTEGER, passed INTEGER, completed_at TEXT
      )`);
      const existing = await env.DB
        .prepare('SELECT id FROM registrations WHERE email = ?')
        .bind(email).first();
      if (existing) {
        return Response.json({ success: false, alreadyRegistered: true, id: existing.id });
      }
      const result = await env.DB
        .prepare('INSERT INTO registrations (name, email) VALUES (?, ?)')
        .bind(name, email).run();
      registrationId = result.meta.last_row_id;
    }
    return Response.json({ success: true, id: registrationId });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}

async function handleSubmit(request, env) {
  try {
    const data = await request.json();
    const { registrationId, score, total, email } = data;
    let emailSent = false;
    if (env.DB && registrationId) {
      const passed = score / total >= 0.7 ? 1 : 0;
      await env.DB
        .prepare('UPDATE registrations SET score=?, total=?, passed=?, completed_at=datetime("now") WHERE id=?')
        .bind(score, total, passed, registrationId).run();
    }
    if (email && env.RESEND_API_KEY) {
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
  const status = pct >= 80 ? '🏆 Basic with Honours' : pct >= 70 ? '✅ PASS' : '❌ Not Passed';
  const sectionRows = Object.entries(sectionScores || {})
    .map(([sec, s]) => `<tr><td>${SECTIONS_EN[sec] || sec}</td><td>${s.correct}/${s.total}</td></tr>`).join('');
  const wrongRows = (wrongAnswers || []).slice(0, 30)
    .map(w => `<tr><td style="font-size:12px;color:#666">${w.id}</td><td>${w.question}</td><td>${w.userAns}) ${w.userText}</td><td>${w.ans}) ${w.correctText}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:700px;margin:auto;padding:20px">
<h1 style="color:#D52B1E">🇨🇦 Canadian Amateur Radio — Basic Qualification</h1>
<p>Hello <strong>${name}</strong>,</p>
<div style="text-align:center;padding:30px;background:#f5f5f5;border-radius:8px;margin:20px 0">
  <div style="font-size:64px;font-weight:bold;color:#D52B1E">${score}/${total}</div>
  <div style="font-size:28px">${pct}%</div><div style="font-size:20px">${status}</div>
</div>
<h3>Section Breakdown</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse">
  <tr style="background:#D52B1E;color:white"><th align="left">Section</th><th>Score</th></tr>${sectionRows}
</table>
${wrongRows ? `<h3>Incorrect Answers</h3><table border="1" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr style="background:#333;color:white"><th>ID</th><th>Question</th><th>Your Answer</th><th>Correct</th></tr>${wrongRows}</table>` : ''}
<p style="margin-top:30px;color:#666;font-size:12px">ISED Basic Qualification question bank — effective 15 July 2025</p>
</body></html>`;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.FROM_EMAIL || 'HAM Exam <results@hamexam.ca>', to: [email], subject: `Exam Results — ${score}/${total} (${pct}%)`, html }),
    });
    return resp.ok;
  } catch { return false; }
}

function buildHTML() {
  const questionsEnJson = JSON.stringify(QUESTIONS);
  const questionsFrJson = JSON.stringify(QUESTIONS_FR);
  const questionsAdvEnJson = JSON.stringify(QUESTIONS_ADV);
  const questionsAdvFrJson = JSON.stringify(QUESTIONS_ADV_FR);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Canadian Amateur Radio — Basic Qualification Exam</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --red: #D52B1E; --red-dark: #b02318; --bg: #f0f2f5; --card: #fff;
  --border: #e0e0e0; --text: #1a1a1a; --muted: #666; --green: #2e7d32;
}
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
.screen { display: none; }
.screen.active { display: block; }

/* Toast */
#toast {
  position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
  background: #b71c1c; color: #fff; padding: 12px 24px; border-radius: 8px;
  font-size: 14px; font-weight: 600; z-index: 9999; box-shadow: 0 4px 16px rgba(0,0,0,.25);
  opacity: 0; pointer-events: none; transition: opacity .3s ease;
  max-width: 90vw; text-align: center;
}
#toast.show { opacity: 1; }

/* Lang toggle */
#lang-toggle {
  position: fixed; top: 14px; right: 16px; z-index: 999;
  padding: 6px 14px; background: white; border: 2px solid var(--red);
  border-radius: 20px; font-size: 13px; font-weight: 700; color: var(--red);
  cursor: pointer; transition: all .15s;
}
#lang-toggle:hover { background: var(--red); color: white; }

/* Start */
#screen-start { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
.start-card { background: var(--card); border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,.10); padding: 40px; max-width: 520px; width: 100%; }
.logo { text-align: center; margin-bottom: 24px; }
.logo .maple { font-size: 48px; }
.logo h1 { font-size: 22px; color: var(--red); font-weight: 700; margin-top: 8px; }
.logo h2 { font-size: 15px; color: var(--muted); font-weight: 400; margin-top: 4px; }
.exam-type-selector { display: flex; gap: 10px; margin-bottom: 18px; }
.exam-type-btn { flex: 1; display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 2px solid var(--border); border-radius: 10px; cursor: pointer; transition: all .15s; user-select: none; background: var(--card); }
.exam-type-btn:hover { border-color: var(--red); }
.exam-type-btn.active { border-color: var(--red); background: #fff8f0; }
.exam-type-check { font-size: 18px; color: var(--border); flex-shrink: 0; transition: color .15s; }
.exam-type-btn.active .exam-type-check { color: var(--red); }
.exam-type-name { font-size: 14px; font-weight: 700; color: var(--text); }
.exam-type-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
.info-box { background: #fff8f0; border-left: 4px solid var(--red); border-radius: 4px; padding: 14px 16px; margin-bottom: 24px; font-size: 14px; line-height: 1.6; }
label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; margin-top: 16px; }
input[type=text], input[type=email] { width: 100%; padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 15px; outline: none; transition: border .15s; }
input:focus { border-color: var(--red); box-shadow: 0 0 0 3px rgba(213,43,30,.12); }
.btn-primary { display: block; width: 100%; margin-top: 24px; padding: 14px; background: var(--red); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background .15s; }
.btn-primary:hover:not(:disabled) { background: var(--red-dark); }
.btn-primary:disabled { background: #ccc; cursor: not-allowed; }

/* Exam */
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
.option-label { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border: 2px solid var(--border); border-radius: 10px; cursor: pointer; transition: border-color .15s, background .15s; font-size: 15px; line-height: 1.5; }
.option-label:hover { border-color: #aaa; background: #fafafa; }
.option-label.selected { border-color: var(--red); background: #fff2f1; }
.option-label input[type=radio] { display: none; }
.option-key { flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; background: #f0f0f0; }
.option-label.selected .option-key { background: var(--red); color: white; }
.nav-row { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.btn-nav { padding: 10px 20px; border: 2px solid var(--border); background: white; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all .15s; }
.btn-nav:hover:not(:disabled) { border-color: var(--red); color: var(--red); }
.btn-nav:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-submit { padding: 12px 28px; background: var(--green); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
.btn-submit:hover { background: #1b5e20; }
.btn-flag { padding: 10px 14px; border: 2px solid #f9a825; background: white; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; color: #f9a825; }
.btn-flag.flagged { background: #fff8e1; }
.q-grid-wrap { background: var(--card); border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.q-grid-title { font-size: 12px; color: var(--muted); margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.q-grid { display: flex; flex-wrap: wrap; gap: 5px; }
.q-dot { width: 30px; height: 30px; border-radius: 6px; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid transparent; background: #eee; color: #666; }
.q-dot.answered { background: #c8e6c9; color: #1b5e20; }
.q-dot.current { border-color: var(--red); }
.q-dot.flagged { background: #fff3cd; color: #856404; }

/* Results */
#screen-results { max-width: 800px; margin: 0 auto; padding: 20px; }
.results-header { background: var(--card); border-radius: 16px; padding: 36px; text-align: center; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
.score-big { font-size: 72px; font-weight: 800; color: var(--red); line-height: 1; }
.score-pct { font-size: 32px; font-weight: 700; margin-top: 6px; }
.status-badge { display: inline-block; margin-top: 14px; padding: 8px 24px; border-radius: 999px; font-size: 18px; font-weight: 700; }
.status-honours { background: #fff9c4; color: #f57f17; }
.status-pass { background: #e8f5e9; color: var(--green); }
.status-fail { background: #ffebee; color: #c62828; }
.result-name { margin-top: 16px; color: var(--muted); font-size: 15px; }
.results-card { background: var(--card); border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.results-card h3 { font-size: 16px; margin-bottom: 16px; }
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
.email-status { font-size: 14px; margin-top: 8px; }
@media (max-width: 600px) {
  .score-big { font-size: 56px; }
  .section-bar-bg { display: none; }
  .exam-header-top { flex-direction: column; gap: 4px; align-items: flex-start; }
}
</style>
</head>
<body>

<div id="toast"></div>
<button id="lang-toggle" onclick="toggleLang()">FR</button>

<!-- START -->
<div id="screen-start" class="screen active">
  <div class="start-card">
    <div class="logo">
      <div class="maple">🍁</div>
      <h1 id="s-title">Canadian Amateur Radio</h1>
      <h2 id="s-subtitle">Basic Qualification Practice Exam</h2>
    </div>
    <div class="exam-type-selector">
      <div class="exam-type-btn active" id="btn-type-basic" onclick="setExamType('basic')">
        <span class="exam-type-check">✓</span>
        <div>
          <div class="exam-type-name" id="lbl-type-basic">Basic Qualification</div>
          <div class="exam-type-sub">100 questions · 8 sections</div>
        </div>
      </div>
      <div class="exam-type-btn" id="btn-type-adv" onclick="setExamType('advanced')">
        <span class="exam-type-check">✓</span>
        <div>
          <div class="exam-type-name" id="lbl-type-adv">Advanced Qualification</div>
          <div class="exam-type-sub">50 questions · 7 sections</div>
        </div>
      </div>
    </div>
    <div class="info-box" id="s-info"></div>
    <form id="start-form" onsubmit="startExam(event)">
      <label id="s-name-label" for="inp-name">Full Name</label>
      <input type="text" id="inp-name" required placeholder="Your full name" autocomplete="name">
      <label id="s-email-label" for="inp-email">Email Address</label>
      <input type="email" id="inp-email" required placeholder="your@email.com" autocomplete="email">
      <button type="submit" class="btn-primary" id="btn-start">Start Exam →</button>
    </form>
    <p style="text-align:center;margin-top:20px;font-size:0.75rem;color:#aaa;">
      &copy; 2026 Dan Regis &mdash; <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener" style="color:#aaa;">MIT License</a> &mdash; Questions: <a href="https://www.qrz.com/db/VE2DRG" target="_blank" rel="noopener" style="color:#aaa;">QRZ.com</a>
    </p>
  </div>
</div>

<!-- EXAM -->
<div id="screen-exam" class="screen">
  <div class="exam-header">
    <div class="exam-header-top">
      <span class="exam-title" id="e-title">🍁 Basic Qualification Exam</span>
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
    <div class="q-grid-title" id="e-grid-title">Question Overview — click to jump</div>
    <div class="q-grid" id="q-grid"></div>
  </div>
  <div class="nav-row">
    <button class="btn-nav" id="btn-prev" onclick="goTo(currentQ - 1)" disabled>← Previous</button>
    <button class="btn-flag" id="btn-flag" onclick="toggleFlag()">🚩 Flag</button>
    <button class="btn-nav" id="btn-next" onclick="goTo(currentQ + 1)">Next →</button>
    <button class="btn-submit" id="btn-submit" onclick="confirmSubmit()" style="display:none">Submit Exam ✓</button>
  </div>
</div>

<!-- RESULTS -->
<div id="screen-results" class="screen">
  <div class="results-header">
    <div id="res-name" class="result-name"></div>
    <div class="score-big" id="res-score"></div>
    <div class="score-pct" id="res-pct"></div>
    <div class="status-badge" id="res-badge"></div>
  </div>
  <div class="results-actions">
    <button class="btn-retake" id="btn-retake" onclick="retake()">↺ New Exam</button>
  </div>
  <div class="results-card" id="email-card">
    <h3 id="r-email-title">📧 Receive Results by Email</h3>
    <div class="email-form">
      <input type="email" id="res-email" placeholder="your@email.com">
      <button class="btn-email" id="btn-send-email" onclick="submitEmail()">Send Results</button>
    </div>
    <div class="email-status" id="email-status"></div>
  </div>
  <div class="results-card">
    <h3 id="r-breakdown-title">Section Breakdown</h3>
    <div id="section-breakdown"></div>
  </div>
  <div class="results-card" id="wrong-card">
    <h3 id="r-wrong-title">Incorrect Answers</h3>
    <div class="wrong-list" id="wrong-list"></div>
  </div>
</div>

<script>
const ALL_QUESTIONS_EN = ${questionsEnJson};
const ALL_QUESTIONS_FR = ${questionsFrJson};
const ALL_QUESTIONS_ADV_EN = ${questionsAdvEnJson};
const ALL_QUESTIONS_ADV_FR = ${questionsAdvFrJson};

const SECTIONS = {
  en: {
    'B-001':'Section 1 — Regulations and Policies',
    'B-002':'Section 2 — Operating and Procedures',
    'B-003':'Section 3 — Station Assembly, Practice and Safety',
    'B-004':'Section 4 — Circuit Components',
    'B-005':'Section 5 — Basic Electronics and Theory',
    'B-006':'Section 6 — Feedlines and Antenna Systems',
    'B-007':'Section 7 — Radio Wave Propagation',
    'B-008':'Section 8 — Interference and Suppression',
    'A-001':'Section 1 — Math & Physics',
    'A-002':'Section 2 — Components & Circuits',
    'A-003':'Section 3 — Practical Circuits',
    'A-004':'Section 4 — Signals & Emissions',
    'A-005':'Section 5 — Antennas & Feedlines',
    'A-006':'Section 6 — Propagation',
    'A-007':'Section 7 — Station',
  },
  fr: {
    'B-001':'Section 1 — Réglementation et politiques',
    'B-002':'Section 2 — Procédures et pratiques d\\'exploitation',
    'B-003':'Section 3 — Assemblage de station, pratique et sécurité',
    'B-004':'Section 4 — Composants de circuits',
    'B-005':'Section 5 — Électronique de base et théorie',
    'B-006':'Section 6 — Lignes d\\'alimentation et systèmes d\\'antennes',
    'B-007':'Section 7 — Propagation des ondes radio',
    'B-008':'Section 8 — Interférence et suppression',
    'A-001':'Section 1 — Mathématiques et physique',
    'A-002':'Section 2 — Composants et circuits',
    'A-003':'Section 3 — Circuits pratiques',
    'A-004':'Section 4 — Signaux et émissions',
    'A-005':'Section 5 — Antennes et lignes d\\'alimentation',
    'A-006':'Section 6 — Propagation',
    'A-007':'Section 7 — Station',
  }
};

const STR = {
  en: {
    title: 'Canadian Amateur Radio',
    subtitle: 'Qualification Practice Exam',
    examTypeBasic: '✓ Basic Qualification',
    examTypeAdv: '✓ Advanced Qualification',
    infoBasic: '<strong>100 questions</strong> drawn randomly from the official ISED question bank (984 questions across 8 sections).<br><strong>Pass:</strong> 70/100 (70%) &nbsp;|&nbsp; <strong>Honours:</strong> 80/100 (80%)<br>Source: ISED Basic Qualification (effective 15 July 2025)',
    infoAdv: '<strong>50 questions</strong> drawn randomly from the official ISED question bank (549 questions across 7 sections).<br><strong>Pass:</strong> 35/50 (70%) &nbsp;|&nbsp; <strong>Honours:</strong> 40/50 (80%)<br>Source: ISED Advanced Qualification (effective 15 July 2025)',
    nameLabel: 'Full Name',
    emailLabel: 'Email Address',
    startBtn: 'Start Exam →',
    registering: 'Registering…',
    examTitle: '🍁 Basic Qualification Exam',
    examTitleAdv: '🍁 Advanced Qualification Exam',
    gridTitle: 'Question Overview — click to jump',
    prev: '← Previous',
    next: 'Next →',
    flag: '🚩 Flag',
    flagged: '🚩 Flagged',
    submitBtn: 'Submit Exam ✓',
    confirmPartial: 'You have {n} unanswered questions. Submit anyway?',
    confirmFull: 'Submit your exam? You cannot change your answers after submission.',
    resultsFor: 'Results for {name}',
    honoursBasic: '🏆 Basic with Honours',
    honoursAdv: '🏆 Advanced with Honours',
    passBasic: '✅ Basic Qualification — PASS',
    passAdv: '✅ Advanced Qualification — PASS',
    fail: '❌ Not Passed — {n} more correct needed',
    retake: '↺ New Exam',
    emailTitle: '📧 Receive Results by Email',
    sendEmail: 'Send Results',
    sending: 'Sending…',
    emailSent: '✓ Results sent to {email}',
    emailNoKey: 'Results saved. (Email requires RESEND_API_KEY)',
    emailFail: '✗ Failed to send. Please try again.',
    alreadyRegistered: '⚠ This email is already registered. Please use a different email.',
    emailAutoSent: '✓ Results automatically sent to {email}',
    breakdown: 'Section Breakdown',
    wrong: 'Incorrect Answers ({n})',
    yourAns: '✗ Your answer: {k}) {v}',
    correct: '✓ Correct: {k}) {v}',
    noAns: 'No answer',
    langBtn: 'FR',
  },
  fr: {
    title: 'Radio Amateur Canadien',
    subtitle: "Examen pratique de qualification",
    examTypeBasic: '✓ Qualification de base',
    examTypeAdv: '✓ Qualification supérieure',
    infoBasic: "<strong>100 questions</strong> tirées aléatoirement de la banque officielle de l'ISDE (984 questions dans 8 sections).<br><strong>Réussite:</strong> 70/100 (70%) &nbsp;|&nbsp; <strong>Avec mention:</strong> 80/100 (80%)<br>Source: Qualification de base ISDE (en vigueur le 15 juillet 2025)",
    infoAdv: "<strong>50 questions</strong> tirées aléatoirement de la banque officielle de l'ISDE (549 questions dans 7 sections).<br><strong>Réussite:</strong> 35/50 (70%) &nbsp;|&nbsp; <strong>Avec mention:</strong> 40/50 (80%)<br>Source: Qualification supérieure ISDE (en vigueur le 15 juillet 2025)",
    nameLabel: 'Nom complet',
    emailLabel: 'Adresse courriel',
    startBtn: "Commencer l'examen →",
    registering: 'Inscription…',
    examTitle: '🍁 Examen de qualification de base',
    examTitleAdv: '🍁 Examen de qualification supérieure',
    gridTitle: 'Aperçu des questions — cliquer pour accéder',
    prev: '← Précédent',
    next: 'Suivant →',
    flag: '🚩 Marquer',
    flagged: '🚩 Marquée',
    submitBtn: "Soumettre l'examen ✓",
    confirmPartial: 'Vous avez {n} questions sans réponse. Soumettre quand même ?',
    confirmFull: 'Soumettre votre examen ? Vous ne pourrez plus modifier vos réponses.',
    resultsFor: 'Résultats de {name}',
    honoursBasic: '🏆 Qualification de base avec mention',
    honoursAdv: '🏆 Qualification supérieure avec mention',
    passBasic: '✅ Qualification de base — RÉUSSI',
    passAdv: '✅ Qualification supérieure — RÉUSSI',
    fail: '❌ Non réussi — {n} bonne(s) réponse(s) manquante(s)',
    retake: '↺ Nouvel examen',
    emailTitle: '📧 Recevoir les résultats par courriel',
    sendEmail: 'Envoyer les résultats',
    sending: 'Envoi…',
    emailSent: '✓ Résultats envoyés à {email}',
    emailNoKey: 'Résultats sauvegardés. (Courriel nécessite RESEND_API_KEY)',
    emailFail: "✗ Échec de l'envoi. Veuillez réessayer.",
    alreadyRegistered: '⚠ Ce courriel est déjà enregistré. Veuillez utiliser un autre courriel.',
    emailAutoSent: '✓ Résultats envoyés automatiquement à {email}',
    breakdown: 'Résultats par section',
    wrong: 'Réponses incorrectes ({n})',
    yourAns: '✗ Votre réponse : {k}) {v}',
    correct: '✓ Correct : {k}) {v}',
    noAns: 'Sans réponse',
    langBtn: 'EN',
  }
};

let lang = localStorage.getItem('lang') || 'en';
let examType = 'basic'; // 'basic' | 'advanced'
let userName = '', userEmail = '';
let examQuestions = [], userAnswers = {}, flagged = new Set();
let currentQ = 0, submitted = false, lastResults = null, registrationId = null, emailAutoSent = false;

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) { alert(msg); return; }
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 3000);
}

function t(key, vars) {
  let s = STR[lang][key] || STR.en[key] || key;
  if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replace('{' + k + '}', v); });
  return s;
}

function sec(code) { return (SECTIONS[lang] || SECTIONS.en)[code] || code; }

function toggleLang() {
  lang = lang === 'en' ? 'fr' : 'en';
  localStorage.setItem('lang', lang);
  applyLang();
}

function setExamType(type) {
  if (examQuestions.length > 0 && !submitted) return;
  examType = type;
  document.getElementById('btn-type-basic').classList.toggle('active', type === 'basic');
  document.getElementById('btn-type-adv').classList.toggle('active', type === 'advanced');
  document.getElementById('s-info').innerHTML = t(type === 'advanced' ? 'infoAdv' : 'infoBasic');
  document.getElementById('e-title').textContent = t(type === 'advanced' ? 'examTitleAdv' : 'examTitle');
}

function applyLang() {
  document.documentElement.lang = lang;
  document.getElementById('lang-toggle').textContent = t('langBtn');
  // Start screen
  document.getElementById('s-title').textContent = t('title');
  document.getElementById('s-subtitle').textContent = t('subtitle');
  document.getElementById('lbl-type-basic').textContent = t('examTypeBasic').replace('✓ ', '');
  document.getElementById('lbl-type-adv').textContent = t('examTypeAdv').replace('✓ ', '');
  document.getElementById('s-info').innerHTML = t(examType === 'advanced' ? 'infoAdv' : 'infoBasic');
  document.getElementById('s-name-label').textContent = t('nameLabel');
  document.getElementById('s-email-label').textContent = t('emailLabel');
  const startBtn = document.getElementById('btn-start');
  if (!startBtn.disabled) startBtn.textContent = t('startBtn');
  // Exam screen
  document.getElementById('e-title').textContent = t(examType === 'advanced' ? 'examTitleAdv' : 'examTitle');
  document.getElementById('e-grid-title').textContent = t('gridTitle');
  document.getElementById('btn-prev').textContent = t('prev');
  document.getElementById('btn-next').textContent = t('next');
  document.getElementById('btn-submit').textContent = t('submitBtn');
  // Results screen
  document.getElementById('btn-retake').textContent = t('retake');
  document.getElementById('r-email-title').textContent = t('emailTitle');
  document.getElementById('btn-send-email').textContent = t('sendEmail');
  document.getElementById('r-breakdown-title').textContent = t('breakdown');
  // Re-render active dynamic content — swap question language if exam is running
  if (examQuestions.length > 0 && document.getElementById('screen-exam').classList.contains('active')) {
    const all = examType === 'advanced'
      ? (lang === 'fr' ? ALL_QUESTIONS_ADV_FR : ALL_QUESTIONS_ADV_EN)
      : (lang === 'fr' ? ALL_QUESTIONS_FR : ALL_QUESTIONS_EN);
    examQuestions = examQuestions.map(q => all.find(fq => fq.id === q.id) || q);
    renderQuestion(currentQ);
  }
  if (lastResults && document.getElementById('screen-results').classList.contains('active')) {
    renderResults(lastResults);
  }
}

function pickExam() {
  const all = examType === 'advanced'
    ? (lang === 'fr' ? ALL_QUESTIONS_ADV_FR : ALL_QUESTIONS_ADV_EN)
    : (lang === 'fr' ? ALL_QUESTIONS_FR : ALL_QUESTIONS_EN);
  const byTopic = {};
  for (const q of all) {
    const k = q.id.substring(0, 9);
    if (!byTopic[k]) byTopic[k] = [];
    byTopic[k].push(q);
  }
  const picked = Object.values(byTopic).map(arr => arr[Math.floor(Math.random() * arr.length)]);
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

async function startExam(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-start');
  btn.disabled = true;
  btn.textContent = t('registering');
  userName = document.getElementById('inp-name').value.trim();
  userEmail = document.getElementById('inp-email').value.trim();

  // Client-side check: warn if email was already registered (but still allow exam)
  if (localStorage.getItem('registered_email') === userEmail) {
    showToast(t('alreadyRegistered'));
  }

  try {
    const resp = await fetch('/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName, email: userEmail }),
    });
    const data = await resp.json();
    if (data.alreadyRegistered) {
      showToast(t('alreadyRegistered'));
    } else {
      localStorage.setItem('registered_email', userEmail);
    }
    registrationId = data.id; // works for both new and existing registrations
  } catch {}

  examQuestions = pickExam();
  userAnswers = {}; flagged = new Set(); currentQ = 0; submitted = false;
  btn.disabled = false; btn.textContent = t('startBtn');
  buildGrid(); goTo(0); showScreen('exam');
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
    d.className = 'q-dot'; d.id = 'dot-' + i; d.textContent = i + 1;
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
  currentQ = idx; renderQuestion(idx);
}

function renderQuestion(idx) {
  const q = examQuestions[idx];
  const total = examQuestions.length;
  document.getElementById('exam-counter').textContent = t('questionOf', { n: idx + 1, total });
  document.getElementById('progress-fill').style.width = ((idx + 1) / total * 100) + '%';
  document.getElementById('q-id').textContent = q.id;
  document.getElementById('q-text').textContent = q.q;
  const opts = document.getElementById('q-options');
  opts.innerHTML = '';
  ['a','b','c','d'].forEach(key => {
    const lbl = document.createElement('label');
    lbl.className = 'option-label' + (userAnswers[idx] === key ? ' selected' : '');
    lbl.innerHTML = '<input type="radio" name="opt" value="' + key + '">' +
      '<span class="option-key">' + key.toUpperCase() + '</span><span>' + q[key] + '</span>';
    lbl.onclick = () => selectAnswer(idx, key);
    opts.appendChild(lbl);
  });
  document.getElementById('btn-prev').disabled = idx === 0;
  document.getElementById('btn-next').disabled = idx === total - 1;
  document.getElementById('btn-prev').textContent = t('prev');
  document.getElementById('btn-next').textContent = t('next');
  const isFlagged = flagged.has(idx);
  document.getElementById('btn-flag').classList.toggle('flagged', isFlagged);
  document.getElementById('btn-flag').textContent = isFlagged ? t('flagged') : t('flag');
  document.getElementById('btn-submit').textContent = t('submitBtn');
  document.getElementById('btn-submit').style.display =
    Object.keys(userAnswers).length === total ? 'inline-block' : 'none';
  updateGrid();
}

function selectAnswer(idx, key) {
  if (submitted) return;
  userAnswers[idx] = key; renderQuestion(idx);
}

function toggleFlag() {
  if (flagged.has(currentQ)) flagged.delete(currentQ); else flagged.add(currentQ);
  renderQuestion(currentQ);
}

function confirmSubmit() {
  const answered = Object.keys(userAnswers).length;
  const total = examQuestions.length;
  const msg = answered < total
    ? t('confirmPartial', { n: total - answered })
    : t('confirmFull');
  if (!confirm(msg)) return;
  submitExam();
}

async function submitExam() {
  submitted = true;
  lastResults = calculateResults();
  emailAutoSent = false;
  try {
    const resp = await fetch('/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lastResults, name: userName, email: userEmail, registrationId }),
    });
    const data = await resp.json();
    emailAutoSent = data.emailSent || false;
  } catch {}
  showScreen('results');
  renderResults(lastResults);
}

function calculateResults() {
  let score = 0;
  const sectionScores = {}, wrongAnswers = [];
  examQuestions.forEach((q, i) => {
    const s = q.id.substring(0, 5);
    if (!sectionScores[s]) sectionScores[s] = { correct: 0, total: 0 };
    sectionScores[s].total++;
    const ua = userAnswers[i];
    if (ua === q.ans) { score++; sectionScores[s].correct++; }
    else wrongAnswers.push({ id: q.id, question: q.q, userAns: ua || '—', userText: ua ? q[ua] : t('noAns'), ans: q.ans, correctText: q[q.ans] });
  });
  return { score, total: examQuestions.length, sectionScores, wrongAnswers };
}

function renderResults(results) {
  const { score, total, sectionScores, wrongAnswers } = results;
  const pct = Math.round((score / total) * 100);
  document.getElementById('res-name').textContent = t('resultsFor', { name: userName });
  document.getElementById('res-score').textContent = score + '/' + total;
  document.getElementById('res-pct').textContent = pct + '%';
  const badge = document.getElementById('res-badge');
  const sfx = examType === 'advanced' ? 'Adv' : 'Basic';
  if (pct >= 80) { badge.textContent = t('honours' + sfx); badge.className = 'status-badge status-honours'; }
  else if (pct >= 70) { badge.textContent = t('pass' + sfx); badge.className = 'status-badge status-pass'; }
  else { badge.textContent = t('fail', { n: Math.ceil(total * 0.7) - score }); badge.className = 'status-badge status-fail'; }
  document.getElementById('res-email').value = userEmail;
  document.getElementById('r-email-title').textContent = t('emailTitle');
  document.getElementById('btn-send-email').textContent = t('sendEmail');
  const emailStatus = document.getElementById('email-status');
  const emailForm = document.querySelector('.email-form');
  if (emailAutoSent) {
    emailStatus.textContent = t('emailAutoSent', { email: userEmail });
    emailStatus.style.color = 'var(--green)';
    emailForm.style.display = 'none';
  } else {
    emailStatus.textContent = '';
    emailForm.style.display = '';
  }
  document.getElementById('btn-retake').textContent = t('retake');
  document.getElementById('r-breakdown-title').textContent = t('breakdown');
  const bd = document.getElementById('section-breakdown');
  bd.innerHTML = '';
  Object.entries(sectionScores).sort().forEach(([code, s]) => {
    const pctS = Math.round((s.correct / s.total) * 100);
    const row = document.createElement('div');
    row.className = 'section-row';
    row.innerHTML = '<span class="section-name">' + sec(code) + '</span>' +
      '<div class="section-bar-bg"><div class="section-bar" style="width:' + pctS + '%"></div></div>' +
      '<span class="section-score">' + s.correct + '/' + s.total + '</span>';
    bd.appendChild(row);
  });
  const wrongCard = document.getElementById('wrong-card');
  const wrongList = document.getElementById('wrong-list');
  if (wrongAnswers.length === 0) { wrongCard.style.display = 'none'; return; }
  wrongCard.style.display = '';
  document.getElementById('r-wrong-title').textContent = t('wrong', { n: wrongAnswers.length });
  wrongList.innerHTML = wrongAnswers.map(w =>
    '<div class="wrong-item">' +
    '<div class="wi-id">' + w.id + '</div>' +
    '<div class="wi-q">' + w.question + '</div>' +
    '<div class="wi-yours">' + t('yourAns', { k: w.userAns, v: w.userText }) + '</div>' +
    '<div class="wi-correct">' + t('correct', { k: w.ans, v: w.correctText }) + '</div>' +
    '</div>'
  ).join('');
}

async function submitEmail() {
  const email = document.getElementById('res-email').value.trim();
  if (!email) { alert(t('emailLabel') + '?'); return; }
  const statusEl = document.getElementById('email-status');
  statusEl.textContent = t('sending'); statusEl.style.color = '#666';
  try {
    const resp = await fetch('/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lastResults, name: userName, email, registrationId }),
    });
    const data = await resp.json();
    statusEl.textContent = data.emailSent ? t('emailSent', { email }) : t('emailNoKey');
    statusEl.style.color = data.emailSent ? 'var(--green)' : '#f57f17';
  } catch {
    statusEl.textContent = t('emailFail'); statusEl.style.color = '#c62828';
  }
}

function retake() {
  document.getElementById('inp-name').value = userName;
  document.getElementById('inp-email').value = userEmail;
  showScreen('start');
}

// Apply saved language on load
applyLang();
</script>
</body>
</html>`;
}
