"use client"
import { useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Chat from "./components/Chat";
import Footer from "./components/Footer";
 
export type View = 'home' | 'chat'
 
export default function Home() {
  const [view, setView] = useState<View>('home');
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar view={view} setView={setView} />
      {view === 'home' && <Hero setView={setView} />}
      {view === 'chat' && <Chat />}
      <Footer />
    </div>
  );
}