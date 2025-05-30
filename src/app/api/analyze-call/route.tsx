// src/app/api/analyze-call/route.ts
import { NextResponse } from 'next/server';
// We can comment out OpenAI import if no actual calls are made
// import OpenAI from 'openai';

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

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
  // API Key check is less critical now if we're fully mocking, but good to keep if you might re-enable
  // if (!process.env.OPENAI_API_KEY) {
  //   console.error("OpenAI API key not configured.");
  //   return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  // }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audioFile') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file uploaded." }, { status: 400 });
    }

    // --- MOCK TRANSCRIPTION (from previous step) ---
    console.log("Using MOCKED transcript.");
    const transcript = `Agent: Hello, thank you for calling Company X, my name is Alex. How can I help you today?
Customer: Hi Alex, I'm calling about a charge on my bill that I don't understand. It's for $25.
Agent: I can certainly look into that for you. Could I please have your account number or the phone number associated with your account?
Customer: Sure, my phone number is 555-123-4567.
Agent: Thank you. One moment while I pull up your account... Okay, I see the charge. It appears to be for the premium widget service you signed up for last month.
Customer: I don't remember signing up for that! Can you tell me more?
Agent: Yes, it looks like it was added on the 15th. Our records show it was an online activation.
Customer: I definitely didn't do that. I want it removed and a refund.
Agent: I understand your frustration. Let me see what I can do about removing the service and processing a credit for you. I need to check a few things.
Customer: Okay, please do. I expect this to be resolved.
Agent: I appreciate your patience. Yes, I can remove the premium widget service immediately and I've processed a credit of $25 back to your account. It should reflect in 3-5 business days. Is there anything else I can assist you with today?
Customer: No, that's great. Thank you for fixing it, Alex.
Agent: You're very welcome! Thank you for calling Company X. Have a great day!
Customer: You too, bye.`;
    // --- END OF MOCK TRANSCRIPTION ---

    // --- FULLY MOCKING AI ANALYSIS DUE TO QUOTA ISSUES ---
    console.log("Using FULLY MOCKED AI analysis results due to OpenAI quota issues.");

    const mockedScores: Record<string, number> = {};
    callEvaluationParameters.forEach(param => {
      if (param.inputType === "PASS_FAIL") {
        // Example: Randomly pass or fail for mocked data
        mockedScores[param.key] = Math.random() > 0.3 ? param.weight : 0; // More likely to pass
      } else if (param.inputType === "SCORE") {
        // Example: Random score within the weight for mocked data
        mockedScores[param.key] = Math.floor(Math.random() * (param.weight * 0.8)) + Math.floor(param.weight * 0.2); // Score mostly in upper range
      }
    });
    // Ensure some specific scores for variety if desired for the mock
    mockedScores["greeting"] = 5;
    mockedScores["callEtiquette"] = 12;
    mockedScores["fatalTapeDiscloser"] = 0;


    const overallFeedback = "MOCKED: The agent handled the call professionally and resolved the customer's issue effectively regarding the bill charge. Tone was empathetic.";
    const observation = "MOCKED: Customer was initially frustrated about an incorrect charge but was satisfied after the agent provided a quick resolution and refund.";
    // --- END OF FULLY MOCKED AI ANALYSIS ---


    // Simulate a small delay as if AI processing happened
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay


    const apiResponse = {
      transcript: transcript,
      scores: mockedScores,
      overallFeedback: overallFeedback,
      observation: observation
    };

    return NextResponse.json(apiResponse, { status: 200 });

  } catch (error: any) {
    console.error("Error in /api/analyze-call (fully mocked):", error.message);
    return NextResponse.json({ error: "Failed to process audio (mocked).", details: error.message }, { status: 500 });
  }
}