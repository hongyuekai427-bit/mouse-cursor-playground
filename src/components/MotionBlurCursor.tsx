import { useEffect, useRef } from "react";

interface TimestampedPos {
  x: number;
  y: number;
  t: number;
}

export type InterpolationMethod =
  | "off"
  | "lerp"
  | "spline"
  | "oneeuro"
  | "spring"
  | "hermite"
  | "kalman"
  | "timebased";

export interface CursorConfig {
  ellipseMultiplier: number;
  backgroundColor: string;
  interpolation: InterpolationMethod;
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
    // Interpolated render position
    renderX: 0,
    renderY: 0,
    // One Euro Filter state
    oneEuroX: 0,
    oneEuroY: 0,
    oneEuroDx: 0,
    oneEuroDy: 0,
    oneEuroLastTime: 0,
    // Spring state
    springX: 0,
    springY: 0,
    springVx: 0,
    springVy: 0,
    // Hermite state
    hermiteX: 0,
    hermiteY: 0,
    hermiteTangentX: 0,
    hermiteTangentY: 0,
    // Predictive state
    predictiveX: 0,
    predictiveY: 0,
    predictiveVx: 0,
    predictiveVy: 0,
    // Kalman state
    kalmanX: 0,
    kalmanY: 0,
    kalmanVx: 0,
    kalmanVy: 0,
    kalmanPx: 1,
    kalmanPy: 1,
    // Time-based smoothing state
    timeBasedX: 0,
    timeBasedY: 0,
    timeBasedLastTime: 0,
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

      // Initialize all filter states on first move
      if (state.renderX === 0 && state.renderY === 0) {
        state.renderX = e.clientX;
        state.renderY = e.clientY;
        state.oneEuroX = e.clientX;
        state.oneEuroY = e.clientY;
        state.oneEuroLastTime = now;
        state.springX = e.clientX;
        state.springY = e.clientY;
        state.hermiteX = e.clientX;
        state.hermiteY = e.clientY;
        state.predictiveX = e.clientX;
        state.predictiveY = e.clientY;
        state.kalmanX = e.clientX;
        state.kalmanY = e.clientY;
        state.timeBasedX = e.clientX;
        state.timeBasedY = e.clientY;
        state.timeBasedLastTime = now;
      }

      state.history.push({ x: e.clientX, y: e.clientY, t: now });

      // Keep last 16 positions for interpolation methods
      while (state.history.length > 16) {
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

      const config = configRef.current;
      const interpolation = config.interpolation;

      if (interpolation === "off") {
        // No interpolation - direct position
        drawCursor(ctx, state.x, state.y, state.angle, instantSpeed);
      } else if (interpolation === "lerp") {
        // Linear interpolation
        const lerpFactor = 0.35;
        state.renderX += (state.x - state.renderX) * lerpFactor;
        state.renderY += (state.y - state.renderY) * lerpFactor;
        drawCursor(ctx, state.renderX, state.renderY, state.angle, instantSpeed);
      } else if (interpolation === "spline") {
        // Spline interpolation using Catmull-Rom
        if (state.history.length >= 4) {
          const points = state.history.slice(-4);
          const t = 0.85; // Near end point for responsiveness
          const p0 = points[0];
          const p1 = points[1];
          const p2 = points[2];
          const p3 = points[3];
          
          // Catmull-Rom spline calculation
          const t2 = t * t;
          const t3 = t2 * t;
          
          const x = 0.5 * ((2 * p1.x) +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
          
          const y = 0.5 * ((2 * p1.y) +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
          
          state.renderX = x;
          state.renderY = y;
        } else {
          state.renderX = state.x;
          state.renderY = state.y;
        }
        drawCursor(ctx, state.renderX, state.renderY, state.angle, instantSpeed);
      } else if (interpolation === "oneeuro") {
        // One Euro Filter - adaptive smoothing
        const now = performance.now();
        const dt = Math.max(0.001, (now - state.oneEuroLastTime) / 1000);
        state.oneEuroLastTime = now;
        
        // Calculate derivative
        const dx = (state.x - state.oneEuroX) / dt;
        const dy = (state.y - state.oneEuroY) / dt;
        
        // Adaptive cutoff frequency based on speed
        const minCutoff = 1.0;
        const beta = 0.007;
        const speed = Math.sqrt(dx * dx + dy * dy);
        const cutoff = minCutoff + beta * speed;
        
        // Smoothing factor
        const tau = 1.0 / (2 * Math.PI * cutoff);
        const alpha = 1.0 / (1.0 + tau / dt);
        
        // Filter position
        state.oneEuroX += alpha * (state.x - state.oneEuroX);
        state.oneEuroY += alpha * (state.y - state.oneEuroY);
        
        // Filter derivative
        state.oneEuroDx += alpha * (dx - state.oneEuroDx);
        state.oneEuroDy += alpha * (dy - state.oneEuroDy);
        
        drawCursor(ctx, state.oneEuroX, state.oneEuroY, state.angle, instantSpeed);
      } else if (interpolation === "spring") {
        // Critically Damped Spring - More Responsive
        const dt = 1 / 60; // Fixed timestep
        const stiffness = 900; // Increased from 180 for faster response
        const damping = 2 * Math.sqrt(stiffness); // Critical damping
        
        // Run multiple sub-steps for stability at high stiffness
        const subSteps = 4;
        const subDt = dt / subSteps;
        
        for (let i = 0; i < subSteps; i++) {
          // Spring force
          const forceX = (state.x - state.springX) * stiffness;
          const forceY = (state.y - state.springY) * stiffness;
          
          // Update velocity with damping
          state.springVx += (forceX - state.springVx * damping) * subDt;
          state.springVy += (forceY - state.springVy * damping) * subDt;
          
          // Update position
          state.springX += state.springVx * subDt;
          state.springY += state.springVy * subDt;
        }
        
        drawCursor(ctx, state.springX, state.springY, state.angle, instantSpeed);
      } else if (interpolation === "hermite") {
        // Hermite Interpolation
        const lerpFactor = 0.15;
        
        // Update tangent (velocity)
        const targetTangentX = (state.x - state.hermiteX) * 60;
        const targetTangentY = (state.y - state.hermiteY) * 60;
        state.hermiteTangentX += (targetTangentX - state.hermiteTangentX) * lerpFactor;
        state.hermiteTangentY += (targetTangentY - state.hermiteTangentY) * lerpFactor;
        
        // Hermite basis functions
        const t = 0.2;
        const h00 = 2 * t * t * t - 3 * t * t + 1;
        const h10 = t * t * t - 2 * t * t + t;
        const h01 = -2 * t * t * t + 3 * t * t;
        const h11 = t * t * t - t * t;
        
        // Interpolate position
        state.hermiteX = h00 * state.hermiteX + h10 * state.hermiteTangentX + 
                         h01 * state.x + h11 * state.hermiteTangentX;
        state.hermiteY = h00 * state.hermiteY + h10 * state.hermiteTangentY + 
                         h01 * state.y + h11 * state.hermiteTangentY;
        
        drawCursor(ctx, state.hermiteX, state.hermiteY, state.angle, instantSpeed);
      } else if (interpolation === "kalman") {
        // Kalman Filter
        const processNoise = 0.1;
        const measurementNoise = 0.5;
        
        // Predict step
        const predictedX = state.kalmanX + state.kalmanVx / 60;
        const predictedY = state.kalmanY + state.kalmanVy / 60;
        const predictedPx = state.kalmanPx + processNoise;
        const predictedPy = state.kalmanPy + processNoise;
        
        // Update step
        const kalmanGainX = predictedPx / (predictedPx + measurementNoise);
        const kalmanGainY = predictedPy / (predictedPy + measurementNoise);
        
        state.kalmanX = predictedX + kalmanGainX * (state.x - predictedX);
        state.kalmanY = predictedY + kalmanGainY * (state.y - predictedY);
        
        state.kalmanVx = (state.kalmanX - predictedX) * 60;
        state.kalmanVy = (state.kalmanY - predictedY) * 60;
        
        state.kalmanPx = (1 - kalmanGainX) * predictedPx;
        state.kalmanPy = (1 - kalmanGainY) * predictedPy;
        
        drawCursor(ctx, state.kalmanX, state.kalmanY, state.angle, instantSpeed);
      } else if (interpolation === "timebased") {
        // Time-Based Exponential Smoothing
        const now = performance.now();
        const dt = Math.max(0.001, (now - state.timeBasedLastTime) / 1000);
        state.timeBasedLastTime = now;
        
        // Time constant (smaller = faster response)
        const tau = 0.03;
        const alpha = 1 - Math.exp(-dt / tau);
        
        state.timeBasedX += alpha * (state.x - state.timeBasedX);
        state.timeBasedY += alpha * (state.y - state.timeBasedY);
        
        drawCursor(ctx, state.timeBasedX, state.timeBasedY, state.angle, instantSpeed);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };



    const drawCursor = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      angle: number,
      speed: number,
      alpha: number = 1
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
        // Draw stretched inner dot (0.5x stretch) along movement direction
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(innerStretchAmount, 1 / Math.sqrt(innerStretchAmount));
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99, 102, 241, ${alpha})`;
        ctx.fill();
        ctx.restore();

        // Draw stretched outer ring along movement direction
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(stretchAmount, 1 / Math.sqrt(stretchAmount));
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(99, 102, 241, ${0.9 * alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      } else {
        // Draw inner dot at exact cursor position
        ctx.beginPath();
        ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99, 102, 241, ${alpha})`;
        ctx.fill();

        // Draw outer ring synced with dot
        ctx.beginPath();
        ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(99, 102, 241, ${0.9 * alpha})`;
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
