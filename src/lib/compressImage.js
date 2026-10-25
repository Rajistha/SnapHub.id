// Kompres gambar di browser: perkecil dimensi lalu simpan sebagai WebP.
// Mengembalikan File baru (.webp), atau file asli jika hasilnya tidak lebih kecil.
export default async function compressImage(file, { maxSize = 1920, quality = 0.82 } = {}) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (!blob || blob.type !== 'image/webp') throw new Error('Browser tidak mendukung kompresi WebP');
  if (blob.size >= file.size && file.type === 'image/webp') return file;

  const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
  return new File([blob], name, { type: 'image/webp' });
}
