import { useEffect, useRef } from "react";

/**
 * Configuration for the directional motion blur cursor effect.
 */
interface CursorConfig {
  /** Maximum trail length in pixels */
  maxTrailLength: number;
  /** Base opacity of the trail (0-1) */
  trailOpacity: number;
  /** Velocity smoothing factor (0-1, higher = less smoothing) */
  velocitySmoothing: number;
  /** How quickly the trail fades when cursor stops (0-1, higher = faster fade) */
  fadeRate: number;
  /** Maximum number of trail samples to render */
  maxSamples: number;
  /** Cursor radius in pixels */
  cursorRadius: number;
  /** Minimum velocity to show trail (px/s) */
  minVelocityForTrail: number;
  /** Maximum velocity considered (px/s) - clamped above this */
  maxVelocity: number;
  /** Cursor color */
  cursorColor: string;
  /** Trail color (can differ from cursor) */
  trailColor: string;
  /** Outer ring radius */
  outerRadius: number;
}

const DEFAULT_CONFIG: CursorConfig = {
  maxTrailLength: 100,
  trailOpacity: 0.7,
  velocitySmoothing: 0.2,
  fadeRate: 0.1,
  maxSamples: 30,
  cursorRadius: 5,
  minVelocityForTrail: 30,
  maxVelocity: 4000,
  cursorColor: "rgba(99, 102, 241, 1)",
  trailColor: "rgba(99, 102, 241,",
  outerRadius: 18,
};

interface PositionSample {
  x: number;
  y: number;
  time: number;
}

export default function MotionBlurCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const configRef = useRef<CursorConfig>(DEFAULT_CONFIG);
  const animFrameRef = useRef<number>(0);
  const isActiveRef = useRef(false);
  const reducedMotionRef = useRef(false);

  // Mutable state stored in refs to avoid React re-renders
  const stateRef = useRef({
    // Current pointer position (raw, no interpolation)
    pointerX: -100,
    pointerY: -100,
    // Smoothed velocity (px/s)
    velocityX: 0,
    velocityY: 0,
    // Trail fade factor (1 = fully visible, 0 = invisible)
    trailFade: 0,
    // Whether the pointer is inside the viewport
    pointerInside: false,
    // Position history ring buffer
    history: [] as PositionSample[],
    historyIndex: 0,
    historySize: 0,
    // Animation state
    needsAnimation: false,
    lastFrameTime: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const config = configRef.current;
    const state = stateRef.current;

    // Check for reduced motion preference
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = motionQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    motionQuery.addEventListener("change", handleMotionChange);

    // Ring buffer for position history
    const HISTORY_CAPACITY = 64;
    state.history = new Array(HISTORY_CAPACITY);
    for (let i = 0; i < HISTORY_CAPACITY; i++) {
      state.history[i] = { x: 0, y: 0, time: 0 };
    }

    // Resize canvas to match viewport and DPR
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();

    // Pointer event handlers
    const handlePointerMove = (e: PointerEvent) => {
      if (reducedMotionRef.current) return;
      state.pointerX = e.clientX;
      state.pointerY = e.clientY;
      state.pointerInside = true;

      // Add to history ring buffer
      const sample = state.history[state.historyIndex % HISTORY_CAPACITY];
      sample.x = e.clientX;
      sample.y = e.clientY;
      sample.time = performance.now();
      state.historyIndex++;
      if (state.historySize < HISTORY_CAPACITY) state.historySize++;

      if (!state.needsAnimation) {
        state.needsAnimation = true;
        state.lastFrameTime = performance.now();
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    const handlePointerLeave = () => {
      state.pointerInside = false;
      // Let the trail fade out naturally
      if (!state.needsAnimation) {
        state.needsAnimation = true;
        state.lastFrameTime = performance.now();
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Reset velocity when tab becomes hidden
        state.velocityX = 0;
        state.velocityY = 0;
        state.trailFade = 0;
      }
    };

    const handleWindowBlur = () => {
      state.pointerInside = false;
      state.velocityX = 0;
      state.velocityY = 0;
      state.trailFade = 0;
    };

    // Animation loop
    const animate = (now: number) => {
      const dt = Math.min((now - state.lastFrameTime) / 1000, 0.05); // Cap dt to 50ms
      state.lastFrameTime = now;

      if (reducedMotionRef.current) {
        // Just draw cursor at current position without trail
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        if (state.pointerInside) {
          drawCursor(ctx, state.pointerX, state.pointerY, config, 1);
        }
        state.needsAnimation = false;
        return;
      }

      // Calculate raw velocity from history
      let rawVx = 0;
      let rawVy = 0;
      if (state.historySize >= 2) {
        const newestIdx = (state.historyIndex - 1 + HISTORY_CAPACITY) % HISTORY_CAPACITY;
        const olderIdx = (state.historyIndex - 3 + HISTORY_CAPACITY * 2) % HISTORY_CAPACITY;
        const newest = state.history[newestIdx];
        const older = state.history[olderIdx];
        const timeDiff = (newest.time - older.time) / 1000;
        if (timeDiff > 0.001) {
          rawVx = (newest.x - older.x) / timeDiff;
          rawVy = (newest.y - older.y) / timeDiff;
        }
      }

      // Smooth velocity
      const smoothing = config.velocitySmoothing;
      state.velocityX += (rawVx - state.velocityX) * smoothing;
      state.velocityY += (rawVy - state.velocityY) * smoothing;

      // Calculate speed
      const speed = Math.sqrt(
        state.velocityX * state.velocityX + state.velocityY * state.velocityY
      );

      // Clamp velocity
      const clampedSpeed = Math.min(speed, config.maxVelocity);

      // Update trail fade
      if (clampedSpeed > config.minVelocityForTrail && state.pointerInside) {
        state.trailFade = Math.min(1, state.trailFade + dt * 12);
      } else {
        state.trailFade = Math.max(0, state.trailFade - config.fadeRate * dt * 60);
      }

      // Clear canvas
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // Draw trail if there's enough velocity and fade
      if (state.trailFade > 0.01 && clampedSpeed > config.minVelocityForTrail) {
        drawTrail(ctx, state, config, clampedSpeed);
      }

      // Draw cursor on top
      if (state.pointerInside) {
        drawCursor(ctx, state.pointerX, state.pointerY, config, 1);
      }

      // Continue animation if needed
      const shouldContinue =
        state.trailFade > 0.01 ||
        state.pointerInside ||
        Math.abs(state.velocityX) > 1 ||
        Math.abs(state.velocityY) > 1;

      if (shouldContinue) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        state.needsAnimation = false;
        state.velocityX = 0;
        state.velocityY = 0;
      }
    };

    // Draw the motion blur trail following the cursor's path
    const drawTrail = (
      ctx: CanvasRenderingContext2D,
      state: typeof stateRef.current,
      config: CursorConfig,
      speed: number
    ) => {
      if (state.historySize < 2) return;

      // Calculate how many samples to use based on speed
      const speedRatio = Math.min(1, speed / config.maxVelocity);
      const numSamples = Math.min(
        config.maxSamples,
        Math.max(4, Math.floor(speedRatio * config.maxSamples))
      );

      // Calculate total trail length based on speed
      const trailLength = speedRatio * config.maxTrailLength;

      // Get recent positions from history
      const positions: { x: number; y: number; distance: number }[] = [];
      let totalDistance = 0;

      // Start from most recent and go backward
      for (let i = 0; i < numSamples && i < state.historySize; i++) {
        const idx = (state.historyIndex - 1 - i + HISTORY_CAPACITY) % HISTORY_CAPACITY;
        const sample = state.history[idx];

        if (i === 0) {
          positions.push({ x: sample.x, y: sample.y, distance: 0 });
        } else {
          const prev = positions[positions.length - 1];
          const dx = sample.x - prev.x;
          const dy = sample.y - prev.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          totalDistance += dist;

          // Stop if we've exceeded trail length
          if (totalDistance > trailLength) break;

          positions.push({ x: sample.x, y: sample.y, distance: totalDistance });
        }
      }

      if (positions.length < 2) return;

      // Draw the trail as connected segments with fading opacity
      for (let i = positions.length - 1; i > 0; i--) {
        const curr = positions[i];
        const prev = positions[i - 1];

        // Calculate opacity based on distance from cursor
        const distanceRatio = curr.distance / trailLength;
        const opacity = (1 - distanceRatio) * config.trailOpacity * state.trailFade;

        if (opacity < 0.01) continue;

        // Calculate radius based on distance
        const radius = config.cursorRadius * (1 - distanceRatio * 0.7);

        // Draw segment
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.strokeStyle = `${config.trailColor} ${opacity})`;
        ctx.lineWidth = radius * 2;
        ctx.lineCap = "round";
        ctx.stroke();

        // Draw circle at this point for smooth appearance
        ctx.beginPath();
        ctx.arc(curr.x, curr.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `${config.trailColor} ${opacity * 0.8})`;
        ctx.fill();
      }
    };

    // Draw the cursor itself
    const drawCursor = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      config: CursorConfig,
      opacity: number
    ) => {
      // Inner dot
      ctx.beginPath();
      ctx.arc(x, y, config.cursorRadius, 0, Math.PI * 2);
      ctx.fillStyle = config.cursorColor;
      ctx.globalAlpha = opacity;
      ctx.fill();

      // Outer ring
      ctx.beginPath();
      ctx.arc(x, y, config.outerRadius, 0, Math.PI * 2);
      ctx.strokeStyle = config.cursorColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = opacity * 0.8;
      ctx.stroke();

      ctx.globalAlpha = 1;
    };

    // Attach event listeners
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("resize", resizeCanvas);

    // Start animation loop
    state.needsAnimation = true;
    state.lastFrameTime = performance.now();
    animFrameRef.current = requestAnimationFrame(animate);
    isActiveRef.current = true;

    return () => {
      // Cleanup
      cancelAnimationFrame(animFrameRef.current);
      isActiveRef.current = false;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("resize", resizeCanvas);
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9999] pointer-events-none"
      aria-hidden="true"
    />
  );
}
