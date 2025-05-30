// src/app/api/analyze-call/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CallEvaluationParameter {
  key: string;
  name: string;
  weight: number;
  desc: string;
  inputType: "PASS_FAIL" | "SCORE";
}

const callEvaluationParameters: CallEvaluationParameter[] = [
  {key: "greeting", name: "Greeting", weight: 5, desc: "Call opening within 5 seconds", inputType: "PASS_FAIL" },
  {key: "collectionUrgency", name: "Collection Urgency", weight: 15, desc: "Create urgency, cross-questioning", inputType: "SCORE" },
  {key: "rebuttalCustomerHandling", name: "Rebuttal Handling", weight: 15, desc: "Address penalties, objections", inputType: "SCORE" },
  {key: "callEtiquette", name: "Call Etiquette", weight: 15, desc: "Tone, empathy, clear speech", inputType: "SCORE" },
  {key: "callDisclaimer", name: "Call Disclaimer", weight: 5, desc: "Take permission before ending", inputType: "PASS_FAIL" },
  {key: "correctDisposition", name: "Correct Disposition", weight: 10, desc: "Use correct category with remark", inputType: "PASS_FAIL" },
  {key: "callClosing", name: "Call Closing", weight: 5, desc: "Thank the customer properly", inputType: "PASS_FAIL" },
  {key: "fatalIdentification", name: "Identification", weight: 5, desc: "Missing agent/customer info", inputType: "PASS_FAIL" },
  {key: "fatalTapeDiscloser", name: "Tape Disclosure", weight: 10, desc: "Inform customer about recording", inputType: "PASS_FAIL" },
  {key: "fatalToneLanguage", name: "Tone & Language", weight: 15, desc: "No abusive or threatening speech", inputType: "PASS_FAIL" }
];

async function getLLMResponse(prompt: string, model: string = "gpt-3.5-turbo"): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 150, // Adjusted for potentially longer feedback/observation
    });
    return completion.choices[0]?.message?.content?.trim() || "";
  } catch (error) {
    const modelInError = model || "OpenAI model";
    console.error(`Error calling ${modelInError}:`, error);
    if (error instanceof OpenAI.APIError && error.status === 429) {
        return "ERROR_QUOTA";
    }
    return "ERROR_API";
  }
}

function parseNumericScore(llmResponseText: string, weight: number, inputType: "PASS_FAIL" | "SCORE"): number {
  if (llmResponseText.startsWith("ERROR_")) return 0;

  const numericMatch = llmResponseText.match(/-?\d+/);
  let score = 0;

  if (numericMatch) {
    score = parseInt(numericMatch[0], 10);
  } else {
    if (inputType === "PASS_FAIL") {
        const lowerResponse = llmResponseText.toLowerCase();
        if (lowerResponse.includes("pass") || lowerResponse.includes("yes") || lowerResponse.includes(String(weight))) return weight;
        if (lowerResponse.includes("fail") || lowerResponse.includes("no") || lowerResponse.includes("0")) return 0;
    }
    return 0; // Default if no clear score found
  }

  if (inputType === "PASS_FAIL") {
    return score > 0 ? weight : 0;
  } else {
    return Math.max(0, Math.min(score, weight));
  }
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OpenAI API key not configured on server.");
    return NextResponse.json({ error: "Server configuration error: OpenAI API key is missing." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audioFile') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file uploaded." }, { status: 400 });
    }

    console.log(`Attempting to transcribe audio file: ${audioFile.name}`);
    let transcript = "";
    try {
        const transcriptionResponse = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
        });
        transcript = transcriptionResponse.text;
        console.log("Whisper transcription successful.");
    } catch (transcriptionError) {
        console.error("Whisper transcription failed:", transcriptionError);
        if (transcriptionError instanceof OpenAI.APIError) {
            return NextResponse.json({
                error: "OpenAI API error during transcription.",
                details: transcriptionError.message,
                type: transcriptionError.type, // Include type for better debugging
                code: transcriptionError.code   // Include code
            }, { status: transcriptionError.status || 500 });
        }
        // For non-OpenAI errors during transcription phase
        const errorMessage = transcriptionError instanceof Error ? transcriptionError.message : "Unknown transcription error";
        return NextResponse.json({ error: "Audio transcription failed.", details: errorMessage }, { status: 500 });
    }

    const generatedScores: Record<string, number> = {};
    let analysisHadQuotaError = false;

    console.log("Starting AI analysis for scores...");
    for (const param of callEvaluationParameters) {
      const scorePrompt = `You are a call quality analyst. Based on the following transcript, evaluate the parameter: "${param.name}".
Description: "${param.desc}".
The transcript is:
"""
${transcript}
"""
This parameter is of type "${param.inputType}".
If type is "PASS_FAIL", the score must be either 0 (Fail) or ${param.weight} (Pass).
If type is "SCORE", the score must be a number between 0 and ${param.weight}.
Strictly provide only the numerical score. Score:`;

      const llmScoreResponse = await getLLMResponse(scorePrompt);
      if (llmScoreResponse === "ERROR_QUOTA") {
          analysisHadQuotaError = true;
          console.warn(`OpenAI Quota error for parameter ${param.name}. Score set to 0.`);
          generatedScores[param.key] = 0;
      } else if (llmScoreResponse === "ERROR_API") {
          console.warn(`OpenAI API error for parameter ${param.name}. Score set to 0.`);
          generatedScores[param.key] = 0;
      } else {
        generatedScores[param.key] = parseNumericScore(llmScoreResponse, param.weight, param.inputType);
      }
      console.log(`Parameter: ${param.name}, Score: ${generatedScores[param.key]}, Raw LLM: "${llmScoreResponse}"`);
    }

    let overallFeedback = "Overall feedback could not be generated due to API issues during scoring.";
    let observation = "Observations could not be generated due to API issues during scoring.";

    if (!analysisHadQuotaError) {
        console.log("Generating overall feedback...");
        const feedbackPrompt = `Based on the following call transcript, provide a concise overall feedback (1-2 sentences) for the agent's performance.
Transcript:
"""
${transcript}
"""
Overall Feedback:`;
        overallFeedback = await getLLMResponse(feedbackPrompt);
        if (overallFeedback.startsWith("ERROR_")) {
            overallFeedback = "Overall feedback generation failed (API error).";
        }

        console.log("Generating observation...");
        const observationPrompt = `Based on the following call transcript, provide a concise observation (1-2 sentences) about key events or customer sentiments.
Transcript:
"""
${transcript}
"""
Observation:`;
        observation = await getLLMResponse(observationPrompt);
        if (observation.startsWith("ERROR_")) {
            observation = "Observation generation failed (API error).";
        }
    }

    const apiResponse = {
      transcript: transcript,
      scores: generatedScores,
      overallFeedback: overallFeedback,
      observation: observation
    };

    return NextResponse.json(apiResponse, { status: 200 });

  } catch (error) { // This is the main catch block for the POST function
    const rawErrorMessage = error instanceof Error ? error.message : String(error);
    console.error("Critical unexpected error in POST /api/analyze-call:", rawErrorMessage, error); // Log the full error too

    if (error instanceof OpenAI.APIError) {
        return NextResponse.json({
            error: "OpenAI API Error (uncaught in specific handler)",
            details: error.message,
            type: error.type,
            code: error.code
        }, { status: error.status || 500 });
    }

    return NextResponse.json({
        error: "An unexpected server error occurred.",
        details: rawErrorMessage
    }, { status: 500 });
  }
} // This brace closes the export async function POST