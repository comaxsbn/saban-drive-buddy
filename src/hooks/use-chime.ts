import { useCallback, useRef } from "react";

/** Web Audio two-tone chime (D5 -> A5) for arrivals, verifications and נועה replies. */
export function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);

  return useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = ctxRef.current ?? new Ctor();
      ctxRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();

      const master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);

      const tone = (freq: number, at: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + at);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
        osc.connect(gain);
        gain.connect(master);
        osc.start(ctx.currentTime + at);
        osc.stop(ctx.currentTime + at + dur + 0.05);
      };

      tone(587.33, 0, 0.28); // D5
      tone(880.0, 0.16, 0.42); // A5
    } catch {
      /* audio is best-effort */
    }
  }, []);
}