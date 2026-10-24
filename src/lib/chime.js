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
