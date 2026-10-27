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
    smoothSpeed: 0,
    angle: 0,
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
      state.smoothSpeed = 0;
    };

    const handlePointerEnter = () => {
      state.visible = true;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        state.smoothSpeed = 0;
        state.history.length = 0;
      }
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



      // Calculate instantaneous speed and direction from last to newest position
      const history = state.history;
      let instantSpeed = 0;
      let instantAngle = state.angle;
      
      if (history.length >= 2) {
        const last = history[history.length - 2];
        const newest = history[history.length - 1];
        const dx = newest.x - last.x;
        const dy = newest.y - last.y;
        const dt = newest.t - last.t;
        if (dt > 0) {
          // Speed in px/frame (at 60fps)
          instantSpeed = (Math.sqrt(dx * dx + dy * dy) / dt) * 16.67;
          // Direction of movement
          if (instantSpeed > 0.5) {
            instantAngle = Math.atan2(dy, dx);
          }
        }
      }

      // Use instantaneous speed directly
      state.smoothSpeed = instantSpeed;
      state.angle = instantAngle;

      drawCursor(ctx, state.x, state.y, state.angle, instantSpeed);

      animFrameRef.current = requestAnimationFrame(animate);
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

      if (stretchAmount > 1.05) {
        // Draw stretched inner dot (0.5x stretch) along movement direction, thinner when stretched
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(innerStretchAmount, 1 / Math.sqrt(innerStretchAmount));
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99, 102, 241, 1)";
        ctx.fill();
        ctx.restore();

        // Draw stretched outer ring along movement direction, thinner when stretched
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(stretchAmount, 1 / Math.sqrt(stretchAmount));
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(99, 102, 241, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      } else {
        // Draw inner dot at exact cursor position
        ctx.beginPath();
        ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99, 102, 241, 1)";
        ctx.fill();

        // Draw outer ring synced with dot
        ctx.beginPath();
        ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(99, 102, 241, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", handlePointerLeave);
    document.documentElement.addEventListener("mouseenter", handlePointerEnter);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", resizeCanvas);

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("mouseleave", handlePointerLeave);
      document.documentElement.removeEventListener("mouseenter", handlePointerEnter);
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
