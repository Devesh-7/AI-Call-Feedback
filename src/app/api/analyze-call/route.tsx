// src/app/api/analyze-call/route.ts
import { NextResponse } from 'next/server';
// OpenAI import can be removed if no part of its SDK is used.
// import OpenAI from 'openai';
import { DeepgramClient, PrerecordedTranscriptionOptions } from '@deepgram/sdk';

// OpenAI client initialization can be removed if no GPT calls are made.
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// Initialize Deepgram client (for transcription)
const deepgram = new DeepgramClient(process.env.DEEPGRAM_API_KEY || "");

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

// Helper functions getLLMResponse and parseNumericScore are no longer needed if analysis is fully mocked.

export async function POST(request: Request) {
  if (!process.env.DEEPGRAM_API_KEY) {
    console.error("Deepgram API key not configured.");
    return NextResponse.json({ error: "Server configuration error: Deepgram API key missing." }, { status: 500 });
  }
  // OpenAI API key check can be removed if not used for analysis.
  // if (!process.env.OPENAI_API_KEY) {
  //   console.error("OpenAI API key not configured.");
  //   return NextResponse.json({ error: "Server configuration error: OpenAI API key missing." }, { status: 500 });
  // }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audioFile') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file uploaded." }, { status: 400 });
    }

    // --- Live Transcription with Deepgram ---
    console.log(`Transcribing audio file: ${audioFile.name} using Deepgram...`);
    let transcript = "";
    try {
      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

      const { result, error: deepgramError } = await deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          smart_format: true,
          punctuate: true,
        } as PrerecordedTranscriptionOptions
      );

      if (deepgramError) {
        console.error("Deepgram transcription error:", deepgramError);
        // Attempt to get more specific error details from Deepgram if possible
        const details = typeof deepgramError === 'object' && deepgramError !== null && 'message' in deepgramError ? String((deepgramError as any).message) : String(deepgramError);
        const status = typeof deepgramError === 'object' && deepgramError !== null && 'status' in deepgramError ? Number((deepgramError as any).status) : 500;
        return NextResponse.json({ error: "Audio transcription failed (Deepgram).", details }, { status });
      }
      
      transcript = result?.results.channels[0].alternatives[0].transcript || "";
      console.log("Deepgram transcription successful.");

    } catch (transcriptionError: any) { // Catch any other unexpected errors during Deepgram call
      console.error("Deepgram transcription process failed unexpectedly:", transcriptionError);
      const details = transcriptionError.message || String(transcriptionError);
      return NextResponse.json({ error: "Audio transcription processing error (Deepgram).", details }, { status: 500 });
    }
    // --- End of Live Transcription with Deepgram ---

    // --- MOCKED AI Analysis (Scores, Feedback, Observation) ---
    // This part no longer calls OpenAI GPT due to quota issues.
    // We use the 'transcript' from Deepgram conceptually but generate mock results.
    console.log("Using MOCKED analysis results (scores, feedback, observation). Transcript length:", transcript.length);

    const mockedScores: Record<string, number> = {};
    callEvaluationParameters.forEach(param => {
      if (param.inputType === "PASS_FAIL") {
        // Example: If transcript mentions the parameter description's keywords, pass. (Very basic)
        // This is just a placeholder for more sophisticated mock logic if needed.
        if (transcript.toLowerCase().includes(param.desc.split(" ")[0].toLowerCase())) { // check first word of desc
             mockedScores[param.key] = param.weight;
        } else {
             mockedScores[param.key] = Math.random() > 0.4 ? param.weight : 0; // Fallback random
        }
      } else if (param.inputType === "SCORE") {
        mockedScores[param.key] = Math.floor(Math.random() * (param.weight * 0.7)) + Math.floor(param.weight * 0.3); // Score generally > 30%
      }
    });
    // Override some for consistency in mock
    mockedScores["greeting"] = transcript.toLowerCase().startsWith("hello") || transcript.toLowerCase().startsWith("hi") ? 5 : 0;
    mockedScores["callEtiquette"] = 10 + Math.floor(Math.random() * 6); // Score between 10-15

    const overallFeedback = `MOCKED FEEDBACK: Based on the transcript (length ${transcript.length} chars), the agent interaction was evaluated. Key points were noted.`;
    const observation = `MOCKED OBSERVATION: Key event noted from transcript: first few words were "${transcript.substring(0, 30)}...". Customer sentiment appeared to be neutral to positive.`;
    // --- End of MOCKED AI Analysis ---
    
    // Simulate a small delay as if AI processing happened
    await new Promise(resolve => setTimeout(resolve, 500)); // Shorter delay now

    const apiResponse = {
      transcript: transcript,       // Real transcript from Deepgram
      scores: mockedScores,         // Mocked scores
      overallFeedback: overallFeedback, // Mocked overall feedback
      observation: observation      // Mocked observation
    };

    return NextResponse.json(apiResponse, { status: 200 });

  } catch (error: any) { // Main catch block for unexpected errors
    const rawErrorMessage = error.message || String(error);
    console.error("Critical unexpected error in POST /api/analyze-call:", rawErrorMessage, error);
    return NextResponse.json({ error: "An unexpected server error occurred.", details: rawErrorMessage }, { status: 500 });
  }
}