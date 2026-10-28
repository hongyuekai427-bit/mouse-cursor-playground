import { useState, useRef, useEffect } from "react";
import MotionBlurCursor, { CursorConfig } from "./components/MotionBlurCursor";

export default function App() {
  const [config, setConfig] = useState<CursorConfig>({
    ellipseMultiplier: 1,
    backgroundColor: "#000000",
    interpolation: "off",
    cursorColor: "#6366f1",
    enableStretch: true,
    borderColor: "#000000",
    borderWidth: 1.5,
    clickShrink: 0.3,
    clickSpring: 0.15,
    enableClickAnimation: true,
    showOuterRing: true,
    showCircle: true,
    showBlob: false,
    springStiffness: 900,
    ellipseThinning: 0.5,
    showHiddenCursor: false,
    enableGooeyTrail: false,
    trailLength: 0.75,
    trailBlobCount: 8,
  });
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    if (expanded) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [expanded]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: config.backgroundColor,
        cursor: "none",
      }}
    >
      <MotionBlurCursor config={config} />

      {/* Expandable top bar */}
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10000,
          pointerEvents: "auto",
        }}
      >
        {/* Collapsed tab */}
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 16px",
            backgroundColor: expanded ? "rgba(20, 20, 20, 0.95)" : "rgba(20, 20, 20, 0.7)",
            borderBottomLeftRadius: "8px",
            borderBottomRightRadius: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "background-color 0.2s",
            border: "1px solid rgba(255,255,255,0.1)",
            borderTop: "none",
          }}
        >
          <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace", letterSpacing: "0.05em" }}>
            {expanded ? "▲ HIDE" : "▼ CONTROLS"}
          </span>
        </div>

        {/* Expanded panel */}
        {expanded && (
          <div
            style={{
              position: "absolute",
              top: "32px",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "rgba(15, 15, 15, 0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "20px 24px",
              minWidth: "320px",
              backdropFilter: "blur(12px)",
              maxHeight: "calc(100vh - 50px)",
              overflowY: "auto",
            }}
          >
            <SliderRow
              label="Ellipse Stretch"
              value={config.ellipseMultiplier}
              min={0.1}
              max={4}
              step={0.1}
              onChange={(v) => setConfig({ ...config, ellipseMultiplier: v })}
            />
            <div style={{ marginTop: "16px" }}>
              <div style={{ marginBottom: "8px" }}>
                <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                  INTERPOLATION
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                {(["off", "lerp", "oneeuro", "spring", "kalman", "timebased"] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setConfig({ ...config, interpolation: method })}
                    style={{
                      padding: "8px 6px",
                      borderRadius: "6px",
                      backgroundColor: config.interpolation === method ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.05)",
                      border: config.interpolation === method ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
                      color: config.interpolation === method ? "#a5b4fc" : "#9ca3af",
                      fontSize: "10px",
                      fontFamily: "monospace",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textTransform: "uppercase",
                    }}
                  >
                    {method === "oneeuro" ? "1€" : method === "timebased" ? "TIME" : method.slice(0, 4)}
                  </button>
                ))}
              </div>
              {config.interpolation === "spring" && (
                <div style={{ marginTop: "12px" }}>
                  <SliderRow
                    label="Spring Stiffness"
                    value={config.springStiffness}
                    min={100}
                    max={2000}
                    step={50}
                    onChange={(v) => setConfig({ ...config, springStiffness: v })}
                  />
                </div>
              )}
              {config.enableStretch && (
                <div style={{ marginTop: "12px" }}>
                  <SliderRow
                    label="Ellipse Thinning"
                    value={config.ellipseThinning}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => setConfig({ ...config, ellipseThinning: v })}
                  />
                </div>
              )}
            </div>
            <div style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace" }}>BACKGROUND</span>
                <span style={{ color: "#6366f1", fontSize: "11px", fontFamily: "monospace" }}>{config.backgroundColor}</span>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {["#000000", "#0a0a0a", "#111111", "#1a1a1a", "#ffffff", "#0f172a", "#1e1b4b", "#18181b"].map((color) => (
                  <button
                    key={color}
                    onClick={() => setConfig({ ...config, backgroundColor: color })}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      backgroundColor: color,
                      border: config.backgroundColor === color ? "2px solid #6366f1" : "1px solid rgba(255,255,255,0.15)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
                <label
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>+</span>
                  <input
                    type="color"
                    value={config.backgroundColor}
                    onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      cursor: "pointer",
                    }}
                  />
                </label>
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace" }}>CURSOR COLOR</span>
                <span style={{ color: "#6366f1", fontSize: "11px", fontFamily: "monospace" }}>{config.cursorColor}</span>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {["#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6"].map((color) => (
                  <button
                    key={color}
                    onClick={() => setConfig({ ...config, cursorColor: color })}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      backgroundColor: color,
                      border: config.cursorColor === color ? "2px solid #fff" : "1px solid rgba(255,255,255,0.15)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
                <label
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>+</span>
                  <input
                    type="color"
                    value={config.cursorColor}
                    onChange={(e) => setConfig({ ...config, cursorColor: e.target.value })}
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      cursor: "pointer",
                    }}
                  />
                </label>
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={config.enableStretch}
                  onChange={(e) => setConfig({ ...config, enableStretch: e.target.checked })}
                  style={{
                    width: "16px",
                    height: "16px",
                    cursor: "pointer",
                    accentColor: "#6366f1",
                  }}
                />
                <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace" }}>ENABLE STRETCH</span>
              </label>
            </div>

            <div style={{ marginTop: "16px", opacity: config.enableGooeyTrail ? 0.3 : 1, pointerEvents: config.enableGooeyTrail ? "none" : "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace" }}>CURSOR STYLE</span>
                {config.enableGooeyTrail && (
                  <span style={{ color: "#6b7280", fontSize: "10px", fontFamily: "monospace" }}>DISABLED IN GOOEY MODE</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={config.showBlob}
                    onChange={(e) => {
                      const newShowBlob = e.target.checked;
                      // If this is the only checked one and user tries to uncheck it, keep it checked
                      if (!newShowBlob && !config.showCircle && !config.showOuterRing) {
                        return; // Don't change anything
                      }
                      setConfig({ ...config, showBlob: newShowBlob });
                    }}
                    style={{
                      width: "16px",
                      height: "16px",
                      cursor: "pointer",
                      accentColor: "#6366f1",
                    }}
                  />
                  <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace" }}>BLOB</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={config.showCircle}
                    onChange={(e) => {
                      const newShowCircle = e.target.checked;
                      // If this is the only checked one and user tries to uncheck it, keep it checked
                      if (!newShowCircle && !config.showBlob && !config.showOuterRing) {
                        return; // Don't change anything
                      }
                      setConfig({ ...config, showCircle: newShowCircle });
                    }}
                    style={{
                      width: "16px",
                      height: "16px",
                      cursor: "pointer",
                      accentColor: "#6366f1",
                    }}
                  />
                  <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace" }}>CIRCLE</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={config.showOuterRing}
                    onChange={(e) => {
                      const newShowOuterRing = e.target.checked;
                      // If this is the only checked one and user tries to uncheck it, keep it checked
                      if (!newShowOuterRing && !config.showBlob && !config.showCircle) {
                        return; // Don't change anything
                      }
                      setConfig({ ...config, showOuterRing: newShowOuterRing });
                    }}
                    style={{
                      width: "16px",
                      height: "16px",
                      cursor: "pointer",
                      accentColor: "#6366f1",
                    }}
                  />
                  <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace" }}>OUTER RING</span>
                </label>
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={config.showHiddenCursor}
                  onChange={(e) => setConfig({ ...config, showHiddenCursor: e.target.checked })}
                  style={{
                    width: "16px",
                    height: "16px",
                    cursor: "pointer",
                    accentColor: "#6366f1",
                  }}
                />
                <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace" }}>SHOW HIDDEN CURSOR</span>
              </label>
            </div>

            <div style={{ marginTop: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={config.enableGooeyTrail}
                  onChange={(e) => setConfig({ ...config, enableGooeyTrail: e.target.checked })}
                  style={{
                    width: "16px",
                    height: "16px",
                    cursor: "pointer",
                    accentColor: "#6366f1",
                  }}
                />
                <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace" }}>ENABLE GOOEY TRAIL</span>
              </label>
            </div>

            {config.enableGooeyTrail && (
              <>
                <SliderRow
                  label="Trail Length"
                  value={config.trailLength}
                  min={0.3}
                  max={1.5}
                  step={0.05}
                  onChange={(v) => setConfig({ ...config, trailLength: v })}
                />
                <SliderRow
                  label="Trail Blob Count"
                  value={config.trailBlobCount}
                  min={3}
                  max={15}
                  step={1}
                  onChange={(v) => setConfig({ ...config, trailBlobCount: v })}
                />
              </>
            )}

            <div style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace" }}>BORDER COLOR</span>
                <span style={{ color: "#6366f1", fontSize: "11px", fontFamily: "monospace" }}>{config.borderColor}</span>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {["#000000", "#ffffff", "#1f2937", "#374151", "#6b7280"].map((color) => (
                  <button
                    key={color}
                    onClick={() => setConfig({ ...config, borderColor: color })}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      backgroundColor: color,
                      border: config.borderColor === color ? "2px solid #6366f1" : "1px solid rgba(255,255,255,0.15)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
                <label
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>+</span>
                  <input
                    type="color"
                    value={config.borderColor}
                    onChange={(e) => setConfig({ ...config, borderColor: e.target.value })}
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      cursor: "pointer",
                    }}
                  />
                </label>
              </div>
            </div>

            <SliderRow
              label="Border Width"
              value={config.borderWidth}
              min={0}
              max={3}
              step={0.5}
              onChange={(v) => setConfig({ ...config, borderWidth: v })}
            />

            <div style={{ marginTop: "16px", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                  CLICK ANIMATION
                </span>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={config.enableClickAnimation}
                    onChange={(e) => setConfig({ ...config, enableClickAnimation: e.target.checked })}
                    style={{
                      width: "16px",
                      height: "16px",
                      cursor: "pointer",
                      accentColor: "#6366f1",
                    }}
                  />
                  <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace" }}>ENABLE CLICK ANIMATION</span>
                </label>
              </div>
              <SliderRow
                label="Click Shrink"
                value={config.clickShrink}
                min={0}
                max={0.9}
                step={0.05}
                onChange={(v) => setConfig({ ...config, clickShrink: v })}
              />
              <SliderRow
                label="Click Spring"
                value={config.clickSpring}
                min={0.05}
                max={0.5}
                step={0.01}
                onChange={(v) => setConfig({ ...config, clickSpring: v })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ color: "#9ca3af", fontSize: "11px", fontFamily: "monospace", letterSpacing: "0.05em" }}>
          {label.toUpperCase()}
        </span>
        <span style={{ color: "#6366f1", fontSize: "11px", fontFamily: "monospace" }}>{value.toFixed(1)}x</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: "100%",
          height: "4px",
          appearance: "none",
          background: "rgba(255,255,255,0.1)",
          borderRadius: "2px",
          outline: "none",
          cursor: "pointer",
          accentColor: "#6366f1",
        }}
      />
    </div>
  );
}
