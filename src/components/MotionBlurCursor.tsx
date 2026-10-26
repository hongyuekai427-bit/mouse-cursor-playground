import { useEffect, useRef } from "react";

interface TimestampedPos {
  x: number;
  y: number;
  t: number;
}

export default function MotionBlurCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const reducedMotionRef = useRef(false);

  const stateRef = useRef({
    x: 0,
    y: 0,
    visible: false,
    hasMoved: false,
    // Position history buffer for 50ms windowed velocity calculation
    history: [] as TimestampedPos[],
    // Smoothed velocity (px/ms)
    vx: 0,
    vy: 0,
    // Smoothed speed
    smoothSpeed: 0,
    // Direction angle
    angle: 0,
    // Cumulative distance traveled (decays over time)
    distanceTraveled: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = stateRef.current;

    // Reduced motion check
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = motionQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    motionQuery.addEventListener("change", handleMotionChange);

    // Resize canvas
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();

    // Pointer handlers
    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      state.x = e.clientX;
      state.y = e.clientY;
      state.visible = true;
      state.hasMoved = true;

      // Add to history buffer
      state.history.push({ x: e.clientX, y: e.clientY, t: now });

      // Keep only last 100ms of history (buffer for 50ms window + margin)
      const cutoff = now - 100;
      while (state.history.length > 0 && state.history[0].t < cutoff) {
        state.history.shift();
      }
    };

    const handlePointerLeave = () => {
      state.visible = false;
    };

    const handlePointerEnter = () => {
      state.visible = true;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        state.vx = 0;
        state.vy = 0;
        state.smoothSpeed = 0;
        state.distanceTraveled = 0;
        state.history.length = 0;
      }
    };

    // Calculate velocity from 50ms window of history
    const calculateWindowedVelocity = (now: number) => {
      const windowStart = now - 50; // 50ms window

      // Find positions at start and end of window
      let startPos: TimestampedPos | null = null;
      let endPos: TimestampedPos | null = null;

      for (let i = state.history.length - 1; i >= 0; i--) {
        const p = state.history[i];
        if (p.t >= windowStart) {
          endPos = p;
        }
        if (p.t <= windowStart && !startPos) {
          startPos = p;
          break;
        }
      }

      // If no start position, use oldest in window
      if (!startPos) {
        for (let i = 0; i < state.history.length; i++) {
          if (state.history[i].t >= windowStart) {
            startPos = state.history[i];
            break;
          }
        }
      }

      if (!startPos || !endPos || startPos === endPos) {
        return { vx: 0, vy: 0 };
      }

      const dt = endPos.t - startPos.t;
      if (dt < 1) return { vx: 0, vy: 0 };

      return {
        vx: (endPos.x - startPos.x) / dt,
        vy: (endPos.y - startPos.y) / dt,
      };
    };

    // Animation loop
    const animate = () => {
      const now = performance.now();
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      if (!state.visible || !state.hasMoved) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      if (reducedMotionRef.current) {
        drawCursor(ctx, state.x, state.y, 0, 0);
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Calculate velocity from 50ms window
      const { vx: rawVx, vy: rawVy } = calculateWindowedVelocity(now);

      // Smooth velocity
      state.vx = state.vx * 0.7 + rawVx * 0.3;
      state.vy = state.vy * 0.7 + rawVy * 0.3;

      // Calculate speed (convert px/ms to px/frame at 60fps)
      const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy) * 16.67;

      // Add to distance traveled
      state.distanceTraveled += speed;

      // Decay distance over time - slower decay at low speeds
      let decayFactor: number;
      if (speed < 1) {
        decayFactor = 0.99;
      } else if (speed < 5) {
        decayFactor = 0.97;
      } else if (speed < 15) {
        decayFactor = 0.92;
      } else {
        decayFactor = 0.85;
      }
      state.distanceTraveled *= decayFactor;

      // Smooth speed
      state.smoothSpeed = state.smoothSpeed * 0.85 + speed * 0.15;

      // Update angle
      if (speed > 0.5) {
        state.angle = Math.atan2(state.vy, state.vx);
      }

      // Draw trail
      if (state.smoothSpeed > 0.1 || state.distanceTraveled > 2) {
        drawDirectionalTrail(ctx, state);
      }

      // Draw cursor (with stretch when moving fast)
      drawCursor(ctx, state.x, state.y, state.angle, state.smoothSpeed);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    // Draw directional trail
    const drawDirectionalTrail = (
      ctx: CanvasRenderingContext2D,
      state: typeof stateRef.current
    ) => {
      const speed = state.smoothSpeed;
      const angle = state.angle;

      // Trail length based on distance traveled
      const cursorRadius = 3;
      const minTrailLength = cursorRadius * 2;
      const maxTrailLength = cursorRadius * 10;
      const trailLength = Math.min(maxTrailLength, Math.max(minTrailLength, state.distanceTraveled * 0.5));

      const numSamples = Math.min(15, Math.max(5, Math.floor(trailLength / 2)));

      // Direction behind cursor
      const backX = -Math.cos(angle);
      const backY = -Math.sin(angle);

      // Draw fading circles
      for (let i = 0; i < numSamples; i++) {
        const t = (i + 1) / (numSamples + 1);
        const distance = t * trailLength;

        const px = state.x + backX * distance;
        const py = state.y + backY * distance;

        const alpha = (1 - t * t) * 0.7 * Math.min(1, speed / 3);
        const radius = cursorRadius * (1 - t * 0.6);

        if (alpha < 0.02 || radius < 0.3) continue;

        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99, 102, 241, ${alpha})`;
        ctx.fill();
      }

      // Draw gradient streak
      const endX = state.x + backX * trailLength;
      const endY = state.y + backY * trailLength;

      const gradient = ctx.createLinearGradient(state.x, state.y, endX, endY);
      const baseAlpha = Math.min(0.8, speed * 0.1);
      gradient.addColorStop(0, `rgba(99, 102, 241, ${baseAlpha})`);
      gradient.addColorStop(0.4, `rgba(99, 102, 241, ${baseAlpha * 0.4})`);
      gradient.addColorStop(1, "rgba(99, 102, 241, 0)");

      const lineWidth = Math.max(3, trailLength * 0.5);
      ctx.beginPath();
      ctx.moveTo(state.x, state.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.stroke();

      // Brighter core
      const coreGradient = ctx.createLinearGradient(state.x, state.y, endX, endY);
      const coreAlpha = Math.min(0.9, speed * 0.12);
      coreGradient.addColorStop(0, `rgba(165, 180, 252, ${coreAlpha})`);
      coreGradient.addColorStop(0.3, `rgba(129, 140, 248, ${coreAlpha * 0.5})`);
      coreGradient.addColorStop(1, "rgba(99, 102, 241, 0)");

      ctx.beginPath();
      ctx.moveTo(state.x, state.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = coreGradient;
      ctx.lineWidth = lineWidth * 0.4;
      ctx.lineCap = "round";
      ctx.stroke();
    };

    // Draw cursor with optional stretch/blur based on speed
    const drawCursor = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      angle: number,
      speed: number
    ) => {
      const baseRadius = 3;
      const ringRadius = 10;

      // Calculate stretch factor based on speed
      // Start stretching at speed > 10, max stretch at speed > 40
      const stretchThreshold = 10;
      const maxStretchSpeed = 40;
      const stretchAmount = speed > stretchThreshold
        ? Math.min(2.5, 1 + ((speed - stretchThreshold) / (maxStretchSpeed - stretchThreshold)) * 1.5)
        : 1;

      if (stretchAmount > 1.05 && speed > stretchThreshold) {
        // Draw stretched cursor (ellipse)
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Stretched inner dot
        ctx.beginPath();
        ctx.ellipse(0, 0, baseRadius * stretchAmount, baseRadius, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99, 102, 241, 1)";
        ctx.fill();

        // Stretched outer ring
        ctx.beginPath();
        ctx.ellipse(0, 0, ringRadius * stretchAmount, ringRadius, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(99, 102, 241, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Add a subtle motion blur behind the cursor
        const blurLength = baseRadius * (stretchAmount - 1) * 3;
        if (blurLength > 1) {
          const blurGradient = ctx.createLinearGradient(-blurLength, 0, 0, 0);
          blurGradient.addColorStop(0, "rgba(99, 102, 241, 0)");
          blurGradient.addColorStop(1, "rgba(99, 102, 241, 0.4)");

          ctx.beginPath();
          ctx.ellipse(-blurLength * 0.5, 0, blurLength * 0.5, baseRadius * 0.8, 0, 0, Math.PI * 2);
          ctx.fillStyle = blurGradient;
          ctx.fill();
        }

        ctx.restore();
      } else {
        // Draw normal cursor (circle)
        ctx.beginPath();
        ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99, 102, 241, 1)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(99, 102, 241, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    // Attach listeners
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("pointerenter", handlePointerEnter);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", resizeCanvas);

    // Start animation
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointerenter", handlePointerEnter);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", resizeCanvas);
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    />
  );
}
