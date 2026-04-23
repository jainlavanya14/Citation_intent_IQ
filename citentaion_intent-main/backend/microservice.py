import json
import numpy as np
import torch
import torch.nn as nn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModel
from huggingface_hub import hf_hub_download
from pathlib import Path

# ── constants ─────────────────────────────────────────────────────
INTENTS = [
    "Background", "Motivation", "Future Work",
    "Similarities", "Differences", "Uses", "Extends"
]
N_CLS      = len(INTENTS)
MODEL_NAME = "allenai/scibert_scivocab_uncased"
MAX_LEN    = 64
device     = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── load thresholds from m3_results.json ─────────────────────────
RESULTS_PATH = Path("m3_results.json")
if not RESULTS_PATH.exists():
    raise FileNotFoundError(
        "m3_results.json not found. Copy it to the backend folder."
    )

with open(RESULTS_PATH) as f:
    m3_results = json.load(f)

thresholds_dict = m3_results["thresholds"]
THRESHOLDS      = np.array([thresholds_dict[intent] for intent in INTENTS])
BEST_HP         = m3_results.get("best_hp", {"lr": 3e-5, "gamma": 2.0})
METRICS         = m3_results.get("metrics", {})

print(f"✓ Thresholds loaded : {thresholds_dict}")
print(f"✓ Best HP from T3   : {BEST_HP}")
print(f"✓ Device            : {device}")

# ── model definition — must match notebook exactly ────────────────
class SciBERTClassifier(nn.Module):
    def __init__(self, dropout=0.3):
        super().__init__()
        self.enc  = AutoModel.from_pretrained(MODEL_NAME)
        self.drop = nn.Dropout(dropout)
        self.head = nn.Linear(self.enc.config.hidden_size, N_CLS)

    def forward(self, input_ids, attention_mask):
        out = self.enc(input_ids=input_ids, attention_mask=attention_mask)
        cls = out.last_hidden_state[:, 0]
        return self.head(self.drop(cls))


print("Downloading model from HuggingFace Hub...")
MODEL_PATH = hf_hub_download(
    repo_id  = "singhpuranpal/citation-intent-scibert",
    filename = "scibert_focal.pt",
)

print("Loading SciBERT tokenizer and model weights...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model     = SciBERTClassifier().to(device)
model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
model.eval()
print(f"✓ Model ready on {device}")

# ── FastAPI ───────────────────────────────────────────────────────
app = FastAPI(
    title       = "Citation Intent Classifier API",
    description = "Classifies citation intent using SciBERT (Focal Loss + Oversampling)",
    version     = "1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_methods = ["*"],
    allow_headers = ["*"],
)

# ── schemas ───────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    text: str

class IntentScore(BaseModel):
    intent     : str
    confidence : float
    predicted  : bool
    description: str

class PredictResponse(BaseModel):
    text              : str
    predicted_intents : list[str]
    all_scores        : list[IntentScore]
    model_info        : dict

# ── intent descriptions ───────────────────────────────────────────
INTENT_DESCRIPTIONS = {
    "Background"  : "Provides foundational context or knowledge",
    "Motivation"  : "Inspired or motivated this research",
    "Future Work" : "Suggested for future exploration",
    "Similarities": "Has similar approaches or findings",
    "Differences" : "Differs from this research",
    "Uses"        : "Method or tool directly adopted",
    "Extends"     : "This work builds upon the cited work",
}

# ── inference ─────────────────────────────────────────────────────
def run_inference(text: str):
    enc = tokenizer(
        text,
        max_length     = MAX_LEN,
        padding        = "max_length",
        truncation     = True,
        return_tensors = "pt",
    )
    ids  = enc["input_ids"].to(device)
    mask = enc["attention_mask"].to(device)

    with torch.no_grad():
        logits = model(ids, mask)
        probs  = torch.sigmoid(logits).cpu().numpy()[0]

    # apply per-class thresholds from T2
    predicted = [
        INTENTS[i]
        for i, p in enumerate(probs)
        if p > THRESHOLDS[i]
    ]

    # fallback — nothing crosses threshold, take highest
    if not predicted:
        predicted = [INTENTS[int(np.argmax(probs))]]

    all_scores = [
        IntentScore(
            intent      = intent,
            confidence  = round(float(probs[i]), 4),
            predicted   = intent in predicted,
            description = INTENT_DESCRIPTIONS[intent],
        )
        for i, intent in enumerate(INTENTS)
    ]

    all_scores.sort(key=lambda x: x.confidence, reverse=True)
    return predicted, all_scores

# ── routes ────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "message"  : "Citation Intent Classifier API is running",
        "model"    : "SciBERT + Focal Loss (T1)",
        "device"   : str(device),
        "endpoints": {
            "POST /predict" : "Predict citation intent from text",
            "GET  /health"  : "Health check",
            "GET  /intents" : "List all intent classes with thresholds",
            "GET  /model"   : "Full model info and M3 metrics",
        }
    }

@app.get("/health")
def health():
    return {
        "status" : "ok",
        "device" : str(device),
        "model"  : str(MODEL_PATH),
        "gpu"    : torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU only",
    }

@app.get("/intents")
def get_intents():
    return {
        "intents"     : INTENTS,
        "thresholds"  : thresholds_dict,
        "descriptions": INTENT_DESCRIPTIONS,
        "count"       : N_CLS,
    }

@app.get("/model")
def model_info():
    return {
        "model_name" : MODEL_NAME,
        "checkpoint" : str(MODEL_PATH),
        "technique"  : "T1 — Focal Loss + Oversampling",
        "thresholds" : thresholds_dict,
        "best_hp"    : BEST_HP,
        "max_len"    : MAX_LEN,
        "device"     : str(device),
        "num_classes": N_CLS,
        "classes"    : INTENTS,
        "m3_metrics" : {
            "m2_baseline_macro_f1" : METRICS.get("m2_baseline", {}).get("macro_f1", "N/A"),
            "t1_focal_macro_f1"    : METRICS.get("t1_focal",    {}).get("macro_f1", "N/A"),
            "t2_ensemble_macro_f1" : METRICS.get("t2_ensemble", {}).get("macro_f1", "N/A"),
            "t3_final_macro_f1"    : METRICS.get("t3_final",    {}).get("macro_f1", "N/A"),
        }
    }

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    if len(req.text) > 5000:
        raise HTTPException(status_code=400, detail="Text too long. Max 5000 characters.")

    predicted, all_scores = run_inference(req.text.strip())

    return PredictResponse(
        text              = req.text,
        predicted_intents = predicted,
        all_scores        = all_scores,
        model_info        = {
            "model"    : "SciBERT + Focal Loss (T1)",
            "device"   : str(device),
            "threshold": "per-class tuned (T2)",
            "max_len"  : MAX_LEN,
        }
    )

# ── run ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "microservice:app",
        host   = "0.0.0.0",
        port   = 8000,
        reload = True,
    )