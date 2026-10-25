// Serverless function (Vercel): ringkasan pemakaian project di Vercel untuk Admin > Usage.
// Token Vercel hanya ada di server (env), tidak pernah dikirim ke browser.
//
// Env yang dibutuhkan (Vercel Project Settings > Environment Variables):
//   VERCEL_TOKEN        token dari https://vercel.com/account/tokens
//   VERCEL_PROJECT_ID   id atau nama project
//   VERCEL_TEAM_ID      (opsional) hanya jika project berada di dalam team
//   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY   dipakai memverifikasi login admin

const API = 'https://api.vercel.com';

const json = (res, status, body) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
};

async function verifyAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return false;
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
  });
  return r.ok;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  try {
    if (!(await verifyAdmin(req))) return json(res, 401, { error: 'Unauthorized' });
  } catch {
    return json(res, 502, { error: 'Gagal memverifikasi sesi login' });
  }

  const { VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID } = process.env;
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    return json(res, 200, {
      configured: false,
      error: 'VERCEL_TOKEN dan VERCEL_PROJECT_ID belum di-set di Environment Variables.',
    });
  }

  const team = VERCEL_TEAM_ID ? `teamId=${encodeURIComponent(VERCEL_TEAM_ID)}` : '';
  const withTeam = (path) => `${API}${path}${path.includes('?') ? '&' : '?'}${team}`;
  const headers = { Authorization: `Bearer ${VERCEL_TOKEN}` };
  const get = async (path, parse = 'json') => {
    const r = await fetch(withTeam(path), { headers });
    if (!r.ok) throw new Error(`${path.split('?')[0]} → HTTP ${r.status}`);
    return parse === 'text' ? r.text() : r.json();
  };

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const out = { configured: true, generated_at: now.toISOString(), errors: {} };
  const pid = encodeURIComponent(VERCEL_PROJECT_ID);

  await Promise.all([
    // Info project
    get(`/v9/projects/${pid}`)
      .then((p) => {
        out.project = {
          name: p.name,
          framework: p.framework,
          node_version: p.nodeVersion,
          created_at: p.createdAt,
          updated_at: p.updatedAt,
          production_url: p.targets?.production?.alias?.[0] || p.alias?.[0]?.domain || null,
          git_repo: p.link ? `${p.link.org || ''}/${p.link.repo || ''}`.replace(/^\//, '') : null,
        };
      })
      .catch((e) => { out.errors.project = e.message; }),

    // Deployment terbaru + hitungan bulan ini
    get(`/v6/deployments?projectId=${pid}&limit=100`)
      .then((d) => {
        const list = d.deployments || [];
        const monthMs = monthStart.getTime();
        out.deployments = {
          this_month: list.filter((x) => x.created >= monthMs).length,
          this_month_failed: list.filter((x) => x.created >= monthMs && x.state === 'ERROR').length,
          sampled: list.length,
          recent: list.slice(0, 8).map((x) => ({
            id: x.uid,
            url: x.url,
            state: x.state,
            target: x.target || 'preview',
            created: x.created,
            commit: x.meta?.githubCommitMessage || x.meta?.gitCommitMessage || null,
            branch: x.meta?.githubCommitRef || x.meta?.gitCommitRef || null,
          })),
        };
      })
      .catch((e) => { out.errors.deployments = e.message; }),

    // Domain
    get(`/v9/projects/${pid}/domains`)
      .then((d) => {
        out.domains = (d.domains || []).map((x) => ({ name: x.name, verified: x.verified, redirect: x.redirect || null }));
      })
      .catch((e) => { out.errors.domains = e.message; }),

    // Pemakaian & biaya bulan ini (FOCUS JSONL). Best-effort: tidak semua plan/token punya akses.
    get(`/v1/billing/charges?from=${encodeURIComponent(monthStart.toISOString())}&to=${encodeURIComponent(now.toISOString())}`, 'text')
      .then((text) => {
        const byService = {};
        let total = 0;
        for (const line of text.split('\n')) {
          if (!line.trim()) continue;
          let row;
          try { row = JSON.parse(line); } catch { continue; }
          const name = row.ServiceName || row.SkuId || 'Lainnya';
          const s = (byService[name] ||= { service: name, quantity: 0, unit: row.ConsumedUnit || '', cost: 0 });
          s.quantity += Number(row.ConsumedQuantity) || 0;
          s.cost += Number(row.EffectiveCost ?? row.BilledCost) || 0;
          total += Number(row.EffectiveCost ?? row.BilledCost) || 0;
        }
        out.usage = { total_cost: total, services: Object.values(byService).sort((a, b) => b.quantity - a.quantity) };
      })
      .catch((e) => { out.errors.usage = e.message; }),
  ]);

  return json(res, 200, out);
}
