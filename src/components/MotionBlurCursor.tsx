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
    // Position history buffer (max 3 points)
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
    // Smoothed curvature (-1 to 1, positive = turning left, negative = turning right)
    smoothCurvature: 0,
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

      // Keep only last 3 positions (max window for direction calculation)
      while (state.history.length > 3) {
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
        state.smoothCurvature = 0;
        state.history.length = 0;
      }
    };

    // Calculate velocity from 3-point window of history
    const calculateWindowedVelocity = () => {
      const h = state.history;
      if (h.length < 2) return { vx: 0, vy: 0, curvature: 0 };

      // Use the oldest and newest points in the 3-point window
      const oldest = h[0];
      const newest = h[h.length - 1];

      const dt = newest.t - oldest.t;
      if (dt < 0.5) return { vx: 0, vy: 0, curvature: 0 };

      const vx = (newest.x - oldest.x) / dt;
      const vy = (newest.y - oldest.y) / dt;

      // Calculate curvature from the 3 points (if we have all 3)
      let curvature = 0;
      if (h.length === 3) {
        const p0 = h[0];
        const p1 = h[1];
        const p2 = h[2];

        // Vectors between consecutive points
        const v1x = p1.x - p0.x;
        const v1y = p1.y - p0.y;
        const v2x = p2.x - p1.x;
        const v2y = p2.y - p1.y;

        // Cross product gives us the turning amount
        const cross = v1x * v2y - v1y * v2x;
        const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

        if (mag1 > 0.1 && mag2 > 0.1) {
          // Normalize curvature: cross / (mag1 * mag2) gives sin(angle)
          curvature = cross / (mag1 * mag2);
        }
      }

      return { vx, vy, curvature };
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
        drawCursor(ctx, state.x, state.y, 0, 0, 0);
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Calculate velocity from 3-point window
      const { vx: rawVx, vy: rawVy, curvature } = calculateWindowedVelocity();

      // Smooth velocity
      state.vx = state.vx * 0.7 + rawVx * 0.3;
      state.vy = state.vy * 0.7 + rawVy * 0.3;

      // Smooth curvature
      state.smoothCurvature = state.smoothCurvature * 0.6 + curvature * 0.4;

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

      // Draw cursor (with stretch and curvature when moving fast)
      drawCursor(ctx, state.x, state.y, state.angle, state.smoothSpeed, state.smoothCurvature);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    // Draw directional trail with curvature
    const drawDirectionalTrail = (
      ctx: CanvasRenderingContext2D,
      state: typeof stateRef.current
    ) => {
      const speed = state.smoothSpeed;
      const angle = state.angle;
      const curvature = state.smoothCurvature;

      // Trail length based on distance traveled
      const cursorRadius = 3;
      const minTrailLength = cursorRadius * 2;
      const maxTrailLength = cursorRadius * 10;
      const trailLength = Math.min(maxTrailLength, Math.max(minTrailLength, state.distanceTraveled * 0.5));

      const numSamples = Math.min(15, Math.max(5, Math.floor(trailLength / 2)));

      // Direction behind cursor
      const backX = -Math.cos(angle);
      const backY = -Math.sin(angle);

      // Perpendicular direction for curvature offset
      const perpX = -backY; // 90 degrees rotated
      const perpY = backX;

      // Draw fading circles along a curved path
      for (let i = 0; i < numSamples; i++) {
        const t = (i + 1) / (numSamples + 1);
        const distance = t * trailLength;

        // Curvature offset increases quadratically along the trail
        const curveOffset = curvature * distance * distance * 0.003;

        const px = state.x + backX * distance + perpX * curveOffset;
        const py = state.y + backY * distance + perpY * curveOffset;

        const alpha = (1 - t * t) * 0.7 * Math.min(1, speed / 3);
        const radius = cursorRadius * (1 - t * 0.6);

        if (alpha < 0.02 || radius < 0.3) continue;

        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99, 102, 241, ${alpha})`;
        ctx.fill();
      }

      // Draw curved gradient streak using quadratic bezier
      const endDistance = trailLength;
      const endCurveOffset = curvature * endDistance * endDistance * 0.003;
      const endX = state.x + backX * endDistance + perpX * endCurveOffset;
      const endY = state.y + backY * endDistance + perpY * endCurveOffset;

      // Control point at middle of trail with curvature
      const midT = 0.5;
      const midDistance = midT * trailLength;
      const midCurveOffset = curvature * midDistance * midDistance * 0.003;
      const cpX = state.x + backX * midDistance + perpX * midCurveOffset;
      const cpY = state.y + backY * midDistance + perpY * midCurveOffset;

      const gradient = ctx.createLinearGradient(state.x, state.y, endX, endY);
      const baseAlpha = Math.min(0.8, speed * 0.1);
      gradient.addColorStop(0, `rgba(99, 102, 241, ${baseAlpha})`);
      gradient.addColorStop(0.4, `rgba(99, 102, 241, ${baseAlpha * 0.4})`);
      gradient.addColorStop(1, "rgba(99, 102, 241, 0)");

      const lineWidth = Math.max(3, trailLength * 0.5);
      ctx.beginPath();
      ctx.moveTo(state.x, state.y);
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
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
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      ctx.strokeStyle = coreGradient;
      ctx.lineWidth = lineWidth * 0.4;
      ctx.lineCap = "round";
      ctx.stroke();
    };

    // Draw cursor with optional stretch/blur based on speed and curvature
    const drawCursor = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      angle: number,
      speed: number,
      curvature: number
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
        // Draw stretched cursor (ellipse) with curvature skew
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Apply skew based on curvature (makes ellipse lean into the turn)
        const skewX = curvature * 0.3 * (stretchAmount - 1);
        ctx.transform(1, 0, skewX, 1, 0, 0);

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
