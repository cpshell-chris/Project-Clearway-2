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

export function buildInterpretDviPrompts({ dviItems, roContext, cultureProfile }) {
  const shopName = cultureProfile?.name || 'Cardinal Plaza Shell';
  const voice    = cultureProfile?.voice || 'Calm, educational, and warm.';
  const system = `You are a service advisor coach at ${shopName}. The technician has submitted the Digital Vehicle Inspection. Analyze all findings and return a structured JSON object — no prose, no markdown wrapper.
Voice: ${voice}
Return ONLY valid JSON matching this exact shape:
{
  "summary": "2-3 sentence factual overview of all findings. Facts only — no sales language.",
  "technicalDetail": [{ "item": "string", "detail": "string" }],
  "callScript": "string — a warm, educational opening for the customer call based on these specific findings.",
  "serviceChecklist": [{ "name": "string", "status": "on-ro | missing" }]
}
For serviceChecklist: list EVERY service implied by DVI findings. Cross-reference roContext jobs to set status "on-ro" if already a job on the RO, "missing" if it needs to be added.`;

  const dviText = Array.isArray(dviItems)
    ? dviItems.map(i => `[${(i.status || 'unknown').toUpperCase()}] ${i.name || i.item || 'Item'}${i.note ? ' — ' + i.note : ''}`).join('\n')
    : String(dviItems || '');

  const user = `DVI Findings:\n${dviText}\n\nRepair Order Context:\n${roContext || 'No RO context provided.'}`;
  return { system, user };
}

export function buildPartLookupPrompts({ itemName, roContext, cultureProfile }) {
  const shopName = cultureProfile?.name || 'Cardinal Plaza Shell';
  const system = `You are a service advisor coach at ${shopName}. When a service advisor asks about a part or system, explain it in plain customer-friendly language: what it does, why it fails, and what happens if it is not addressed. Keep it to 3–5 sentences. No jargon the customer would not understand.`;
  const user = `Part or system: "${itemName || 'Unknown item'}"\n\nVehicle context:\n${roContext || 'No context provided.'}`;
  return { system, user };
}

export function buildObjectionHelpPrompts({ objection, roContext, cultureProfile }) {
  const shopName = cultureProfile?.name || 'Cardinal Plaza Shell';
  const voice    = cultureProfile?.voice || 'Calm, educational, and warm.';
  const system = `You are a service advisor coach at ${shopName}. When a customer raises an objection, provide a calm, specific response the advisor can use. Voice: ${voice}. Do not be pushy. Respect the customer's decision-making autonomy.`;
  const user = `Customer objection: "${objection || 'General objection'}"\n\nRepair order context:\n${roContext || 'No context provided.'}`;
  return { system, user };
}

export function buildExhaustAssistPrompts({ situationType, detail, roContext, history, cultureProfile }) {
  const shopName = cultureProfile?.name || 'Cardinal Plaza Shell';
  const voice    = cultureProfile?.voice || 'Calm, educational, and warm.';
  const situations = {
    supplement: 'The advisor needs to present an unexpected additional item to a customer who has already approved work.',
    delay:      'The vehicle will not be ready on time and the advisor needs to notify the customer.',
    objection:  'The customer has raised an objection after approving the sale.',
    pickup:     'The vehicle is ready and the advisor needs to generate a pickup notification.',
  };
  const context = situations[situationType] || 'The advisor needs post-sale coaching.';
  const system = `You are a service advisor coach at ${shopName}. Situation: ${context} Voice: ${voice}. Provide a ready-to-use script or coaching the advisor can apply immediately.`;
  const prior = (history || []).map(m => ({ role: m.role, content: String(m.content) }));
  const messages = [
    ...prior,
    { role: 'user', content: `${detail || 'Please help with this situation.'}\n\nRO context:\n${roContext || 'No context provided.'}` }
  ];
  // Returns { system, messages } (not { system, user }) — multi-turn format.
  // Use with the Anthropic messages array API directly, NOT with safeAnthropicJsonCall/safeAnthropicTextCall.
  return { system, messages };
}
