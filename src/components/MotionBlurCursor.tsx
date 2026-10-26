import { useEffect, useRef } from "react";

interface TimestampedPos {
  x: number;
  y: number;
  t: number;
}

export interface CursorConfig {
  trailMultiplier: number;
  ellipseMultiplier: number;
  backgroundColor: string;
}

interface MotionBlurCursorProps {
  config: CursorConfig;
}

export default function MotionBlurCursor({ config }: MotionBlurCursorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const reducedMotionRef = useRef(false);
  const configRef = useRef(config);

  const stateRef = useRef({
    x: 0,
    y: 0,
    visible: false,
    hasMoved: false,
    history: [] as TimestampedPos[],
    vx: 0,
    vy: 0,
    smoothSpeed: 0,
    angle: 0,
    smoothCurvature: 0,
  });

  // Keep config ref in sync
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = stateRef.current;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = motionQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    motionQuery.addEventListener("change", handleMotionChange);

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      state.x = e.clientX;
      state.y = e.clientY;
      state.visible = true;
      state.hasMoved = true;

      state.history.push({ x: e.clientX, y: e.clientY, t: now });

      // Keep only last 3 positions
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
        state.smoothCurvature = 0;
        state.history.length = 0;
      }
    };

    const calculateWindowedVelocity = () => {
      const h = state.history;
      if (h.length < 2) return { vx: 0, vy: 0, curvature: 0 };

      const oldest = h[0];
      const newest = h[h.length - 1];

      const dt = newest.t - oldest.t;
      if (dt < 0.5) return { vx: 0, vy: 0, curvature: 0 };

      const vx = (newest.x - oldest.x) / dt;
      const vy = (newest.y - oldest.y) / dt;

      let curvature = 0;
      if (h.length === 3) {
        const p0 = h[0];
        const p1 = h[1];
        const p2 = h[2];

        const v1x = p1.x - p0.x;
        const v1y = p1.y - p0.y;
        const v2x = p2.x - p1.x;
        const v2y = p2.y - p1.y;

        const cross = v1x * v2y - v1y * v2x;
        const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

        if (mag1 > 0.1 && mag2 > 0.1) {
          curvature = cross / (mag1 * mag2);
        }
      }

      return { vx, vy, curvature };
    };

    const animate = () => {
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

      const { vx: rawVx, vy: rawVy, curvature } = calculateWindowedVelocity();

      state.vx = state.vx * 0.7 + rawVx * 0.3;
      state.vy = state.vy * 0.7 + rawVy * 0.3;
      state.smoothCurvature = state.smoothCurvature * 0.6 + curvature * 0.4;

      // Speed in px/frame (at 60fps)
      const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy) * 16.67;

      state.smoothSpeed = state.smoothSpeed * 0.82 + speed * 0.18;

      if (speed > 0.5) {
        state.angle = Math.atan2(state.vy, state.vx);
      }

      // Draw trail
      if (state.smoothSpeed > 0.1) {
        drawDirectionalTrail(ctx, state, configRef.current);
      }

      drawCursor(ctx, state.x, state.y, state.angle, state.smoothSpeed, state.smoothCurvature);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    const drawDirectionalTrail = (
      ctx: CanvasRenderingContext2D,
      state: typeof stateRef.current,
      config: CursorConfig
    ) => {
      const speed = state.smoothSpeed;
      const multiplier = config.trailMultiplier;
      const h = state.history;

      const cursorRadius = 3;
      // Trail length is purely speed-based
      const trailLength = Math.min(120, speed * multiplier);

      if (trailLength < 2) return;

      // Use the 2nd cache position as the curve target
      // The trail bends toward the 2nd most recent position
      let targetX = state.x;
      let targetY = state.y;
      if (h.length >= 2) {
        // 2nd cache is the middle/second-to-last position
        const secondCache = h.length >= 3 ? h[h.length - 2] : h[0];
        targetX = secondCache.x;
        targetY = secondCache.y;
      }

      // Calculate direction from current to 2nd cache (this is where trail should bend toward)
      const toTargetX = targetX - state.x;
      const toTargetY = targetY - state.y;
      const toTargetDist = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);

      // If we have a valid target, bend the trail toward it
      let bendX = 0;
      let bendY = 0;
      if (toTargetDist > 0.5) {
        // Normalize and scale the bend
        const bendStrength = Math.min(1, toTargetDist / 30);
        bendX = (toTargetX / toTargetDist) * bendStrength;
        bendY = (toTargetY / toTargetDist) * bendStrength;
      }

      const numSamples = Math.min(18, Math.max(4, Math.floor(trailLength / 3)));

      // Base direction: opposite of velocity (trail extends behind)
      const angle = state.angle;
      const backX = -Math.cos(angle);
      const backY = -Math.sin(angle);

      // Draw fading circles along curved path that bends toward 2nd cache
      for (let i = 0; i < numSamples; i++) {
        const t = (i + 1) / (numSamples + 1);
        const distance = t * trailLength;

        // Blend between straight-back direction and bend toward 2nd cache
        // The bend increases along the trail (more curve further back)
        const bendFactor = t * t; // Quadratic bend
        const px = state.x + backX * distance + bendX * distance * bendFactor * 0.5;
        const py = state.y + backY * distance + bendY * distance * bendFactor * 0.5;

        const alpha = (1 - t * t) * 0.7 * Math.min(1, speed / 3);
        const radius = cursorRadius * (1 - t * 0.6);

        if (alpha < 0.02 || radius < 0.3) continue;

        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99, 102, 241, ${alpha})`;
        ctx.fill();
      }

      // Draw curved gradient streak using 2nd cache as control point
      const endDistance = trailLength;
      const endX = state.x + backX * endDistance + bendX * endDistance * 0.5;
      const endY = state.y + backY * endDistance + bendY * endDistance * 0.5;

      // Control point: blend between straight line and 2nd cache position
      const cpT = 0.4; // Control point at 40% along trail
      const cpDistance = cpT * trailLength;
      const cpBendFactor = cpT * cpT;
      const cpX = state.x + backX * cpDistance + bendX * cpDistance * cpBendFactor * 0.5;
      const cpY = state.y + backY * cpDistance + bendY * cpDistance * cpBendFactor * 0.5;

      const gradient = ctx.createLinearGradient(state.x, state.y, endX, endY);
      const baseAlpha = Math.min(0.8, speed * 0.08);
      gradient.addColorStop(0, `rgba(99, 102, 241, ${baseAlpha})`);
      gradient.addColorStop(0.4, `rgba(99, 102, 241, ${baseAlpha * 0.4})`);
      gradient.addColorStop(1, "rgba(99, 102, 241, 0)");

      const lineWidth = Math.max(3, trailLength * 0.4);
      ctx.beginPath();
      ctx.moveTo(state.x, state.y);
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.stroke();

      const coreGradient = ctx.createLinearGradient(state.x, state.y, endX, endY);
      const coreAlpha = Math.min(0.9, speed * 0.1);
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
      const config = configRef.current;
      const multiplier = config.ellipseMultiplier;
      const h = state.history;

      // Stretch based on speed
      const stretchThreshold = 8;
      const maxStretchSpeed = 40;
      let stretchAmount = 1;
      if (speed > stretchThreshold) {
        const t = Math.min(1, (speed - stretchThreshold) / (maxStretchSpeed - stretchThreshold));
        stretchAmount = 1 + t * 1.5 * multiplier;
      }

      // Calculate bend angle toward 2nd cache position
      let bendAngle = 0;
      if (h.length >= 2 && stretchAmount > 1.05) {
        const secondCache = h.length >= 3 ? h[h.length - 2] : h[0];
        const dx = secondCache.x - x;
        const dy = secondCache.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.5) {
          // Angle from current to 2nd cache
          const targetAngle = Math.atan2(dy, dx);
          // Calculate relative angle difference
          let angleDiff = targetAngle - angle;
          // Normalize to -PI to PI
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          // Bend strength based on distance and stretch
          const bendStrength = Math.min(1, dist / 20) * Math.min(1, (stretchAmount - 1) / 1.5);
          bendAngle = angleDiff * bendStrength * 0.4;
        }
      }

      if (stretchAmount > 1.05) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + bendAngle);

        const skewX = curvature * 0.3 * (stretchAmount - 1);
        ctx.transform(1, 0, skewX, 1, 0, 0);

        ctx.beginPath();
        ctx.ellipse(0, 0, baseRadius * stretchAmount, baseRadius, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99, 102, 241, 1)";
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(0, 0, ringRadius * stretchAmount, ringRadius, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(99, 102, 241, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

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

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("pointerenter", handlePointerEnter);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", resizeCanvas);

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
