// Pindahkan data + file gambar Supabase LAMA -> BARU.
//
// Tiga mode (env MODE):
//   copy   (default) : lama -> baru langsung. Butuh dua project aktif bersamaan.
//   export           : lama -> folder lokal supabase/migrate/backup (hanya butuh project lama).
//   import           : folder backup -> baru (hanya butuh project baru).
// Mode export + import berguna kalau batas 2 project membuat Anda tidak bisa punya dua project sekaligus.
//
// Persiapan: jalankan schema.sql di project baru dulu (untuk mode copy / import).
// Contoh (PowerShell, dari folder proyek):
//   # cadangkan dulu
//   $env:MODE="export"; $env:OLD_URL="https://xxxx.supabase.co"; $env:OLD_SERVICE_KEY="..."
//   node supabase/migrate/migrate-data.mjs
//   # setelah project baru siap
//   $env:MODE="import"; $env:OLD_URL="https://xxxx.supabase.co"; $env:NEW_URL="https://yyyy.supabase.co"; $env:NEW_SERVICE_KEY="..."
//   node supabase/migrate/migrate-data.mjs
//
// Pakai service_role key (Settings > API), BUKAN anon key. Jangan di-commit / dibagikan.
// Folder backup berisi data bisnis Anda: jangan di-commit (sudah masuk .gitignore).
// Data di project lama tidak pernah diubah oleh script ini. Aman dijalankan ulang (upsert).

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { OLD_URL, OLD_SERVICE_KEY, NEW_URL, NEW_SERVICE_KEY, MODE = 'copy' } = process.env;
const BACKUP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'backup');

const need = (...names) => {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    console.error(`Isi dulu env: ${missing.join(', ')} (lihat komentar di atas file).`);
    process.exit(1);
  }
};

if (!['copy', 'export', 'import'].includes(MODE)) {
  console.error('MODE harus copy, export, atau import.');
  process.exit(1);
}
if (MODE === 'copy') need('OLD_URL', 'OLD_SERVICE_KEY', 'NEW_URL', 'NEW_SERVICE_KEY');
if (MODE === 'export') need('OLD_URL', 'OLD_SERVICE_KEY');
// import: OLD_URL diperlukan untuk menulis ulang alamat gambar
if (MODE === 'import') need('OLD_URL', 'NEW_URL', 'NEW_SERVICE_KEY');
if (MODE !== 'export' && OLD_URL === NEW_URL) {
  console.error('OLD_URL dan NEW_URL sama. Batal supaya data tidak tertimpa.');
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const oldDb = OLD_URL && OLD_SERVICE_KEY ? createClient(OLD_URL, OLD_SERVICE_KEY, opts) : null;
const newDb = NEW_URL && NEW_SERVICE_KEY ? createClient(NEW_URL, NEW_SERVICE_KEY, opts) : null;

// Urutan penting: financial_events sebelum transactions (foreign key).
const TABLES = [
  { name: 'financial_events', conflict: 'id', idKind: 'int' },
  { name: 'transactions', conflict: 'id', idKind: 'int' },
  { name: 'booked_dates', conflict: 'id', idKind: 'uuid' },
  { name: 'settings', conflict: 'key' },
  { name: 'gallery_images', conflict: 'id', idKind: 'uuid' },
  { name: 'reviews', conflict: 'id', idKind: 'uuid' },
  { name: 'client_logos', conflict: 'id', idKind: 'uuid' },
  { name: 'site_settings', conflict: 'key' },
];
const BUCKETS = ['gallery', 'client-logos'];
const URL_COLUMNS = { gallery_images: ['url'], client_logos: ['logo_url'] };

const OLD_STORAGE = OLD_URL ? `${OLD_URL.replace(/\/$/, '')}/storage/v1/object/public/` : '';
const NEW_STORAGE = NEW_URL ? `${NEW_URL.replace(/\/$/, '')}/storage/v1/object/public/` : '';
const INTEGER_ID = /^\d+$/;
const UUID_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fetchAll = async (client, table) => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(`Gagal membaca ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
};

const rewriteUrls = (table, row) => {
  const out = { ...row };
  for (const col of URL_COLUMNS[table] || []) {
    if (typeof out[col] === 'string') out[col] = out[col].replace(OLD_STORAGE, NEW_STORAGE);
  }
  return out;
};

// Tipe id harus sesuai schema.sql (angka atau UUID, per tabel). Hentikan lebih awal kalau berbeda.
const validateIds = (data) => {
  for (const t of TABLES) {
    if (!t.idKind) continue;
    const pattern = t.idKind === 'int' ? INTEGER_ID : UUID_ID;
    const bad = data[t.name].find((r) => !pattern.test(String(r.id)));
    if (bad) {
      throw new Error(
        `Tabel ${t.name} punya id ${bad.id}, tidak sesuai schema.sql (${t.idKind === 'int' ? 'angka' : 'UUID'}). ` +
          `Kirim pesan ini agar skema disesuaikan.`
      );
    }
  }
};

// ── Sumber data ─────────────────────────────────────────────────────────────
const readFromOld = async () => {
  const data = {};
  for (const t of TABLES) {
    data[t.name] = await fetchAll(oldDb, t.name);
    console.log(`Baca ${t.name}: ${data[t.name].length} baris`);
  }
  return data;
};

const readFromBackup = () => {
  const data = {};
  for (const t of TABLES) {
    const file = path.join(BACKUP_DIR, `${t.name}.json`);
    if (!fs.existsSync(file)) throw new Error(`File backup tidak ditemukan: ${file}. Jalankan MODE=export dulu.`);
    data[t.name] = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log(`Baca backup ${t.name}: ${data[t.name].length} baris`);
  }
  return data;
};

const listBucket = async (client, bucket) => {
  const { data: files, error } = await client.storage.from(bucket).list('', { limit: 1000 });
  if (error) {
    console.warn(`Bucket ${bucket} dilewati: ${error.message}`);
    return [];
  }
  return (files || []).filter((f) => f.id).map((f) => f.name);
};

// ── Tujuan ──────────────────────────────────────────────────────────────────
const writeRows = async (data) => {
  for (const t of TABLES) {
    const rows = data[t.name].map((r) => rewriteUrls(t.name, r));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await newDb.from(t.name).upsert(rows.slice(i, i + 500), { onConflict: t.conflict });
      if (error) throw new Error(`Gagal menulis ${t.name}: ${error.message}`);
    }
    console.log(`Salin ${t.name}: ${rows.length} baris`);
  }
};

const verify = async (data) => {
  console.log('\nVerifikasi jumlah baris (sumber -> baru):');
  let ok = true;
  for (const t of TABLES) {
    const { count, error } = await newDb.from(t.name).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Gagal verifikasi ${t.name}: ${error.message}`);
    const match = count === data[t.name].length;
    if (!match) ok = false;
    console.log(`  ${match ? 'OK ' : 'BEDA'} ${t.name}: ${data[t.name].length} -> ${count}`);
  }
  console.log(ok ? '\nSelesai, semua jumlah baris cocok.' : '\nSelesai, tapi ada tabel yang jumlahnya beda. Cek log di atas.');
};

const main = async () => {
  if (MODE === 'export') {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const data = await readFromOld();
    // Export hanya mencadangkan; catat tipe id & kolom tiap tabel supaya skema baru bisa disesuaikan
    console.log('');
    console.log('Tipe id & kolom per tabel:');
    for (const t of TABLES) {
      const rows = data[t.name];
      const kind = (v) => (v === undefined || v === null ? '-' : INTEGER_ID.test(String(v)) ? 'angka' : 'bukan-angka');
      const cols = rows[0] ? Object.keys(rows[0]).join(', ') : '(kosong)';
      console.log(`  ${t.name}: id=${kind(rows[0]?.id ?? rows[0]?.key)}  kolom: ${cols}`);
    }
    for (const t of TABLES) fs.writeFileSync(path.join(BACKUP_DIR, `${t.name}.json`), JSON.stringify(data[t.name], null, 2));
    for (const bucket of BUCKETS) {
      const dir = path.join(BACKUP_DIR, 'storage', bucket);
      fs.mkdirSync(dir, { recursive: true });
      const names = await listBucket(oldDb, bucket);
      let saved = 0;
      for (const name of names) {
        const { data: blob, error } = await oldDb.storage.from(bucket).download(name);
        if (error) {
          console.warn(`  gagal unduh ${bucket}/${name}: ${error.message}`);
          continue;
        }
        fs.writeFileSync(path.join(dir, name), Buffer.from(await blob.arrayBuffer()));
        saved += 1;
      }
      console.log(`Simpan file ${bucket}: ${saved}/${names.length}`);
    }
    console.log(`\nBackup selesai di: ${BACKUP_DIR}`);
    return;
  }

  const data = MODE === 'import' ? readFromBackup() : await readFromOld();
  validateIds(data);
  await writeRows(data);

  for (const bucket of BUCKETS) {
    let copied = 0;
    let total = 0;
    if (MODE === 'import') {
      const dir = path.join(BACKUP_DIR, 'storage', bucket);
      const names = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
      total = names.length;
      for (const name of names) {
        const { error } = await newDb.storage.from(bucket).upload(name, fs.readFileSync(path.join(dir, name)), { upsert: true });
        if (error) console.warn(`  gagal unggah ${bucket}/${name}: ${error.message}`);
        else copied += 1;
      }
    } else {
      const names = await listBucket(oldDb, bucket);
      total = names.length;
      for (const name of names) {
        const { data: blob, error } = await oldDb.storage.from(bucket).download(name);
        if (error) {
          console.warn(`  gagal unduh ${bucket}/${name}: ${error.message}`);
          continue;
        }
        const { error: upError } = await newDb.storage.from(bucket).upload(name, blob, { upsert: true, contentType: blob.type || undefined });
        if (upError) console.warn(`  gagal unggah ${bucket}/${name}: ${upError.message}`);
        else copied += 1;
      }
    }
    console.log(`Salin file ${bucket}: ${copied}/${total}`);
  }

  // Id berikutnya melanjutkan dari angka tertinggi (jika tidak, tambah data baru bisa bentrok)
  const { error: seqError } = await newDb.rpc('reset_id_sequences');
  if (seqError) {
    console.warn(`
PERINGATAN: gagal mereset nomor urut id (${seqError.message}). Jalankan schema.sql versi terbaru di project baru lalu ulangi import.`);
  } else {
    console.log('Nomor urut id direset.');
  }

  await verify(data);
};

main().catch((e) => {
  console.error(`\nMIGRASI BERHENTI: ${e.message}`);
  process.exit(1);
});
