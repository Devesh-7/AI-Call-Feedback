
import { NextResponse } from 'next/server';
import { createClient, DeepgramClient } from '@deepgram/sdk'; // Use createClient


const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
if (!deepgramApiKey) {
  console.error("FATAL: DEEPGRAM_API_KEY environment variable is not set.");

}

const deepgram: DeepgramClient = createClient(deepgramApiKey || "NO_API_KEY_PROVIDED_WILL_FAIL");


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

export async function POST(request: Request) {
  
  if (!process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY === "NO_API_KEY_PROVIDED_WILL_FAIL") {
    console.error("Deepgram API key is not configured properly.");
    return NextResponse.json({ error: "Server configuration error: Missing or invalid Deepgram API key." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audioFile') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file was uploaded." }, { status: 400 });
    }

    console.log(`Starting transcription for: ${audioFile.name} with Deepgram...`);
    let transcript = "";
    try {
      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

      const transcriptionOptions = {
        model: 'nova-2',
        smart_format: true,
        punctuate: true,
      };

      const { result, error: deepgramError } = await deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        transcriptionOptions
      );

        if (deepgramError) {
        console.error("Deepgram transcription service error:", deepgramError);
        let errorDetails = "Transcription service error.";
        let errorStatus = 500;

       
        if (typeof deepgramError === 'object' && deepgramError !== null) {
           
            const dgErrorObject = deepgramError as unknown as Record<string, unknown>;

            if (typeof dgErrorObject.message === 'string') {
                errorDetails = dgErrorObject.message;
            }
        
            if (typeof dgErrorObject.status === 'number') {
                errorStatus = dgErrorObject.status;
            }
        } else if (typeof deepgramError === 'string') {
            errorDetails = deepgramError;
        }
        return NextResponse.json({ error: "Audio transcription failed via Deepgram.", details: errorDetails }, { status: errorStatus });
      }
      
      transcript = result?.results.channels[0].alternatives[0].transcript || "";
      console.log("Deepgram transcription completed successfully.");

    } catch (transcriptionProcessingError: unknown) {
      console.error("Unexpected error during Deepgram transcription process:", transcriptionProcessingError);
      const details = transcriptionProcessingError instanceof Error ? transcriptionProcessingError.message : String(transcriptionProcessingError);
      return NextResponse.json({ error: "Audio transcription processing error (Deepgram).", details }, { status: 500 });
    }

    console.log("Generating placeholder analysis results. Transcript length:", transcript.length);

    const mockedScores: Record<string, number> = {};
    callEvaluationParameters.forEach(param => {
      if (param.inputType === "PASS_FAIL") {
        mockedScores[param.key] = (transcript.length > 10 && Math.random() > 0.3) ? param.weight : 0;
      } else if (param.inputType === "SCORE") {
        mockedScores[param.key] = Math.floor(Math.random() * (param.weight * 0.6)) + Math.floor(param.weight * 0.2);
      }
    });
    if (transcript.toLowerCase().includes("hello") || transcript.toLowerCase().includes("hi")) {
        mockedScores["greeting"] = 5;
    } else {
        mockedScores["greeting"] = 0;
    }
    mockedScores["callEtiquette"] = Math.min(15, 8 + Math.floor(transcript.length / 50));

    const overallFeedback = `PLACEHOLDER FEEDBACK: Transcript processed (length: ${transcript.length} characters). Evaluation summary pending full AI analysis.`;
    const observation = `PLACEHOLDER OBSERVATION: Key phrases noted from transcript. Example start: "${transcript.substring(0, 40)}...". Further sentiment analysis pending.`;
    
    await new Promise(resolve => setTimeout(resolve, 500));

    const apiResponse = {
      transcript: transcript,
      scores: mockedScores,
      overallFeedback: overallFeedback,
      observation: observation
    };

    return NextResponse.json(apiResponse, { status: 200 });

  } catch (error: unknown) {
    const rawErrorMessage = error instanceof Error ? error.message : String(error);
    console.error("Critical error in API endpoint /api/analyze-call:", rawErrorMessage, error);
    return NextResponse.json({ error: "An unexpected server error occurred processing the request.", details: rawErrorMessage }, { status: 500 });
  }
}