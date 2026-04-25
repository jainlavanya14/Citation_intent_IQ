import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

/** Max chars for the citation snippet (used when no page/line ref detected). */
const MAX_SNIPPET_CHARS  = 600;
/** Max chars for full-doc context (used when page/line ref is detected). */
const MAX_FULLTEXT_CHARS = 6000;

/** Detect whether the question references a specific page or line number. */
function detectsPageOrLine(question: string): { page?: number; line?: number } | null {
  const lower = question.toLowerCase();
  const pageMatch = lower.match(/page\s+(\d+)/);
  const lineMatch = lower.match(/line\s+(\d+)/);
  if (!pageMatch && !lineMatch) return null;
  return {
    page: pageMatch ? parseInt(pageMatch[1], 10) : undefined,
    line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
  };
}

/**
 * Given per-page text and a page number, return that page's text
 * (falling back to surrounding pages for context).
 */
function extractPageContext(
  pages: string[],
  targetPage: number,
  maxChars = MAX_FULLTEXT_CHARS,
): string {
  // pages array is 0-indexed; user says "page 9" → index 8
  const idx = targetPage - 1;
  const parts: string[] = [];

  // Include the previous page as lead-in context
  if (idx > 0 && pages[idx - 1]) {
    parts.push(`[Page ${targetPage - 1}]\n${pages[idx - 1]}`);
  }
  if (pages[idx]) {
    parts.push(`[Page ${targetPage}]\n${pages[idx]}`);
  }
  // Include the next page for overflow citations
  if (pages[idx + 1]) {
    parts.push(`[Page ${targetPage + 1}]\n${pages[idx + 1]}`);
  }

  return parts.join("\n\n").slice(0, maxChars);
}

/**
 * Split a flat document text into rough "pages" by estimating ~3000 chars
 * per page. This is used when the frontend sends fullDocText but not pages[].
 */
function splitIntoPages(text: string, charsPerPage = 3000): string[] {
  const pages: string[] = [];
  for (let i = 0; i < text.length; i += charsPerPage) {
    pages.push(text.slice(i, i + charsPerPage));
  }
  return pages;
}

export async function POST(req: NextRequest) {
  try {
    const {
      question,
      paperText,   // short citation snippet (legacy / text-mode)
      fullDocText, // full extracted document text (file-mode, new)
      docPages,    // optional: per-page text array from pdfjs (new)
      intents,
      citations,   // structured citation data with predictions
    } = await req.json();

    if (!question || !question.trim()) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 });
    }

    const intentList: string[] =
      Array.isArray(intents) && intents.length > 0 ? intents : [];

    // ── Decide which context to send ──────────────────────────────────────
    const ref = detectsPageOrLine(question.trim());
    let contextText = "";
    let contextLabel = "";

    if (ref && (fullDocText || docPages)) {
      // User asked about a specific page/line — send that page's content
      const pages: string[] =
        Array.isArray(docPages) && docPages.length > 0
          ? docPages
          : splitIntoPages(
              typeof fullDocText === "string" ? fullDocText : "",
            );

      if (ref.page && pages.length >= ref.page) {
        contextText = extractPageContext(pages, ref.page);
        contextLabel = `Document excerpt (pages ${Math.max(1, ref.page - 1)}–${ref.page + 1})`;
      } else if (ref.page) {
        // Page number out of range — send as much of the doc as possible
        contextText = (typeof fullDocText === "string" ? fullDocText : "").slice(
          0,
          MAX_FULLTEXT_CHARS,
        );
        contextLabel = `Full document text (first ${MAX_FULLTEXT_CHARS} chars)`;
      }
    }

    // Fallbacks (in priority order):
    // 1. If full document is available, send it for comprehensive paper understanding
    // 2. Otherwise, use the short citation snippet
    if (!contextText && typeof fullDocText === "string" && fullDocText.trim()) {
      contextText = fullDocText.trim().slice(0, MAX_FULLTEXT_CHARS);
      contextLabel = `Full paper content (first ${MAX_FULLTEXT_CHARS} chars)`;
    }

    if (!contextText) {
      contextText =
        typeof paperText === "string" && paperText.trim()
          ? paperText.trim().slice(0, MAX_SNIPPET_CHARS)
          : "";
      contextLabel = "Citation sentence";
    }

    // ── Build system prompt ───────────────────────────────────────────────
    const contextLines: string[] = [];
    if (contextText) contextLines.push(`${contextLabel}:\n"""\n${contextText}\n"""`);
    if (intentList.length > 0) contextLines.push(`Detected citation intents: ${intentList.join(", ")}`);

    // Include structured citation data for accurate AI responses
    if (Array.isArray(citations) && citations.length > 0) {
      const citationSummary = citations
        .slice(0, 20) // Limit to first 20 for token efficiency
        .map((cit: any, idx: number) => 
          `Citation ${idx + 1}: "${cit.citation_text.slice(0, 100)}..." → Intents: ${cit.predicted_intents.join(", ")}`
        )
        .join("\n");
      contextLines.push(`Extracted Citations (with model predictions):\n${citationSummary}\n\n[Total: ${citations.length} citations extracted]`);
    }

    const contextBlock = contextLines.length > 0
      ? `\n\nContext:\n${contextLines.join("\n\n")}`
      : "";

    // When the user asked about a specific line, add an instruction to find it
    const lineInstruction =
      ref?.line
        ? `\n\nThe user is asking about line ${ref.line}. Count the lines in the provided text and quote the relevant line in your answer.`
        : "";

    const systemPrompt =
      `You are CitationIQ, an expert assistant specialized in citation analysis and academic paper understanding.` +
      `${contextBlock}` +
      `${lineInstruction}\n\n` +
      `Citation Intent Definitions:\n` +
      `- Background: Provides foundational knowledge or context for the research\n` +
      `- Motivation: Inspired or motivated the current research direction\n` +
      `- Future Work: Suggests areas or methods for future exploration\n` +
      `- Similarities: Presents similar approaches, findings, or methodologies\n` +
      `- Differences: Highlights contrasting approaches or different findings\n` +
      `- Uses: Method, tool, dataset, or code directly adopted/used\n` +
      `- Extends: This work builds upon or extends the cited work\n\n` +
      `You have access to the paper content above. Your role is to:\n` +
      `1. Explain citation intents and their significance in academic research\n` +
      `2. Summarize the paper and its key contributions\n` +
      `3. Provide specific information from requested pages or lines\n` +
      `4. Explain how citations relate to and support the main research\n` +
      `5. Clarify academic concepts and relationships between papers\n\n` +
      `Guidelines:\n` +
      `- Answer concisely and academically\n` +
      `- Reference specific passages from the paper when relevant\n` +
      `- If asked about a specific citation's intent (e.g., "Citation 3 intent"), ALWAYS reference the model's prediction from the provided citations list above\n` +
      `- Do NOT infer or guess citation intents - use only the predictions provided\n` +
      `- If asked about content outside the provided context, say so clearly\n` +
      `- Help users understand the structure and significance of citations\n` +
      `- For page/line references, locate and quote the exact content\n` +
      `- If information is not in the provided text, suggest the user check that specific section`;

    // ── Call Groq ─────────────────────────────────────────────────────────
    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model      : GROQ_MODEL,
        max_tokens : 768,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: question.trim().slice(0, 500) },
        ],
      }),
    });

    if (!groqResponse.ok) {
      const error = await groqResponse.text();
      console.error("Groq API error:", error);
      if (groqResponse.status === 429) {
        return NextResponse.json(
          { error: "Rate limit reached. Please wait a moment and try again." },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: "Failed to get response from Groq" },
        { status: 500 },
      );
    }

    const data = await groqResponse.json();
    const answer = data.choices?.[0]?.message?.content || "No response generated";

    return NextResponse.json({ answer, model: GROQ_MODEL, usage: data.usage });

  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}