/**
 * One-shot brand-colored confetti burst.
 *
 * Fires two overlapping bursts from the left and right edges towards
 * the center — feels more celebratory than a single pop. Uses the
 * KnowOn CI palette so the moment feels like "us", not a generic
 * rainbow. Lazy-imports canvas-confetti so the lib only ships in the
 * client bundle when fireBrandConfetti is actually called.
 *
 * Safe to call from any client component.
 */
export async function fireBrandConfetti(): Promise<void> {
  if (typeof window === "undefined") return;

  const { default: confetti } = await import("canvas-confetti");

  const palette = ["#0097A7", "#ff0054", "#392054", "#ffffff"];
  const defaults = {
    colors: palette,
    startVelocity: 45,
    spread: 70,
    ticks: 200,
    scalar: 1,
    zIndex: 9999,
  } as const;

  confetti({
    ...defaults,
    particleCount: 90,
    angle: 60,
    origin: { x: 0, y: 0.75 },
  });
  confetti({
    ...defaults,
    particleCount: 90,
    angle: 120,
    origin: { x: 1, y: 0.75 },
  });

  // Delayed middle burst — a second "wave" once the first has started
  // falling, so the effect lasts long enough to register.
  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 60,
      angle: 90,
      spread: 120,
      origin: { x: 0.5, y: 0.3 },
    });
  }, 250);
}
