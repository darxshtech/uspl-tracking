// Synthesize a pleasant high-definition notification chime using Web Audio API
export function playBellChime() {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Harmonic 1: Crystal Primary Chime (G#5 -> C6)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(830.61, now);
    osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.08);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Harmonic 2: Sparkle Glass Overtone (E6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1318.51, now + 0.08);

    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.2, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    // Harmonic 3: Deep Resonant Bell Body (C5)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(523.25, now + 0.04);

    gain3.gain.setValueAtTime(0, now + 0.04);
    gain3.gain.linearRampToValueAtTime(0.15, now + 0.06);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc3.connect(gain3);
    gain3.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.7);

    osc2.start(now + 0.08);
    osc2.stop(now + 1.1);

    osc3.start(now + 0.04);
    osc3.stop(now + 0.9);
  } catch (err) {
    console.warn("Could not play bell sound:", err);
  }
}
