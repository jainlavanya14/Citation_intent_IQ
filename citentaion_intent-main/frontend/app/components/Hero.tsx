"use client"
import { ArrowRight, Brain, MessageSquare, Sparkles, Zap, FileText, BarChart2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { View } from "../page";

interface HeroProps {
  setView: (v: View) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

export default function Hero({ setView }: HeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    particlesRef.current = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 2.5 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96, 165, 250, ${p.opacity})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(96, 165, 250, ${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const stats = [
    { icon: <FileText size={18} />, value: '7', label: 'Intent Categories' },
    
    { icon: <Zap size={18} />, value: '<10s', label: 'Analysis Time' },
  ];

  const intents = [
    { label: 'Background', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    { label: 'Uses', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    { label: 'Differences', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    { label: 'Similarites', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
    { label: 'Extends', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    { label: 'Motivation', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    { label: 'Future Work', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  ];

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-blue-950/40 to-purple-950/30" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.12),transparent_60%)]" />

      {/* Particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Hero content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-16 text-center">

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl">
          <span className="text-white">Citation Intent</span>
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Classifier
          </span>
        </h1>

        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
          Understand <span className="text-white font-medium">why citations are used</span> in research papers with AI.
          Instantly classify citation intent from text or uploaded documents.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-16">
          <button
            onClick={() => setView('chat')}
            className="group flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/35 hover:-translate-y-0.5"
          >
            <Brain size={18} />
            Analyze Now
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
          </button>
          
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 mb-16">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                {s.icon}
              </div>
              <div className="text-left">
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Intent categories */}
        <div className="max-w-2xl w-full">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-4 font-medium">Supported Intent Categories</p>
          <div className="flex flex-wrap justify-center gap-2">
            {intents.map((intent) => (
              <span
                key={intent.label}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${intent.color}`}
              >
                {intent.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="relative max-w-7xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          {
            icon: <FileText size={22} className="text-blue-400" />,
            title: 'Multi-Format Input',
            desc: 'Paste citation text directly or upload PDF, DOCX, and TXT research papers for instant analysis.',
            border: 'border-blue-500/20',
            glow: 'bg-blue-500/5',
          },
          {
            icon: <Brain size={22} className="text-purple-400" />,
            title: '7 Intent Categories',
            desc: 'Classify citations as Background, Uses Method, Differences, Similarities, Motivation, Support, or Future Work.',
            border: 'border-purple-500/20',
            glow: 'bg-purple-500/5',
          },
          {
            icon: <MessageSquare size={22} className="text-cyan-400" />,
            title: 'AI Chat Assistant',
            desc: 'Ask our intelligent assistant about citation intent, research methodology, and academic writing best practices.',
            border: 'border-cyan-500/20',
            glow: 'bg-cyan-500/5',
          },
        ].map((card) => (
          <div
            key={card.title}
            className={`p-6 rounded-2xl border ${card.border} ${card.glow} backdrop-blur-sm hover:border-opacity-60 transition-all duration-300 hover:-translate-y-1 group`}
          >
            <div className="mb-4">{card.icon}</div>
            <h3 className="text-white font-semibold text-lg mb-2">{card.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
