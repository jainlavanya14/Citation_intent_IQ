"use client"
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Brain, Send, User, Sparkles, RefreshCw, Search,
  Loader2, Upload, FileText, X, CheckCircle2, AlertCircle,
  ChevronDown,
} from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface IntentScore {
  intent: string;
  confidence: number;
  predicted: boolean;
}

interface PredictResult {
  text: string;
  predicted_intents: string[];
  all_scores: IntentScore[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const INTENT_COLORS: Record<string, string> = {
  'Background'  : 'bg-blue-500',
  'Motivation'  : 'bg-purple-500',
  'Future Work' : 'bg-orange-500',
  'Similarities': 'bg-green-500',
  'Differences' : 'bg-red-500',
  'Uses'        : 'bg-cyan-500',
  'Extends'     : 'bg-yellow-500',
};

const INTENT_DESCRIPTIONS: Record<string, string> = {
  'Background'  : 'Provides foundational context or knowledge',
  'Motivation'  : 'Inspired or motivated this research',
  'Future Work' : 'Suggested for future exploration',
  'Similarities': 'Has similar approaches or findings',
  'Differences' : 'Differs from this research',
  'Uses'        : 'Method or tool directly adopted',
  'Extends'     : 'This work builds upon the cited work',
};

const EXAMPLE_TEXTS = [
  'We use BERT from Devlin et al. (2019) as our encoder and fine-tune it on the MultiCite dataset.',
  'Unlike the CNN architecture used by Wang et al. (2021), our model achieves superior performance.',
  'Neural networks have been widely used for NLP tasks (LeCun et al., 2015), forming the basis of our approach.',
];

const SUGGESTED_QUESTIONS = [
  'What does this citation intent mean?',
  'Why was this paper cited here?',
  'How does this relate to the main research?',
  'Explain the detected intents',
];

function formatText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const formatted = line.replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="text-white font-semibold">$1</strong>'
    );
    return (
      <span key={i}>
        <span dangerouslySetInnerHTML={{ __html: formatted }} />
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

let idCounter = 10;

export default function CitationIntent() {
  // input mode
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');

  // text input
  const [citationText, setCitationText] = useState('');

  // file input
  const [file, setFile]             = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  // prediction
  const [predicting, setPredicting]     = useState(false);
  const [result, setResult]             = useState<PredictResult | null>(null);
  const [predictError, setPredictError] = useState('');

  // chat
  const [messages, setMessages] = useState<Message[]>([
    {
      id       : 1,
      role     : 'assistant',
      text     : "Hello! I'm the **CitationIQ AI assistant**.\n\nPaste a citation text or upload a PDF on the left and click **Predict** — I'll use the detected intents as context to answer your questions.",
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput]     = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // ── drag & drop ────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) { setFile(dropped); setResult(null); setPredictError(''); }
  }, []);

  // ── predict ────────────────────────────────────────────────────
  const handlePredict = async () => {
    const input = inputMode === 'text' ? citationText.trim() : '';
    // for file mode the backend would handle extraction; send filename as placeholder
    if (inputMode === 'text' && !input) return;
    if (inputMode === 'file' && !file) return;

    setPredicting(true);
    setPredictError('');
    setResult(null);

    try {
      let body: string;

      if (inputMode === 'file' && file) {
        // Send file as multipart if backend supports it; here we fall back to reading as text
        const fileText = await file.text();
        body = JSON.stringify({ text: fileText.slice(0, 2000) }); // truncate for demo
      } else {
        body = JSON.stringify({ text: input });
      }

      const res = await fetch(`${API_URL}/predict`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: PredictResult = await res.json();
      setResult(data);

      const autoMsg: Message = {
        id       : ++idCounter,
        role     : 'assistant',
        text     : `I've analyzed the ${inputMode === 'file' ? 'uploaded file' : 'citation text'}. Detected intents: **${data.predicted_intents.join(', ')}**.\n\nFeel free to ask me anything about this citation!`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, autoMsg]);

    } catch {
      setPredictError('Could not reach the microservice. Make sure it is running on port 8000.');
    } finally {
      setPredicting(false);
    }
  };

  // ── chat ───────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    if (!text.trim() || chatLoading) return;

    const userMsg: Message = {
      id       : ++idCounter,
      role     : 'user',
      text     : text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          question  : text,
          paperText : citationText,
          intents   : result?.predicted_intents ?? [],
        }),
      });

      if (!res.ok) throw new Error('Chat API failed');
      const data = await res.json();

      const aiMsg: Message = {
        id       : ++idCounter,
        role     : 'assistant',
        text     : data.answer || 'Sorry, I could not generate a response.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch {
      const errMsg: Message = {
        id       : ++idCounter,
        role     : 'assistant',
        text     : 'Sorry, I encountered an error. Please check your Groq API key in .env.local.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(chatInput);
  };

  const handleReset = () => {
    setMessages([{
      id       : ++idCounter,
      role     : 'assistant',
      text     : 'Conversation reset! Paste a citation text or upload a PDF, then click Predict.',
      timestamp: new Date(),
    }]);
    setChatInput('');
    setResult(null);
    setCitationText('');
    setFile(null);
    setPredictError('');
  };

  const canPredict = inputMode === 'text'
    ? citationText.trim().length > 10
    : file !== null;

  // ── render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* header */}
      <header className="border-b border-white/8 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Brain size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">CitationIQ</h1>
            <p className="text-xs text-gray-500">Citation Intent Classifier — SciBERT + Focal Loss</p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-73px)]">

        {/* ── LEFT: Input + Results ── */}
        <div className="flex flex-col gap-4 overflow-y-auto">

          {/* input card */}
          <div className="bg-gray-900/60 border border-white/8 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Citation Input</h2>

            {/* mode tabs */}
            <div className="flex bg-gray-950/60 border border-white/8 rounded-xl p-1 w-fit gap-1 mb-4">
              {(['text', 'file'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => { setInputMode(mode); setResult(null); setPredictError(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    inputMode === mode
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {mode === 'text' ? <FileText size={13} /> : <Upload size={13} />}
                  {mode === 'text' ? 'Citation Text' : 'Upload PDF'}
                </button>
              ))}
            </div>

            {/* text mode */}
            {inputMode === 'text' && (
              <div className="space-y-3">
                <textarea
                  value={citationText}
                  onChange={e => { setCitationText(e.target.value); setResult(null); setPredictError(''); }}
                  placeholder={`Paste your citation sentence here...\n\nExample: "We use BERT from Devlin et al. (2019) as our encoder."`}
                  rows={5}
                  className="w-full bg-gray-950/60 border border-white/8 focus:border-blue-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none resize-none transition-colors font-mono"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">{citationText.length} characters</span>
                  <div className="flex items-center gap-1">
                    <ChevronDown size={12} className="text-gray-600" />
                    <span className="text-xs text-gray-600">Try an example</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {EXAMPLE_TEXTS.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => { setInputMode('text'); setCitationText(ex); setResult(null); setPredictError(''); }}
                      className="w-full text-left text-xs text-gray-600 hover:text-gray-400 bg-gray-900/40 hover:bg-gray-900/70 border border-white/5 hover:border-white/10 rounded-lg px-3 py-2 transition-all line-clamp-1"
                    >
                      &ldquo;{ex}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* file mode */}
            {inputMode === 'file' && (
              <div className="space-y-3">
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
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
                    onChange={e => {
                      if (e.target.files?.[0]) {
                        setFile(e.target.files[0]);
                        setResult(null);
                        setPredictError('');
                      }
                    }}
                  />
                  {file ? (
                    <>
                      <CheckCircle2 size={30} className="text-emerald-400" />
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
                      <div className="w-12 h-12 rounded-2xl bg-gray-800/80 border border-white/8 flex items-center justify-center">
                        <Upload size={22} className="text-gray-500" />
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

            {predictError && (
              <p className="text-red-400 text-xs mt-2 flex items-center gap-1.5">
                <AlertCircle size={12} /> {predictError}
              </p>
            )}

            <button
              onClick={handlePredict}
              disabled={!canPredict || predicting}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/20 disabled:shadow-none"
            >
              {predicting ? (
                <><Loader2 size={15} className="animate-spin" /> Predicting...</>
              ) : (
                <><Search size={15} /> Predict Intent</>
              )}
            </button>
          </div>

          {/* results card */}
          {result && (
            <div className="bg-gray-900/60 border border-white/8 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Predicted Intents</h2>

              <div className="flex flex-wrap gap-2 mb-5">
                {result.predicted_intents.map(intent => (
                  <span
                    key={intent}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold text-white ${INTENT_COLORS[intent] || 'bg-gray-600'}`}
                  >
                    {intent}
                  </span>
                ))}
              </div>

              <div className="space-y-3">
                {result.all_scores.map(score => (
                  <div key={score.intent}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${INTENT_COLORS[score.intent] || 'bg-gray-500'}`} />
                        <span className={`text-xs font-medium ${score.predicted ? 'text-white' : 'text-gray-500'}`}>
                          {score.intent}
                        </span>
                        {score.predicted && <span className="text-xs text-green-400">✓</span>}
                      </div>
                      <span className={`text-xs ${score.predicted ? 'text-white font-semibold' : 'text-gray-600'}`}>
                        {(score.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${score.predicted ? (INTENT_COLORS[score.intent] || 'bg-blue-500') : 'bg-gray-700'}`}
                        style={{ width: `${score.confidence * 100}%` }}
                      />
                    </div>
                    {score.predicted && (
                      <p className="text-xs text-gray-500 mt-1 ml-4">
                        {INTENT_DESCRIPTIONS[score.intent]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-gray-600">
              Model: <span className="text-gray-400">SciBERT + Focal Loss (T1)</span> ·
              Thresholds: <span className="text-gray-400">Per-class tuned (T2)</span> ·
              Classes: <span className="text-gray-400">7 citation intents</span>
            </p>
          </div>
        </div>

        {/* ── RIGHT: Chat ── */}
        <div className="flex flex-col bg-gray-900/40 border border-white/8 rounded-2xl overflow-hidden">

          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div>
              <h2 className="text-sm font-semibold text-white">Chat with AI</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {result
                  ? `Context: ${result.predicted_intents.join(', ')}`
                  : 'Predict an intent first for informed answers'}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 border border-white/8 text-gray-400 hover:text-white rounded-lg text-xs transition-all"
            >
              <RefreshCw size={12} />
              Reset
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'assistant' ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gray-700'}`}>
                  {msg.role === 'assistant'
                    ? <Brain size={13} className="text-white" />
                    : <User size={13} className="text-gray-300" />
                  }
                </div>
                <div className={`max-w-[85%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'assistant'
                      ? 'bg-gray-900/80 border border-white/8 text-gray-300 rounded-tl-sm'
                      : 'bg-blue-600 text-white rounded-tr-sm'
                  }`}>
                    {formatText(msg.text)}
                  </div>
                  <span className="text-xs text-gray-700 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Brain size={13} className="text-white" />
                </div>
                <div className="px-4 py-3.5 bg-gray-900/80 border border-white/8 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1 items-center h-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={chatLoading}
                className="px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-gray-900/60 hover:bg-gray-800 border border-white/8 rounded-lg transition-all disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-white/8">
            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder={result ? 'Ask about this citation...' : 'Predict an intent first...'}
                  disabled={chatLoading}
                  className="w-full bg-gray-950/60 border border-white/10 focus:border-blue-500/50 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm outline-none transition-colors pr-10 disabled:opacity-60"
                />
                <Sparkles size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700" />
              </div>
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="w-11 h-11 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:shadow-none shrink-0"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}