export default function TechBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-gray-950" />

      {/* Animated gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.07] bg-purple-500 blur-[120px] animate-float-slow" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full opacity-[0.06] bg-blue-500 blur-[140px] animate-float-medium" />
      <div className="absolute top-[40%] right-[20%] w-[400px] h-[400px] rounded-full opacity-[0.05] bg-violet-600 blur-[100px] animate-float-fast" />
      <div className="absolute top-[20%] left-[40%] w-[300px] h-[300px] rounded-full opacity-[0.04] bg-cyan-500 blur-[90px] animate-float-medium" />

      {/* Grid lines overlay */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139,92,246,0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.8) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Corner glow accents */}
      <div className="absolute top-0 left-0 w-[300px] h-[2px] bg-gradient-to-r from-purple-500/40 to-transparent" />
      <div className="absolute top-0 left-0 w-[2px] h-[300px] bg-gradient-to-b from-purple-500/40 to-transparent" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[2px] bg-gradient-to-l from-blue-500/30 to-transparent" />
      <div className="absolute bottom-0 right-0 w-[2px] h-[300px] bg-gradient-to-t from-blue-500/30 to-transparent" />

      {/* Floating particles */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-purple-400/30 animate-particle"
          style={{
            left: `${8 + i * 8}%`,
            top: `${10 + (i * 37) % 80}%`,
            animationDelay: `${i * 0.7}s`,
            animationDuration: `${6 + (i % 4)}s`,
          }}
        />
      ))}

      {/* Scan line effect */}
      <div className="absolute inset-0 animate-scanline opacity-[0.015]"
        style={{
          background: "linear-gradient(transparent 50%, rgba(139,92,246,0.1) 50%)",
          backgroundSize: "100% 4px",
        }}
      />
    </div>
  );
}
