import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined") {
  window.requestAnimationFrame = (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);

  /**
   * jsdom implements no media queries at all, so anything asking the browser
   * whether the visitor wants less motion throws rather than being told "no".
   * Every real browser has this; the stub is a gap in the test environment, not
   * a shim for a missing feature.
   *
   * It answers `false` — motion is allowed — because that is the branch with
   * something to assert. A component's reduced-motion behaviour is asserted
   * against the stylesheet in `reduced-motion.test.ts`, which is where the rule
   * actually lives.
   */
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
}
