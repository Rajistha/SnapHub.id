// Suara & getar untuk panggilan antrian (satu implementasi untuk admin, tamu, dan layar TV).

let ctx = null;

const getContext = () => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) ctx = new Ctor();
  }
  return ctx;
};

// Browser mobile hanya mengizinkan audio setelah gestur pengguna. Panggil dari event klik/sentuh.
export const unlockAudio = () => {
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch {
    /* audio tidak tersedia */
  }
};

const note = (c, freq, start, duration, gainValue) => {
  const osc = c.createOscillator();
  const overtone = c.createOscillator();
  const gain = c.createGain();
  const overtoneGain = c.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, start);
  overtone.type = 'sine';
  overtone.frequency.setValueAtTime(freq * 2, start);

  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  overtoneGain.gain.setValueAtTime(gainValue * 0.35, start);
  overtoneGain.gain.exponentialRampToValueAtTime(0.001, start + duration * 0.7);

  osc.connect(gain).connect(c.destination);
  overtone.connect(overtoneGain).connect(c.destination);
  osc.start(start);
  overtone.start(start);
  osc.stop(start + duration);
  overtone.stop(start + duration);
};

// Empat nada naik C5-E5-G5-C6.
export const playChime = (volume = 0.8) => {
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const t = c.currentTime;
    note(c, 523.25, t, 0.45, 0.85 * volume);
    note(c, 659.25, t + 0.22, 0.45, 0.85 * volume);
    note(c, 783.99, t + 0.44, 0.45, 0.85 * volume);
    note(c, 1046.5, t + 0.66, 1.0, 0.95 * volume);
  } catch {
    /* abaikan */
  }
};

export const vibrate = () => {
  try {
    if ('vibrate' in navigator) navigator.vibrate([400, 180, 400, 180, 700]);
  } catch {
    /* abaikan */
  }
};

// ── Pengumuman suara manusia (Web Speech API bawaan browser, tanpa biaya & tanpa server) ──
const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

// Suara Indonesia terbaik yang tersedia di perangkat; bila tidak ada, browser memakai suara bawaannya.
const pickVoice = () => {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'id-ID' && /google|natural|online/i.test(v.name)) ||
    voices.find((v) => v.lang === 'id-ID') ||
    voices.find((v) => v.lang?.toLowerCase().startsWith('id')) ||
    null
  );
};

export const speak = (text, { repeat = 1, rate = 0.92 } = {}) => {
  if (!speechSupported()) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    for (let i = 0; i < repeat; i += 1) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'id-ID';
      u.rate = rate;
      u.volume = 1;
      const voice = pickVoice();
      if (voice) u.voice = voice;
      synth.speak(u);
    }
    return true;
  } catch {
    return false;
  }
};

// "A-05" → "A 5" agar dibaca natural ("A lima"), bukan "A strip nol lima".
const spokenNumber = (queueNumber) => {
  const m = /^([A-Za-z]+)[-\s]?0*(\d+)$/.exec(queueNumber || '');
  return m ? `${m[1]} ${m[2]}` : String(queueNumber || '');
};

// Nada panggilan lalu suara manusia, diulang dua kali.
export const announceQueue = (queueNumber, name) => {
  playChime(1);
  const who = name ? `${name}, ` : '';
  const text = `Nomor antrian ${spokenNumber(queueNumber)}. ${who}silakan menuju photobooth.`;
  setTimeout(() => speak(text, { repeat: 2 }), 1800);
};
