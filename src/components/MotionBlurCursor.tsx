import { useEffect, useRef } from "react";

interface TimestampedPos {
  x: number;
  y: number;
  t: number;
}

export type InterpolationMethod =
  | "off"
  | "lerp"
  | "oneeuro"
  | "spring"
  | "kalman"
  | "timebased";

export type CursorStyle = "dot" | "ring" | "filled";

export interface CursorConfig {
  ellipseMultiplier: number;
  backgroundColor: string;
  interpolation: InterpolationMethod;
  cursorColor: string;
  enableStretch: boolean;
  borderColor: string;
  borderWidth: number;
  clickShrink: number;
  clickSpring: number;
  enableClickAnimation: boolean;
  showOuterRing: boolean;
  showCircle: boolean;
  showBlob: boolean;
  springStiffness: number;
  ellipseThinning: number;
  showHiddenCursor: boolean;
  enableGooeyTrail: boolean;
  trailLength: number;
  trailBlobCount: number;
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
    renderHistory: [] as { x: number; y: number; t: number }[],
    // One Euro Filter state
    oneEuroX: 0,
    oneEuroY: 0,
    oneEuroDx: 0,
    oneEuroDy: 0,
    oneEuroLastTime: 0,
    oneEuroHistory: [] as { x: number; y: number; t: number }[],
    // Spring state
    springX: 0,
    springY: 0,
    springVx: 0,
    springVy: 0,
    springHistory: [] as { x: number; y: number; t: number }[],
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
    kalmanHistory: [] as { x: number; y: number; t: number }[],
    // Time-based smoothing state
    timeBasedX: 0,
    timeBasedY: 0,
    timeBasedLastTime: 0,
    timeBasedHistory: [] as { x: number; y: number; t: number }[],
    // Click animation state
    clickScale: 1,
    clickVelocity: 0,
    // Fade animation state
    opacity: 1,
    targetOpacity: 1,
    fadeScale: 1,
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
      state.targetOpacity = 0;
      state.smoothSpeed = 0;
    };

    const handlePointerEnter = () => {
      state.visible = true;
      state.targetOpacity = 1;
    };

    const handleMouseDown = () => {
      if (!configRef.current.enableClickAnimation) return;
      const clickShrink = configRef.current.clickShrink;
      state.clickScale = 1 - clickShrink;
      state.clickVelocity = 0;
    };

    const handleMouseUp = () => {
      // Spring will animate back in the render loop
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
        // If we're fading out, continue animating
        if (state.opacity > 0.01) {
          state.opacity += (state.targetOpacity - state.opacity) * 0.15;
          ctx.clearRect(0, 0, w, h);
          drawCursor(ctx, state.x, state.y, 0, 0, state.opacity);
        }
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      if (reducedMotionRef.current) {
        drawCursor(ctx, state.x, state.y, 0, 0, state.opacity);
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

      // Update opacity (fade in/out)
      const fadeSpeed = 0.15; // Faster speed for fade
      state.opacity += (state.targetOpacity - state.opacity) * fadeSpeed;
      
      // Scale cursor based on opacity (shrink when fading out, expand when fading in)
      state.fadeScale = state.opacity;
      
      // If opacity is very low and target is 0, stop rendering
      if (state.opacity < 0.01 && state.targetOpacity === 0) {
        state.visible = false;
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Update click spring animation
      if (state.clickScale < 1) {
        const clickSpring = configRef.current.clickSpring;
        const target = 1;
        const force = (target - state.clickScale) * 0.5;
        state.clickVelocity += force;
        state.clickVelocity *= (1 - clickSpring);
        state.clickScale += state.clickVelocity;
        
        // Clamp to prevent overshooting too much
        if (state.clickScale > 1.05) {
          state.clickScale = 1.05;
          state.clickVelocity *= -0.3;
        }
        
        // Stop animation when close enough
        if (Math.abs(state.clickScale - 1) < 0.01 && Math.abs(state.clickVelocity) < 0.01) {
          state.clickScale = 1;
          state.clickVelocity = 0;
        }
      }

      const config = configRef.current;
      const interpolation = config.interpolation;

      if (interpolation === "off") {
        // No interpolation - direct position
        // Record display position to history
        const now = performance.now();
        state.renderHistory.push({ x: state.x, y: state.y, t: now });
        if (state.renderHistory.length > 10) state.renderHistory.shift();
        
        // Calculate speed and angle from display position history
        let displaySpeed = 0;
        let displayAngle = 0;
        if (state.renderHistory.length >= 2) {
          const last = state.renderHistory[state.renderHistory.length - 2];
          const newest = state.renderHistory[state.renderHistory.length - 1];
          const dx = newest.x - last.x;
          const dy = newest.y - last.y;
          const dt = newest.t - last.t;
          if (dt > 0) {
            displaySpeed = (Math.sqrt(dx * dx + dy * dy) / dt) * 16.67;
            if (displaySpeed > 0.5) {
              displayAngle = Math.atan2(dy, dx);
            }
          }
        }
        
        drawCursor(ctx, state.x, state.y, displayAngle, displaySpeed, state.opacity);
      } else if (interpolation === "lerp") {
        // Linear interpolation
        const lerpFactor = 0.35;
        state.renderX += (state.x - state.renderX) * lerpFactor;
        state.renderY += (state.y - state.renderY) * lerpFactor;
        
        // Record render position to history
        const now = performance.now();
        state.renderHistory.push({ x: state.renderX, y: state.renderY, t: now });
        if (state.renderHistory.length > 10) state.renderHistory.shift();
        
        // Calculate render speed and angle
        let renderSpeed = 0;
        let renderAngle = state.angle;
        if (state.renderHistory.length >= 2) {
          const last = state.renderHistory[state.renderHistory.length - 2];
          const newest = state.renderHistory[state.renderHistory.length - 1];
          const dx = newest.x - last.x;
          const dy = newest.y - last.y;
          const dt = newest.t - last.t;
          if (dt > 0) {
            renderSpeed = (Math.sqrt(dx * dx + dy * dy) / dt) * 16.67;
            if (renderSpeed > 0.5) {
              renderAngle = Math.atan2(dy, dx);
            }
          }
        }
        
        drawCursor(ctx, state.renderX, state.renderY, renderAngle, renderSpeed, state.opacity);
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
        
        // Check if pointer has stopped moving (based on time since last update)
        const lastHistoryPoint = history.length > 0 ? history[history.length - 1] : null;
        const timeSinceLastMove = lastHistoryPoint ? now - lastHistoryPoint.t : 0;
        const pointerStopped = timeSinceLastMove > 50; // 50ms threshold
        
        // Always check if One Euro position needs to catch up to actual position
        const distanceToActual = Math.sqrt(
          (state.x - state.oneEuroX) ** 2 + (state.y - state.oneEuroY) ** 2
        );
        
        // When pointer stops or is very close, snap to actual position
        if (pointerStopped || instantSpeed < 0.5 || distanceToActual < 1) {
          state.oneEuroX = state.x;
          state.oneEuroY = state.y;
        }
        
        // Use hidden cursor's speed and direction (instantSpeed and instantAngle)
        // If pointer stopped, use 0 speed
        const displaySpeed = pointerStopped ? 0 : instantSpeed;
        drawCursor(ctx, state.oneEuroX, state.oneEuroY, instantAngle, displaySpeed, state.opacity);
      } else if (interpolation === "spring") {
        // Critically Damped Spring - responsiveness adjustable via config
        const dt = 1 / 60; // Fixed timestep
        const stiffness = config.springStiffness;
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
        
        // Record spring position to history
        const now = performance.now();
        state.springHistory.push({ x: state.springX, y: state.springY, t: now });
        
        // Keep only last 10 positions
        if (state.springHistory.length > 10) {
          state.springHistory.shift();
        }
        
        // Calculate spring speed and angle from spring history
        let springSpeed = 0;
        let springAngle = state.angle;
        
        if (state.springHistory.length >= 2) {
          const last = state.springHistory[state.springHistory.length - 2];
          const newest = state.springHistory[state.springHistory.length - 1];
          const dx = newest.x - last.x;
          const dy = newest.y - last.y;
          const dt = newest.t - last.t;
          if (dt > 0) {
            springSpeed = (Math.sqrt(dx * dx + dy * dy) / dt) * 16.67;
            if (springSpeed > 0.5) {
              springAngle = Math.atan2(dy, dx);
            }
          }
        }
        
        drawCursor(ctx, state.springX, state.springY, springAngle, springSpeed, state.opacity);
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
        
        // Record position to history
        const now = performance.now();
        state.kalmanHistory.push({ x: state.kalmanX, y: state.kalmanY, t: now });
        if (state.kalmanHistory.length > 10) state.kalmanHistory.shift();
        
        // Calculate speed and angle from history
        let filterSpeed = 0;
        let filterAngle = state.angle;
        if (state.kalmanHistory.length >= 2) {
          const last = state.kalmanHistory[state.kalmanHistory.length - 2];
          const newest = state.kalmanHistory[state.kalmanHistory.length - 1];
          const hdx = newest.x - last.x;
          const hdy = newest.y - last.y;
          const hdt = newest.t - last.t;
          if (hdt > 0) {
            filterSpeed = (Math.sqrt(hdx * hdx + hdy * hdy) / hdt) * 16.67;
            if (filterSpeed > 0.5) {
              filterAngle = Math.atan2(hdy, hdx);
            }
          }
        }
        
        drawCursor(ctx, state.kalmanX, state.kalmanY, filterAngle, filterSpeed, state.opacity);
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
        
        // Record position to history
        state.timeBasedHistory.push({ x: state.timeBasedX, y: state.timeBasedY, t: now });
        if (state.timeBasedHistory.length > 10) state.timeBasedHistory.shift();
        
        // Calculate speed and angle from history
        let filterSpeed = 0;
        let filterAngle = state.angle;
        if (state.timeBasedHistory.length >= 2) {
          const last = state.timeBasedHistory[state.timeBasedHistory.length - 2];
          const newest = state.timeBasedHistory[state.timeBasedHistory.length - 1];
          const hdx = newest.x - last.x;
          const hdy = newest.y - last.y;
          const hdt = newest.t - last.t;
          if (hdt > 0) {
            filterSpeed = (Math.sqrt(hdx * hdx + hdy * hdy) / hdt) * 16.67;
            if (filterSpeed > 0.5) {
              filterAngle = Math.atan2(hdy, hdx);
            }
          }
        }
        
        drawCursor(ctx, state.timeBasedX, state.timeBasedY, filterAngle, filterSpeed, state.opacity);
      }

      // Draw hidden cursor if enabled
      if (config.showHiddenCursor) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        
        // Draw a small cross to mark the hidden cursor position
        const crossSize = 5;
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 2;
        
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(state.x - crossSize, state.y);
        ctx.lineTo(state.x + crossSize, state.y);
        ctx.stroke();
        
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(state.x, state.y - crossSize);
        ctx.lineTo(state.x, state.y + crossSize);
        ctx.stroke();
        
        ctx.restore();
      }

      // Draw gooey trail if enabled
      if (config.enableGooeyTrail) {
        initGooeyTrail();
        updateGooeyTrail();
      } else {
        cleanupGooeyTrail();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };



    // DOM-based gooey trail state
    const gooeyElements = {
      container: null as HTMLDivElement | null,
      cursor: null as HTMLDivElement | null,
      nodes: [] as HTMLDivElement[],
      initialized: false,
    };

    const initGooeyTrail = () => {
      if (gooeyElements.initialized) return;
      
      // Create container with SVG filter
      const container = document.createElement('div');
      container.id = 'gooey-cursor-container';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 99998;
        filter: url(#gooey-cursor-filter);
      `;
      
      // Create cursor blob
      const cursorBlob = document.createElement('div');
      cursorBlob.style.cssText = `
        position: absolute;
        width: 20px;
        height: 20px;
        margin-top: -10px;
        margin-left: -10px;
        border-radius: 50%;
        background: ${configRef.current.cursorColor};
        will-change: transform;
        pointer-events: none;
      `;
      container.appendChild(cursorBlob);
      
      // Create trail nodes
      const nodeCount = configRef.current.trailBlobCount;
      for (let i = 0; i < nodeCount; i++) {
        const node = document.createElement('div');
        const progress = (i + 1) / (nodeCount + 1);
        const opacity = 1 - progress * 0.3;
        node.style.cssText = `
          position: absolute;
          width: 18px;
          height: 18px;
          margin-top: -9px;
          margin-left: -9px;
          border-radius: 50%;
          background: ${configRef.current.cursorColor};
          opacity: ${opacity};
          will-change: transform;
          pointer-events: none;
        `;
        container.appendChild(node);
        gooeyElements.nodes.push(node);
      }
      
      document.body.appendChild(container);
      
      gooeyElements.container = container;
      gooeyElements.cursor = cursorBlob;
      gooeyElements.initialized = true;
    };

    const updateGooeyTrail = () => {
      if (!gooeyElements.initialized || !gooeyElements.cursor) return;
      
      const lerpFactor = 0.28;
      const positions = [{ x: state.x, y: state.y }];
      
      // Initialize positions array
      for (let i = 0; i < gooeyElements.nodes.length; i++) {
        const prevPos = positions[i];
        const currentPos = { x: prevPos.x, y: prevPos.y };
        positions.push(currentPos);
      }
      
      // Update cursor position with LERP
      const cursorPos = positions[0];
      cursorPos.x += (state.x - cursorPos.x) * lerpFactor;
      cursorPos.y += (state.y - cursorPos.y) * lerpFactor;
      
      // Update trail nodes with LERP
      for (let i = 1; i < positions.length; i++) {
        const prevPos = positions[i - 1];
        const currentPos = positions[i];
        currentPos.x += (prevPos.x - currentPos.x) * lerpFactor;
        currentPos.y += (prevPos.y - currentPos.y) * lerpFactor;
      }
      
      // Render cursor
      gooeyElements.cursor.style.transform = `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)`;
      
      // Render trail nodes with scaling
      for (let i = 0; i < gooeyElements.nodes.length; i++) {
        const pos = positions[i + 1];
        const scale = 1 - (i + 1) * 0.15;
        gooeyElements.nodes[i].style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${scale})`;
      }
    };

    const cleanupGooeyTrail = () => {
      if (gooeyElements.container) {
        gooeyElements.container.remove();
        gooeyElements.container = null;
        gooeyElements.cursor = null;
        gooeyElements.nodes = [];
        gooeyElements.initialized = false;
      }
    };

    const drawCursor = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      angle: number,
      speed: number,
      alpha: number = 1
    ) => {
      const config = configRef.current;
      
      // Don't draw cursor when gooey trail is enabled
      if (config.enableGooeyTrail) {
        return;
      }
      
      const baseRadius = 3;
      const ringRadius = 10;
      const multiplier = config.ellipseMultiplier;
      const cursorColor = config.cursorColor;
      const enableStretch = config.enableStretch;
      const borderColor = config.borderColor;
      const borderWidth = config.borderWidth;
      const clickScale = state.clickScale;
      const fadeScale = state.fadeScale;
      const showOuterRing = config.showOuterRing;
      const showCircle = config.showCircle;
      const showBlob = config.showBlob;
      const ellipseThinning = config.ellipseThinning;
      
      // Convert hex color to RGB
      const hex = cursorColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      // Convert border color to RGB
      const borderHex = borderColor.replace('#', '');
      const br = parseInt(borderHex.substring(0, 2), 16);
      const bg = parseInt(borderHex.substring(2, 4), 16);
      const bb = parseInt(borderHex.substring(4, 6), 16);

      // Apply fade scale and click scale
      const totalScale = fadeScale * clickScale;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(totalScale, totalScale);
      ctx.translate(-x, -y);

      // Stretch based on speed (only if enabled)
      const stretchThreshold = 8;
      const maxStretchSpeed = 40;
      let stretchAmount = 1;
      if (enableStretch && speed > stretchThreshold) {
        const t = Math.min(1, (speed - stretchThreshold) / (maxStretchSpeed - stretchThreshold));
        stretchAmount = 1 + t * 1.5 * multiplier;
      }

      // Inner dot stretches at 0.5x the outer ring
      const innerStretchAmount = 1 + (stretchAmount - 1) * 0.5;

      if (stretchAmount > 1.05) {
        // Calculate short axis based on speed and thinning slider
        // Speed factor: 0 at threshold, 1 at max speed
        const speedFactor = Math.min(1, (speed - stretchThreshold) / (maxStretchSpeed - stretchThreshold));
        // Short axis: 1.0 (circular) to 0.25 (thin) based on speed and thinning setting
        const shortAxis = 1.0 - speedFactor * (1.0 - 0.25) * ellipseThinning;
        const innerShortAxis = 1.0 - speedFactor * (1.0 - 0.25) * ellipseThinning * 0.5;

        // Draw stretched blob (filled 10px circle)
        if (showBlob) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.scale(stretchAmount, shortAxis);
          ctx.beginPath();
          ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fill();
          
          // Draw blob border
          if (borderWidth > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, ringRadius + borderWidth / 2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${br}, ${bg}, ${bb}, ${alpha})`;
            ctx.lineWidth = borderWidth;
            ctx.stroke();
          }
          
          ctx.restore();
        }

        // Draw stretched circle (small dot)
        if (showCircle) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.scale(innerStretchAmount, innerShortAxis);
          ctx.beginPath();
          ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fill();
          ctx.restore();
        }

        // Draw stretched outer ring with border along movement direction
        if (showOuterRing) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.scale(stretchAmount, shortAxis);
          
          // Draw border ring (outside face)
          if (borderWidth > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, ringRadius + borderWidth / 2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${br}, ${bg}, ${bb}, ${alpha})`;
            ctx.lineWidth = borderWidth;
            ctx.stroke();
          }
          
          // Draw main outer ring
          ctx.beginPath();
          ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.9 * alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // Draw blob (filled 10px circle)
        if (showBlob) {
          ctx.beginPath();
          ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fill();
          
          // Draw blob border
          if (borderWidth > 0) {
            ctx.beginPath();
            ctx.arc(x, y, ringRadius + borderWidth / 2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${br}, ${bg}, ${bb}, ${alpha})`;
            ctx.lineWidth = borderWidth;
            ctx.stroke();
          }
        }

        // Draw circle (small dot)
        if (showCircle) {
          ctx.beginPath();
          ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fill();
        }

        // Draw outer ring
        if (showOuterRing) {
          // Draw border ring (outside face)
          if (borderWidth > 0) {
            ctx.beginPath();
            ctx.arc(x, y, ringRadius + borderWidth / 2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${br}, ${bg}, ${bb}, ${alpha})`;
            ctx.lineWidth = borderWidth;
            ctx.stroke();
          }

          // Draw main outer ring
          ctx.beginPath();
          ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.9 * alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", handlePointerLeave);
    document.documentElement.addEventListener("mouseenter", handlePointerEnter);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", resizeCanvas);

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("mouseleave", handlePointerLeave);
      document.documentElement.removeEventListener("mouseenter", handlePointerEnter);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", resizeCanvas);
      motionQuery.removeEventListener("change", handleMotionChange);
      cleanupGooeyTrail();
    };
  }, []);

  return (
    <>
      <svg
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <defs>
          <filter id="gooey-cursor-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 14 -6"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 99999,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />
    </>
  );
}
