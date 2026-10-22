// Salin semua data + file gambar dari project Supabase LAMA ke project BARU.
//
// Persiapan: jalankan schema.sql di project baru dulu.
// Jalankan (PowerShell, dari folder proyek):
//   $env:OLD_URL="https://xxxx.supabase.co"; $env:OLD_SERVICE_KEY="..."
//   $env:NEW_URL="https://yyyy.supabase.co"; $env:NEW_SERVICE_KEY="..."
//   node supabase/migrate/migrate-data.mjs
//
// Pakai service_role key (Settings > API), BUKAN anon key. Jangan di-commit / dibagikan.
// Script aman dijalankan ulang (upsert). Data di project lama tidak diubah sama sekali.

import { createClient } from '@supabase/supabase-js';

const { OLD_URL, OLD_SERVICE_KEY, NEW_URL, NEW_SERVICE_KEY } = process.env;
if (!OLD_URL || !OLD_SERVICE_KEY || !NEW_URL || !NEW_SERVICE_KEY) {
  console.error('Isi dulu OLD_URL, OLD_SERVICE_KEY, NEW_URL, NEW_SERVICE_KEY (lihat komentar di atas file).');
  process.exit(1);
}
if (OLD_URL === NEW_URL) {
  console.error('OLD_URL dan NEW_URL sama. Batal supaya data tidak tertimpa.');
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const oldDb = createClient(OLD_URL, OLD_SERVICE_KEY, opts);
const newDb = createClient(NEW_URL, NEW_SERVICE_KEY, opts);

// Urutan penting: financial_events sebelum transactions (foreign key).
const TABLES = [
  { name: 'financial_events', conflict: 'id' },
  { name: 'transactions', conflict: 'id' },
  { name: 'booked_dates', conflict: 'id' },
  { name: 'settings', conflict: 'key' },
  { name: 'gallery_images', conflict: 'id' },
  { name: 'reviews', conflict: 'id' },
  { name: 'client_logos', conflict: 'id' },
  { name: 'site_settings', conflict: 'key' },
];
const BUCKETS = ['gallery', 'client-logos'];
const URL_COLUMNS = { gallery_images: ['url'], client_logos: ['logo_url'] };

const OLD_STORAGE = `${OLD_URL.replace(/\/$/, '')}/storage/v1/object/public/`;
const NEW_STORAGE = `${NEW_URL.replace(/\/$/, '')}/storage/v1/object/public/`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const main = async () => {
  // 1) Baca semua data lama + validasi dulu sebelum menulis apa pun
  const data = {};
  for (const t of TABLES) {
    data[t.name] = await fetchAll(oldDb, t.name);
    console.log(`Baca ${t.name}: ${data[t.name].length} baris`);
    if (t.conflict === 'id') {
      const bad = data[t.name].find((r) => !UUID.test(String(r.id)));
      if (bad) {
        throw new Error(
          `Tabel ${t.name} memakai id non-UUID (${bad.id}). Ubah kolom id (dan transactions.event_id) di schema.sql ` +
            `menjadi bigint, lalu jalankan ulang schema.sql di project baru.`
        );
      }
    }
  }

  // 2) Salin baris
  for (const t of TABLES) {
    const rows = data[t.name].map((r) => rewriteUrls(t.name, r));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await newDb.from(t.name).upsert(rows.slice(i, i + 500), { onConflict: t.conflict });
      if (error) throw new Error(`Gagal menulis ${t.name}: ${error.message}`);
    }
    console.log(`Salin ${t.name}: ${rows.length} baris`);
  }

  // 3) Salin file storage
  for (const bucket of BUCKETS) {
    const { data: files, error } = await oldDb.storage.from(bucket).list('', { limit: 1000 });
    if (error) {
      console.warn(`Bucket ${bucket} dilewati: ${error.message}`);
      continue;
    }
    const names = (files || []).filter((f) => f.id).map((f) => f.name);
    let copied = 0;
    for (const name of names) {
      const { data: blob, error: dlError } = await oldDb.storage.from(bucket).download(name);
      if (dlError) {
        console.warn(`  gagal unduh ${bucket}/${name}: ${dlError.message}`);
        continue;
      }
      const { error: upError } = await newDb.storage.from(bucket).upload(name, blob, {
        upsert: true,
        contentType: blob.type || undefined,
      });
      if (upError) console.warn(`  gagal unggah ${bucket}/${name}: ${upError.message}`);
      else copied += 1;
    }
    console.log(`Salin file ${bucket}: ${copied}/${names.length}`);
  }

  // 4) Verifikasi jumlah baris
  console.log('\nVerifikasi jumlah baris (lama -> baru):');
  let ok = true;
  for (const t of TABLES) {
    const { count, error } = await newDb.from(t.name).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Gagal verifikasi ${t.name}: ${error.message}`);
    const match = count === data[t.name].length;
    if (!match) ok = false;
    console.log(`  ${match ? 'OK ' : 'BEDA'} ${t.name}: ${data[t.name].length} -> ${count}`);
  }
  console.log(ok ? '\nMigrasi selesai, semua jumlah baris cocok.' : '\nSelesai, tapi ada tabel yang jumlahnya beda. Cek log di atas.');
};

main().catch((e) => {
  console.error(`\nMIGRASI BERHENTI: ${e.message}`);
  process.exit(1);
});
