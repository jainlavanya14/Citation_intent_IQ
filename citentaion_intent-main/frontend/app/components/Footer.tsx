"use client"
import { Brain } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

export default function Footer() {
  return (
    <footer className="border-t border-white/8 bg-gray-950/80 py-8 px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Brain size={14} className="text-white" />
          </div>
          <span className="text-gray-500 text-sm">
            CitationIQ &mdash; AI-Powered Citation Intent Classification
          </span>
        </div>

        <div className="flex items-center gap-4">
          <a href="#" className="text-gray-600 hover:text-gray-400 transition-colors">
            <FaGithub size={16} />
          </a>
          <a href="#" className="text-gray-600 hover:text-gray-400 transition-colors">
            <FaXTwitter size={16} />
          </a>
        </div>
      </div>
    </footer>
  );
}