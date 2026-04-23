"use client"
import { BookOpen, Brain, MessageSquare, Menu, X } from 'lucide-react';
import { useState } from 'react';
import type { View } from '../page';

interface NavbarProps {
  view: View;
  setView: (v: View) => void;
}

export default function Navbar({ view, setView }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const links: { label: string; value: View; icon: React.ReactNode }[] = [
    { label: 'Home', value: 'home', icon: <BookOpen size={16} /> },
    { label: 'Chat with AI', value: 'chat', icon: <MessageSquare size={16} /> },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-lg border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => setView('home')}
          className="flex items-center gap-2 group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Brain size={16} className="text-white" />
          </div>
          <span className="font-semibold text-white text-sm tracking-wide">
            CitationIQ
          </span>
        </button>

        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <button
              key={link.value}
              onClick={() => setView(link.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                view === link.value
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {link.icon}
              {link.label}
            </button>
          ))}
        </div>

        <button
          className="md:hidden text-gray-400 hover:text-white"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden px-6 pb-4 flex flex-col gap-1">
          {links.map((link) => (
            <button
              key={link.value}
              onClick={() => { setView(link.value); setMenuOpen(false); }}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                view === link.value
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {link.icon}
              {link.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}