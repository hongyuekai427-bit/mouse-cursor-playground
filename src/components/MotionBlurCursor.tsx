import { useEffect, useRef } from "react";

interface TimestampedPos {
  x: number;
  y: number;
  t: number;
}

export interface CursorConfig {
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
    // Outer ring position with delay
    ringX: 0,
    ringY: 0,
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

      // Initialize ring position on first move
      if (state.ringX === 0 && state.ringY === 0) {
        state.ringX = e.clientX;
        state.ringY = e.clientY;
      }

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
        state.history.length = 0;
      }
    };

    const calculateWindowedVelocity = () => {
      const h = state.history;
      if (h.length < 2) return { vx: 0, vy: 0 };

      const oldest = h[0];
      const newest = h[h.length - 1];

      const dt = newest.t - oldest.t;
      if (dt < 0.5) return { vx: 0, vy: 0 };

      const vx = (newest.x - oldest.x) / dt;
      const vy = (newest.y - oldest.y) / dt;

      return { vx, vy };
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
        drawCursor(ctx, state.x, state.y, 0, 0);
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const { vx: rawVx, vy: rawVy } = calculateWindowedVelocity();

      state.vx = state.vx * 0.7 + rawVx * 0.3;
      state.vy = state.vy * 0.7 + rawVy * 0.3;

      // Calculate instantaneous speed from last to newest position
      const history = state.history;
      let instantSpeed = 0;
      if (history.length >= 2) {
        const last = history[history.length - 2];
        const newest = history[history.length - 1];
        const dx = newest.x - last.x;
        const dy = newest.y - last.y;
        const dt = newest.t - last.t;
        if (dt > 0) {
          // Speed in px/frame (at 60fps)
          instantSpeed = (Math.sqrt(dx * dx + dy * dy) / dt) * 16.67;
        }
      }

      // Use instantaneous speed directly for trail length
      state.smoothSpeed = instantSpeed;

      // Smoothed velocity for direction
      const smoothVelSpeed = Math.sqrt(state.vx * state.vx + state.vy * state.vy) * 16.67;

      if (smoothVelSpeed > 0.5) {
        state.angle = Math.atan2(state.vy, state.vx);
      }

      // Update outer ring position with 2ms delay (lerp factor ~0.75 at 60fps)
      const lerpFactor = 0.75;
      state.ringX += (state.x - state.ringX) * lerpFactor;
      state.ringY += (state.y - state.ringY) * lerpFactor;

      drawCursor(ctx, state.x, state.y, state.angle, instantSpeed);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    // Draw a curved cursor as a thick curved line
    const drawCurvedDot = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      angle: number,
      radiusX: number,
      radiusY: number,
      curveAmount: number,
      filled: boolean
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Simple curved line (like a banana/comma)
      const length = Math.min(radiusX, 10);
      const curve = curveAmount * 5;
      const thickness = filled ? radiusY * 2 : radiusY * 2.5;
      
      ctx.beginPath();
      ctx.moveTo(-length, curve);
      ctx.quadraticCurveTo(0, -curve, length, curve);
      
      ctx.strokeStyle = filled ? "rgba(99, 102, 241, 1)" : "rgba(99, 102, 241, 0.9)";
      ctx.lineWidth = thickness;
      ctx.lineCap = "round";
      ctx.stroke();

      ctx.restore();
    };

    const drawCursor = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      angle: number,
      speed: number
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
      
      // Inner dot stretches at 0.5x the outer ring
      const innerStretchAmount = 1 + (stretchAmount - 1) * 0.5;

      // Calculate bend angle using 2-4 cache window to detect turning
      let bendAngle = 0;
      if (h.length >= 2 && stretchAmount > 1.05) {
        // Use 2-4 recent positions to detect curvature
        const windowSize = Math.min(4, h.length);
        const recentPoints = h.slice(-windowSize);
        
        // Calculate total angular change across the window
        let totalAngleChange = 0;
        let totalDistance = 0;
        
        for (let i = 1; i < recentPoints.length; i++) {
          const prev = recentPoints[i - 1];
          const curr = recentPoints[i];
          
          const dx = curr.x - prev.x;
          const dy = curr.y - prev.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (i > 1 && dist > 0.5) {
            const prevDx = recentPoints[i - 1].x - recentPoints[i - 2].x;
            const prevDy = recentPoints[i - 1].y - recentPoints[i - 2].y;
            const prevDist = Math.sqrt(prevDx * prevDx + prevDy * prevDy);
            
            if (prevDist > 0.5) {
              // Calculate angle between consecutive segments
              const angle1 = Math.atan2(prevDy, prevDx);
              const angle2 = Math.atan2(dy, dx);
              let angleDiff = angle2 - angle1;
              
              // Normalize to -PI to PI
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              
              totalAngleChange += angleDiff;
            }
          }
          
          totalDistance += dist;
        }
        
        // Apply bend if there's significant turning
        if (Math.abs(totalAngleChange) > 0.1 && totalDistance > 1) {
          const bendStrength = Math.min(1, Math.abs(totalAngleChange) / 1.5) * 
                              Math.min(1, (stretchAmount - 1) / 1.5);
          bendAngle = totalAngleChange * bendStrength * 0.5;
        }
      }

      // Outer ring position with delay
      const ringX = state.ringX;
      const ringY = state.ringY;

      if (stretchAmount > 1.05) {
        // Draw curved inner dot
        const innerCurveAmount = bendAngle * 0.5;
        drawCurvedDot(ctx, x, y, angle, baseRadius * innerStretchAmount, baseRadius, innerCurveAmount, true);

        // Draw curved outer ring with delay
        const ringCurveAmount = bendAngle;
        drawCurvedDot(ctx, ringX, ringY, angle, ringRadius * stretchAmount, ringRadius, ringCurveAmount, false);
      } else {
        // Draw inner dot at exact cursor position
        ctx.beginPath();
        ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99, 102, 241, 1)";
        ctx.fill();

        // Draw outer ring with delay
        ctx.beginPath();
        ctx.arc(ringX, ringY, ringRadius, 0, Math.PI * 2);
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
