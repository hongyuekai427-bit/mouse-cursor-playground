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
  maxTrailLength: 80,
  trailOpacity: 0.6,
  velocitySmoothing: 0.15,
  fadeRate: 0.08,
  maxSamples: 24,
  cursorRadius: 5,
  minVelocityForTrail: 50,
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
    // Current smoothed position
    currentX: -100,
    currentY: -100,
    // Target position (raw pointer position)
    targetX: -100,
    targetY: -100,
    // Smoothed velocity (px/s)
    velocityX: 0,
    velocityY: 0,
    // Raw velocity for trail length calculation
    rawSpeed: 0,
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
    // Current angle of movement
    angle: 0,
    // Previous angle for smoothing
    prevAngle: 0,
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
    const HISTORY_CAPACITY = 32;
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
      state.targetX = e.clientX;
      state.targetY = e.clientY;
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
        state.rawSpeed = 0;
        state.trailFade = 0;
      }
    };

    const handleWindowBlur = () => {
      state.pointerInside = false;
      state.velocityX = 0;
      state.velocityY = 0;
      state.rawSpeed = 0;
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
          drawCursor(ctx, state.targetX, state.targetY, config, 1);
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
      state.rawSpeed = speed;

      // Clamp velocity
      const clampedSpeed = Math.min(speed, config.maxVelocity);

      // Update trail fade
      if (clampedSpeed > config.minVelocityForTrail && state.pointerInside) {
        state.trailFade = Math.min(1, state.trailFade + dt * 12);
      } else {
        state.trailFade = Math.max(0, state.trailFade - config.fadeRate * dt * 60);
      }

      // Interpolate current position toward target (smooth follow)
      const followSpeed = 0.35;
      state.currentX += (state.targetX - state.currentX) * followSpeed;
      state.currentY += (state.targetY - state.currentY) * followSpeed;

      // Calculate movement angle
      if (clampedSpeed > config.minVelocityForTrail) {
        const targetAngle = Math.atan2(state.velocityY, state.velocityX);
        // Smooth angle transitions
        let angleDiff = targetAngle - state.prevAngle;
        // Normalize to -PI to PI
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        state.angle = state.prevAngle + angleDiff * 0.3;
        state.prevAngle = state.angle;
      }

      // Clear canvas
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // Draw trail if there's enough velocity and fade
      if (state.trailFade > 0.01 && clampedSpeed > config.minVelocityForTrail) {
        drawTrail(ctx, state, config, clampedSpeed);
      }

      // Draw cursor on top
      if (state.pointerInside) {
        drawCursor(ctx, state.currentX, state.currentY, config, 1);
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

    // Draw the directional motion blur trail
    const drawTrail = (
      ctx: CanvasRenderingContext2D,
      state: typeof stateRef.current,
      config: CursorConfig,
      speed: number
    ) => {
      const trailLength = Math.min(
        config.maxTrailLength,
        (speed / config.maxVelocity) * config.maxTrailLength
      );
      const numSamples = Math.min(
        config.maxSamples,
        Math.max(4, Math.floor((trailLength / config.maxTrailLength) * config.maxSamples))
      );

      const cos = Math.cos(state.angle + Math.PI); // Trail goes behind cursor
      const sin = Math.sin(state.angle + Math.PI);

      // Draw trail as a series of fading circles along the movement direction
      for (let i = 0; i < numSamples; i++) {
        const t = i / numSamples; // 0 = closest to cursor, 1 = farthest
        const distance = t * trailLength;
        const x = state.currentX + cos * distance;
        const y = state.currentY + sin * distance;

        // Opacity decreases along the trail
        const opacity = (1 - t * t) * config.trailOpacity * state.trailFade;
        // Size decreases along the trail
        const radius = config.cursorRadius * (1 - t * 0.6);

        if (opacity < 0.01 || radius < 0.5) continue;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `${config.trailColor} ${opacity})`;
        ctx.fill();
      }

      // Draw a stretched ellipse for the main blur effect
      const stretchFactor = Math.min(3, speed / 800);
      if (stretchFactor > 0.3) {
        ctx.save();
        ctx.translate(state.currentX, state.currentY);
        ctx.rotate(state.angle + Math.PI);

        // Main elongated blur shape
        const blurLength = trailLength * 0.7;
        const blurWidth = config.cursorRadius * 1.5;
        const gradient = ctx.createLinearGradient(0, 0, blurLength, 0);
        gradient.addColorStop(0, `${config.trailColor} ${0.4 * state.trailFade})`);
        gradient.addColorStop(0.3, `${config.trailColor} ${0.2 * state.trailFade})`);
        gradient.addColorStop(1, `${config.trailColor} 0)`);

        ctx.beginPath();
        ctx.ellipse(
          blurLength * 0.5,
          0,
          blurLength * 0.5,
          blurWidth * (1 + stretchFactor * 0.3),
          0,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
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
