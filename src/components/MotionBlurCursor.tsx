import { useEffect, useRef } from "react";

export default function MotionBlurCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const reducedMotionRef = useRef(false);

  const stateRef = useRef({
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    prevTime: 0,
    vx: 0,
    vy: 0,
    visible: false,
    hasMoved: false,
    smoothSpeed: 0,
    angle: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Failed to get canvas context");
      return;
    }

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
      const newX = e.clientX;
      const newY = e.clientY;

      state.x = newX;
      state.y = newY;
      state.visible = true;

      if (!state.hasMoved) {
        state.prevX = newX;
        state.prevY = newY;
        state.prevTime = now;
        state.hasMoved = true;
        return;
      }

      // Calculate velocity
      const dt = now - state.prevTime;
      if (dt > 0) {
        const dx = newX - state.prevX;
        const dy = newY - state.prevY;
        state.vx = dx / dt;
        state.vy = dy / dt;
      }

      state.prevX = newX;
      state.prevY = newY;
      state.prevTime = now;
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
      }
    };

    // Animation loop
    const animate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      if (!state.visible || !state.hasMoved) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      if (reducedMotionRef.current) {
        drawCursor(ctx, state.x, state.y);
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Calculate speed (convert px/ms to px/frame at 60fps)
      const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy) * 16.67;

      // Smooth speed
      state.smoothSpeed = state.smoothSpeed * 0.85 + speed * 0.15;

      // Update angle
      if (speed > 0.5) {
        state.angle = Math.atan2(state.vy, state.vx);
      }

      // Decay velocity
      state.vx *= 0.92;
      state.vy *= 0.92;

      // Draw trail
      if (state.smoothSpeed > 0.5) {
        drawDirectionalTrail(ctx, state);
      }

      // Draw cursor
      drawCursor(ctx, state.x, state.y);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    // Draw directional trail
    const drawDirectionalTrail = (
      ctx: CanvasRenderingContext2D,
      state: typeof stateRef.current
    ) => {
      const speed = state.smoothSpeed;
      const angle = state.angle;

      // Trail length based on speed
      const trailLength = Math.min(100, speed * 4);

      if (trailLength < 2) return;

      const numSamples = Math.min(25, Math.max(5, Math.floor(trailLength / 3)));

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
        const radius = 8 * (1 - t * 0.6);

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

      ctx.beginPath();
      ctx.moveTo(state.x, state.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 14;
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
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.stroke();
    };

    // Draw cursor
    const drawCursor = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      // Inner dot
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(99, 102, 241, 1)";
      ctx.fill();

      // Outer ring
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(99, 102, 241, 0.9)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    };

    // Attach listeners
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("pointerenter", handlePointerEnter);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", resizeCanvas);

    console.log("Motion blur cursor initialized");

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
