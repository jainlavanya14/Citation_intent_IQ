import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

export async function POST(req: NextRequest) {
  try {
    const { question, paperText, intents } = await req.json();

    // validate
    if (!question || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Groq API key not configured" },
        { status: 500 }
      );
    }

    // build context from paper text and detected intents
    const intentContext = intents && intents.length > 0
      ? `\nDetected Citation Intents: ${intents.join(", ")}`
      : "";

    const paperContext = paperText && paperText.trim()
      ? `\nCitation Text: "${paperText}"`
      : "";

    // system prompt — tells Groq how to behave
    const systemPrompt = `You are an expert academic research assistant specializing in citation analysis and scientific literature.

    You help researchers understand citation intents and relationships between academic papers.

    You have access to the following context:
    ${paperContext}
    ${intentContext}

    Your role:
    - Answer questions about the citation text and its intent
    - Explain what each citation intent means in the context of the paper
    - Help researchers understand how papers relate to each other
    - Provide clear, concise, and academically informed responses

    Citation Intent definitions:
    - Background: The cited work provides foundational knowledge or context
    - Motivation: The cited work inspired or motivated this research  
    - Future Work: The cited work is suggested for future exploration
    - Similarities: The cited work has similar approaches or findings
    - Differences: The cited work differs from this research
    - Uses: The cited work's method/tool/dataset is directly used
    - Extends: This work extends or builds upon the cited work

    Always base your answers on the provided citation text and detected intents.
    Keep responses concise and helpful. Use academic but accessible language.`;

    // call Groq API
    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model     : GROQ_MODEL,
        max_tokens: 1024,
        temperature: 0.7,
        messages  : [
          {
            role   : "system",
            content: systemPrompt,
          },
          {
            role   : "user",
            content: question,
          },
        ],
      }),
    });

    if (!groqResponse.ok) {
      const error = await groqResponse.text();
      console.error("Groq API error:", error);
      return NextResponse.json(
        { error: "Failed to get response from Groq" },
        { status: 500 }
      );
    }

    const data = await groqResponse.json();
    const answer = data.choices?.[0]?.message?.content || "No response generated";

    return NextResponse.json({
      answer,
      model : GROQ_MODEL,
      usage : data.usage,
    });

  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}