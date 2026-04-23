"use client"
import { useState, useRef, useCallback } from 'react';
import {
  Brain, Upload, FileText, X, Sparkles,
  ChevronDown, AlertCircle, CheckCircle2,
  BarChart2, Info, RotateCcw, Copy, Check, Loader2
} from 'lucide-react';

// ── types ─────────────────────────────────────────────────────────
interface IntentScore {
  intent      : string;
  confidence  : number;
  predicted   : boolean;
  description : string;
}

interface PredictResult {
  text              : string;
  predicted_intents : string[];
  all_scores        : IntentScore[];
}

// ── constants ─────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const INTENT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  'Background'  : { text: 'text-blue-300',   bg: 'bg-blue-500/15',   border: 'border-blue-500/30'   },
  'Motivation'  : { text: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  'Future Work' : { text: 'text-sky-300',    bg: 'bg-sky-500/15',    border: 'border-sky-500/30'    },
  'Similarities': { text: 'text-teal-300',   bg: 'bg-teal-500/15',   border: 'border-teal-500/30'   },
  'Differences' : { text: 'text-red-300',    bg: 'bg-red-500/15',    border: 'border-red-500/30'    },
  'Uses'        : { text: 'text-emerald-300',bg: 'bg-emerald-500/15',border: 'border-emerald-500/30'},
  'Extends'     : { text: 'text-cyan-300',   bg: 'bg-cyan-500/15',   border: 'border-cyan-500/30'   },
};

const EXAMPLE_TEXTS = [
  'We use BERT from Devlin et al. (2019) as our encoder and fine-tune it on the MultiCite dataset.',
  'Unlike the CNN architecture used by Wang et al. (2021), our model achieves superior performance with fewer parameters.',
  'Neural networks have been widely used for NLP tasks (LeCun et al., 2015), forming the basis of our approach.',
  'Inspired by contrastive learning (Chen et al., 2020), we adopt a self-supervised objective for citation classification.',
  'Extending this to multilingual settings (Conneau et al., 2020) is left as future work.',
];

// ── component ─────────────────────────────────────────────────────
export default function Analyzer() {
  const [inputMode, setInputMode]   = useState<'text' | 'file'>('text');
  const [text, setText]             = useState('');
  const [file, setFile]             = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult]         = useState<PredictResult | null>(null);
  const [error, setError]           = useState('');
  const [copied, setCopied]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── predict ──────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    const input = inputMode === 'text' ? text.trim() : '';
    if (!input && inputMode === 'text') return;

    setIsAnalyzing(true);
    setResult(null);
    setError('');

    try {
      const res = await fetch(`${API_URL}/predict`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ text: input }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: PredictResult = await res.json();
      setResult(data);

    } catch (err) {
      setError('Could not reach the microservice. Make sure it is running on port 8000.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setText('');
    setFile(null);
    setResult(null);
    setError('');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const handleExampleClick = (example: string) => {
    setInputMode('text');
    setText(example);
    setResult(null);
    setError('');
  };

  const handleCopy = () => {
    if (!result) return;
    const top = result.predicted_intents[0];
    const score = result.all_scores.find(s => s.intent === top);
    navigator.clipboard.writeText(
      `Citation Intent: ${top} (${((score?.confidence ?? 0) * 100).toFixed(1)}%)\n${score?.description ?? ''}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canAnalyze = inputMode === 'text'
    ? text.trim().length > 10
    : file !== null;

  // top result for primary card
  const topScore = result?.all_scores[0];
  const topColors = topScore ? (INTENT_COLORS[topScore.intent] ?? { text: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30' }) : null;

  // ── render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 pt-24 pb-16 px-6">
      <div className="max-w-5xl mx-auto">

        {/* heading */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Citation Intent Analysis
          </h1>
          <p className="text-gray-500 text-base max-w-xl">
            Paste a citation sentence to classify its intent using SciBERT trained on MultiCite.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── LEFT: Input ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* mode tabs */}
            <div className="flex bg-gray-900/50 border border-white/8 rounded-xl p-1 w-fit gap-1">
              {(['text', 'file'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => { setInputMode(mode); setResult(null); setError(''); }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    inputMode === mode
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {mode === 'text' ? <FileText size={14} /> : <Upload size={14} />}
                  {mode === 'text' ? 'Citation Text' : 'Upload Paper'}
                </button>
              ))}
            </div>

            {/* text input */}
            {inputMode === 'text' && (
              <div className="space-y-3">
                <textarea
                  value={text}
                  onChange={e => { setText(e.target.value); setResult(null); setError(''); }}
                  placeholder={`Paste your citation text here...\n\nExample: "We use BERT from Devlin et al. (2019) as our encoder."`}
                  rows={6}
                  className="w-full bg-gray-900/60 border border-white/10 hover:border-white/15 focus:border-blue-500/50 rounded-xl px-4 py-4 text-white placeholder-gray-600 text-sm leading-relaxed resize-none outline-none transition-colors font-mono"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">{text.length} characters</span>
                  <div className="flex items-center gap-1">
                    <ChevronDown size={12} className="text-gray-600" />
                    <span className="text-xs text-gray-600">Try an example</span>
                  </div>
                </div>

                {/* examples */}
                <div className="space-y-2">
                  {EXAMPLE_TEXTS.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => handleExampleClick(ex)}
                      className="w-full text-left text-xs text-gray-600 hover:text-gray-400 bg-gray-900/40 hover:bg-gray-900/70 border border-white/5 hover:border-white/10 rounded-lg px-3 py-2.5 transition-all duration-150 line-clamp-1"
                    >
                      &ldquo;{ex}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* file upload */}
            {inputMode === 'file' && (
              <div className="space-y-3">
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? 'border-blue-500/60 bg-blue-500/8'
                      : file
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-white/10 hover:border-white/20 bg-gray-900/40'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setResult(null); } }}
                  />
                  {file ? (
                    <>
                      <CheckCircle2 size={32} className="text-emerald-400" />
                      <div className="text-center">
                        <p className="text-white text-sm font-medium">{file.name}</p>
                        <p className="text-gray-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setFile(null); setResult(null); }}
                        className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-gray-800/80 border border-white/8 flex items-center justify-center">
                        <Upload size={24} className="text-gray-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-gray-300 text-sm font-medium">
                          {isDragging ? 'Drop your file here' : 'Drag & drop your paper'}
                        </p>
                        <p className="text-gray-600 text-xs mt-1">or click to browse · PDF, DOCX, TXT</p>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <AlertCircle size={11} />
                  File upload extracts text — only citation sentences are classified.
                </p>
              </div>
            )}

            {/* error */}
            {error && (
              <p className="text-red-400 text-xs flex items-center gap-1.5">
                <AlertCircle size={12} /> {error}
              </p>
            )}

            {/* actions */}
            <div className="flex gap-3">
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze || isAnalyzing}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/20 disabled:shadow-none"
              >
                {isAnalyzing ? (
                  <><Loader2 size={16} className="animate-spin" /> Analyzing...</>
                ) : (
                  <><Sparkles size={16} /> Analyze Citation</>
                )}
              </button>
              {(text || file || result) && (
                <button
                  onClick={handleReset}
                  className="px-4 py-3.5 bg-gray-900/60 hover:bg-gray-800 border border-white/8 text-gray-400 hover:text-white rounded-xl transition-all"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>

            {!canAnalyze && !isAnalyzing && (
              <p className="text-xs text-gray-600 flex items-center gap-1.5">
                <AlertCircle size={11} />
                {inputMode === 'text' ? 'Enter at least 10 characters.' : 'Select a file to analyze.'}
              </p>
            )}
          </div>

          {/* ── RIGHT: Results ── */}
          <div className="lg:col-span-2">

            {/* empty state */}
            {!result && !isAnalyzing && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16 rounded-xl border border-white/5 bg-gray-900/30">
                <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-white/8 flex items-center justify-center mb-4">
                  <BarChart2 size={24} className="text-gray-600" />
                </div>
                <p className="text-gray-500 text-sm font-medium">Results will appear here</p>
                <p className="text-gray-700 text-xs mt-1">Enter text and click Analyze</p>
              </div>
            )}

            {/* loading state */}
            {isAnalyzing && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16 rounded-xl border border-blue-500/15 bg-blue-500/5">
                <div className="relative w-16 h-16 mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
                  <div className="relative w-16 h-16 rounded-full border-2 border-blue-500/40 border-t-blue-500 animate-spin flex items-center justify-center">
                    <Brain size={22} className="text-blue-400" />
                  </div>
                </div>
                <p className="text-blue-300 text-sm font-medium">Classifying intent...</p>
                <p className="text-gray-600 text-xs mt-1">Running SciBERT inference</p>
              </div>
            )}

            {/* results */}
            {result && !isAnalyzing && topScore && topColors && (
              <div className="space-y-3">

                {/* header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white">Analysis Results</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
                  >
                    {copied
                      ? <><Check size={13} className="text-emerald-400" /> Copied</>
                      : <><Copy size={13} /> Copy</>
                    }
                  </button>
                </div>

                {/* predicted intent badges */}
                <div className="flex flex-wrap gap-2 mb-1">
                  {result.predicted_intents.map(intent => {
                    const c = INTENT_COLORS[intent] ?? { text: 'text-gray-300', bg: 'bg-gray-700', border: 'border-gray-600' };
                    return (
                      <span key={intent} className={`px-3 py-1 rounded-lg text-xs font-semibold border ${c.text} ${c.bg} ${c.border}`}>
                        ✓ {intent}
                      </span>
                    );
                  })}
                </div>

                {/* primary result card */}
                <div className={`p-4 rounded-xl border ${topColors.border} ${topColors.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-lg font-bold ${topColors.text}`}>{topScore.intent}</span>
                    <span className={`text-2xl font-black ${topColors.text}`}>
                      {(topScore.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-black/20 rounded-full h-1.5 mb-3">
                    <div
                      className="h-1.5 rounded-full bg-white/60 transition-all duration-700"
                      style={{ width: `${topScore.confidence * 100}%` }}
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    <Info size={12} className={`${topColors.text} mt-0.5 shrink-0`} />
                    <p className={`text-xs leading-relaxed opacity-80 ${topColors.text}`}>
                      {topScore.description}
                    </p>
                  </div>
                </div>

                {/* all scores */}
                <div className="space-y-2">
                  {result.all_scores.slice(1).map(score => {
                    const c = INTENT_COLORS[score.intent] ?? { text: 'text-gray-400', bg: '', border: '' };
                    return (
                      <div key={score.intent} className="px-3 py-2.5 rounded-lg bg-gray-900/50 border border-white/5">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${score.predicted ? c.text : 'text-gray-500'}`}>
                              {score.intent}
                            </span>
                            {score.predicted && <span className="text-xs text-green-400">✓</span>}
                          </div>
                          <span className={`text-xs ${score.predicted ? 'text-white font-semibold' : 'text-gray-600'}`}>
                            {(score.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1">
                          <div
                            className={`h-1 rounded-full transition-all duration-500 ${score.predicted ? 'bg-blue-500' : 'bg-gray-700'}`}
                            style={{ width: `${score.confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* model info footer */}
                <p className="text-xs text-gray-700 pt-1">
                  Model: SciBERT + Focal Loss · Thresholds: Per-class tuned (T2)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}