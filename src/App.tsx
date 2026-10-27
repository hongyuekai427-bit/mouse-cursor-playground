import { useState, useRef, useEffect } from "react";
import MotionBlurCursor, { CursorConfig } from "./components/MotionBlurCursor";

export default function App() {
  const [config, setConfig] = useState<CursorConfig>({
    ellipseMultiplier: 1,
    backgroundColor: "#000000",
    interpolation: "off",
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
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => setConfig({ ...config, interpolation: "off" })}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: config.interpolation === "off" ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.05)",
                    border: config.interpolation === "off" ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
                    color: config.interpolation === "off" ? "#a5b4fc" : "#9ca3af",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  OFF
                </button>
                <button
                  onClick={() => setConfig({ ...config, interpolation: "lerp" })}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: config.interpolation === "lerp" ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.05)",
                    border: config.interpolation === "lerp" ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
                    color: config.interpolation === "lerp" ? "#a5b4fc" : "#9ca3af",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  LERP
                </button>
                <button
                  onClick={() => setConfig({ ...config, interpolation: "spline" })}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: config.interpolation === "spline" ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.05)",
                    border: config.interpolation === "spline" ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
                    color: config.interpolation === "spline" ? "#a5b4fc" : "#9ca3af",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  SPLINE
                </button>
                <button
                  onClick={() => setConfig({ ...config, interpolation: "multiframe" })}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: config.interpolation === "multiframe" ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.05)",
                    border: config.interpolation === "multiframe" ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
                    color: config.interpolation === "multiframe" ? "#a5b4fc" : "#9ca3af",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  MULTI
                </button>
              </div>
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
