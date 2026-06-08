export async function onRequestPost({ request, env }) {
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
        return Response.json({ success: false, alreadyRegistered: true });
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
