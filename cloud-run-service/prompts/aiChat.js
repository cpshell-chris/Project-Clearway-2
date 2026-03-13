/**
 * AI Chat system prompt builder.
 * When the Chrome extension passes a full systemPrompt inside context,
 * we use it directly so the extension controls the prompt entirely.
 */
export function buildAISystemPrompt(module, context) {
  if (context?.systemPrompt) {
    return context.systemPrompt;
  }
  return "You are a helpful automotive service assistant for Cardinal Plaza Shell.";
}
