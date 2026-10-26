import MotionBlurCursor from "./components/MotionBlurCursor";

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white cursor-none select-none">
      <MotionBlurCursor />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-slate-900/60 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <span className="text-sm font-bold">M</span>
            </div>
            <span className="font-semibold text-lg">MotionBlur</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-300 hover:text-white transition-colors cursor-none">Features</a>
            <a href="#demo" className="text-sm text-slate-300 hover:text-white transition-colors cursor-none">Demo</a>
            <a href="#about" className="text-sm text-slate-300 hover:text-white transition-colors cursor-none">About</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-8">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            <span className="text-sm text-indigo-300">Move your cursor around</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            <span className="bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
              Directional Motion Blur
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            A velocity-based cursor trail that follows your movement direction.
            Move fast for longer trails, slow for subtle effects. Try diagonal movements, sharp turns, and rapid stops.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button className="px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-medium transition-colors cursor-none">
              Get Started
            </button>
            <button className="px-6 py-3 rounded-xl border border-white/20 hover:border-white/40 text-white font-medium transition-colors cursor-none">
              View Source
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-slate-400 text-center max-w-xl mx-auto mb-16">
            Built with Canvas 2D, velocity tracking, and directional rendering for smooth, performant motion blur.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon="🎯"
              title="Directional Tracking"
              description="The blur trail follows your cursor's actual movement direction — horizontal, vertical, or diagonal."
            />
            <FeatureCard
              icon="⚡"
              title="Velocity Responsive"
              description="Trail length scales with cursor speed. Fast movements produce longer trails, slow movements stay subtle."
            />
            <FeatureCard
              icon="🎨"
              title="Smooth Fading"
              description="Natural opacity falloff with no ghost images. Trail disappears smoothly when cursor stops."
            />
            <FeatureCard
              icon="📐"
              title="Angle Interpolation"
              description="Movement angle is smoothed to prevent jarring direction changes during sharp turns."
            />
            <FeatureCard
              icon="🖥️"
              title="HiDPI Support"
              description="Correctly handles device pixel ratio for crisp rendering on Retina and high-DPI displays."
            />
            <FeatureCard
              icon="♿"
              title="Accessible"
              description="Respects prefers-reduced-motion. Pointer events pass through. No interaction interference."
            />
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Try It Out</h2>
          <p className="text-slate-400 text-center max-w-xl mx-auto mb-12">
            Move your cursor through different areas. Notice how the trail direction, length, and opacity change.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-colors cursor-none">
              <h3 className="text-xl font-semibold mb-3">Fast Sweeps</h3>
              <p className="text-slate-400 text-sm">
                Move your cursor quickly across this area. The trail should extend significantly in the direction of movement.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-colors cursor-none">
              <h3 className="text-xl font-semibold mb-3">Sharp Turns</h3>
              <p className="text-slate-400 text-sm">
                Try making quick direction changes. The angle interpolation keeps the trail smooth during transitions.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-colors cursor-none">
              <h3 className="text-xl font-semibold mb-3">Slow Movement</h3>
              <p className="text-slate-400 text-sm">
                Move slowly to see the subtle trail effect. Below the velocity threshold, no trail appears.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-colors cursor-none">
              <h3 className="text-xl font-semibold mb-3">Stop & Fade</h3>
              <p className="text-slate-400 text-sm">
                Stop moving suddenly. Watch the trail fade out naturally without leaving ghost images.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Area */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative p-12 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>
            <div className="relative text-center">
              <h3 className="text-2xl font-bold mb-4">Interactive Playground</h3>
              <p className="text-slate-400 mb-8">
                Draw patterns in this area. The motion blur responds to every direction change.
              </p>
              <div className="h-48 rounded-xl border border-white/10 bg-black/20 flex items-center justify-center">
                <p className="text-slate-500 text-sm">Move your cursor here</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Technical Details</h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-12">
            Implementation uses a Canvas 2D overlay with a bounded position history ring buffer,
            velocity smoothing via exponential moving average, and directional trail rendering
            with interpolated angle transitions.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard value="60fps" label="Target FPS" />
            <StatCard value="24" label="Max Samples" />
            <StatCard value="32" label="History Buffer" />
            <StatCard value="0" label="Dependencies" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">Directional Motion Blur Cursor • Canvas 2D Implementation</p>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">React + Vite + Tailwind CSS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-all duration-300 cursor-none group">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2 group-hover:text-indigo-300 transition-colors">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 cursor-none">
      <div className="text-2xl font-bold text-indigo-400">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}
