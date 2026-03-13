export function buildRoCopilotSummarySystemPrompt({ cultureProfile }) {
  return `You are an automotive service advisor coaching assistant for ${cultureProfile?.name || "Cardinal Plaza Shell"}.
Your role is to analyze a repair order context and produce a structured JSON coaching summary.
Return only valid JSON with no markdown or preamble.`;
}

export function buildRoCopilotSummaryPrompt({ context, cultureProfile }) {
  return `Analyze this repair order context and return a structured advisor coaching summary as JSON.

Context:
${JSON.stringify(context, null, 2)}

Return JSON matching this structure:
{
  "stage": { "key": "string", "label": "string", "reason": "string" },
  "completedSteps": ["string"],
  "missingNext": ["string"],
  "advisorGuidance": ["string"],
  "concernMap": [],
  "roCompletenessCheck": { "readyForPresentation": false, "blockers": [], "authorizationSummary": { "approved": 0, "declined": 0, "pending": 0, "other": 0 } },
  "salesCoaching": { "prominence": "low", "message": "string", "objectionRisk": "low", "comebackRisk": "low", "talkTrack": [] },
  "questionHelpers": { "groundedFollowUps": [], "helperChips": [] },
  "confidence": { "level": "medium", "note": "string" }
}`;
}

export function buildRoCopilotQuestionSystemPrompt({ cultureProfile, mode }) {
  return `You are an automotive service advisor coaching assistant for ${cultureProfile?.name || "Cardinal Plaza Shell"}.
Mode: ${mode || "advisor"}. Answer the question based on the provided RO context.
Return only valid JSON with no markdown or preamble.`;
}

export function buildRoCopilotQuestionPrompt({ context, cultureProfile, question, mode }) {
  return `Answer this advisor question based on the repair order context.

Question: ${question}
Mode: ${mode || "advisor"}

Context summary:
${JSON.stringify({ stage: context?.workflowStage, concerns: context?.concernMap?.slice(0, 5) }, null, 2)}

Return JSON:
{
  "answer": "string",
  "copyText": "string",
  "groundedFollowUps": ["string"],
  "sources": [],
  "confidence": { "level": "medium", "note": "string" }
}`;
}
