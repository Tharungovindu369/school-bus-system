/**
 * Native Audio and Haptic (Vibration) feedback for scanning.
 * Uses Web Audio API synthesizers so it requires 0 external audio files,
 * works 100% offline, has 0ms latency, and consumes 0 network bandwidth.
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playSuccessFeedback() {
  // Haptic feedback (100ms pulse)
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(100); } catch (_) {}
  }

  // Audio feedback: High-pitched crisp chime (880Hz to 1174Hz - A5 to D6)
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.12); // D6

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  } catch (err) {
    console.debug('Audio playback error:', err);
  }
}

export function playWarningFeedback() {
  // Haptic feedback (Double-buzz)
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([120, 60, 120]); } catch (_) {}
  }

  // Audio feedback: Two lower warning tones (440Hz and 330Hz)
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Pulse 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(440, now);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.1);

    // Pulse 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(330, now + 0.12);
    gain2.gain.setValueAtTime(0.4, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.22);
  } catch (err) {
    console.debug('Audio playback error:', err);
  }
}

export function playErrorFeedback() {
  // Haptic feedback (Single long buzz)
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(250); } catch (_) {}
  }

  // Audio feedback: Low buzz tone (220Hz)
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch (err) {
    console.debug('Audio playback error:', err);
  }
}
