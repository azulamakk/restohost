import Anthropic from '@anthropic-ai/sdk';
import type {
  Call,
  ClassifiedCall,
  ErrorCode,
  Severity,
} from './types.ts';
import { ERROR_META } from './types.ts';

// ─── Spam / STT helpers ───────────────────────────────────────────────────────

const SPAM_KEYWORDS = [
  'google business',
  'system shows numerous',
  'tablet or personal device',
  'personal device is turned on',
  'received hasn',
  'make sure your tablet',
];

const BROKEN_PROMISE_KEYWORDS = [
  'check your messages',
  'sent your information',
  'sms with the details',
  'receive an sms',
  'you should receive',
  'te mando',
  'mensaje de texto con',
  'te envío',
  'te voy a enviar',
  'te lo mando',
];

const SPANISH_MARKERS = [
  'gracias', 'hola', 'cómo', 'por favor', 'sí,', 'está', 'ayudar',
  'quiero', 'puedo', 'pedido', 'hablar', 'claro', 'enviar', 'también',
];

function countOccurrences(text: string, pattern: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.toLowerCase().indexOf(pattern.toLowerCase(), pos)) !== -1) {
    count++;
    pos += pattern.length;
  }
  return count;
}

function hasSpanish(text: string): boolean {
  const lower = text.toLowerCase();
  return SPANISH_MARKERS.filter((m) => lower.includes(m)).length >= 2;
}

// ─── Pre-compute repeat callers ───────────────────────────────────────────────

function buildRepeatCallerMap(calls: Call[]): Map<string, string[]> {
  const phoneToReasons = new Map<string, string[]>();
  for (const call of calls) {
    if (!phoneToReasons.has(call.phone)) phoneToReasons.set(call.phone, []);
    phoneToReasons.get(call.phone)!.push(call.reasonForCalling);
  }
  // Keep only callers with 3+ calls for the same reason
  const repeatMap = new Map<string, string[]>();
  for (const [phone, reasons] of phoneToReasons) {
    const reasonCounts = new Map<string, number>();
    for (const r of reasons) {
      reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
    }
    const frustReason = [...reasonCounts.entries()].find(([, c]) => c >= 3);
    if (frustReason) repeatMap.set(phone, reasons);
  }
  return repeatMap;
}

// ─── Deterministic rule-based classifier ─────────────────────────────────────

type RuleResult = {
  matched: boolean;
  errorCode: ErrorCode;
  description: string;
  whyItMatters: string;
  proposedFix: string;
  confidence: number;
};

function applyRules(
  call: Call,
  repeatCallerMap: Map<string, string[]>,
): RuleResult | null {
  const conv = call.conversation;
  const convLower = conv.toLowerCase();

  // Rule 1: BROKEN_PROMISE
  const promiseKeywordFound = BROKEN_PROMISE_KEYWORDS.some((kw) =>
    convLower.includes(kw.toLowerCase()),
  );
  if (promiseKeywordFound && call.textsSent.length === 0) {
    return {
      matched: true,
      errorCode: 'BROKEN_PROMISE',
      description: `The agent verbally confirmed that an SMS was sent, but no SMS appears in the textsSent field. Reason for call: "${call.reasonForCalling}".`,
      whyItMatters:
        'The customer is waiting for a confirmation that will never arrive. For reservations, this means no verified booking exists in the system. For other cases, the customer loses trust in the assistant.',
      proposedFix:
        "Verify the SMS sender integration for this flow. If the SMS cannot be sent reliably, the agent must NOT claim it was sent. Add a fallback: if SMS fails, the agent should say 'I was unable to send the confirmation — please call back or visit us directly.'",
      confidence: 0.97,
    };
  }

  // Rule 2: UNFILTERED_SPAM
  if (
    call.callEndReason === 'AgentHangup' &&
    SPAM_KEYWORDS.some((kw) => convLower.includes(kw.toLowerCase()))
  ) {
    return {
      matched: true,
      errorCode: 'UNFILTERED_SPAM',
      description: `A commercial solicitation call was received and processed by the assistant before being hung up. Duration: ${call.callDurationSeconds}s.`,
      whyItMatters:
        'The assistant spent time and API tokens responding to a spam call instead of filtering it immediately. These calls also inflate transfer and error metrics.',
      proposedFix:
        'Add a pre-response spam filter: detect commercial solicitation keywords in the first customer message and immediately hang up or redirect without engaging. Maintain a keyword blacklist.',
      confidence: 0.99,
    };
  }

  // Rule 3: STT_FAILURE
  const imCount = countOccurrences(conv, "I'm ...");
  const stillThereCount = countOccurrences(conv, 'are you still');
  const helloCount = countOccurrences(conv, 'Hello?');
  if (imCount >= 2 || stillThereCount >= 2 || (imCount >= 1 && stillThereCount >= 1)) {
    return {
      matched: true,
      errorCode: 'STT_FAILURE',
      description: `The voice recognition system failed to process the caller's audio. The agent produced "${imCount}x 'I'm...'" and checked "are you still there" ${stillThereCount}x.`,
      whyItMatters:
        "The customer is speaking but the assistant cannot hear them, leading to a confusing experience. This is a system-level failure that may be caused by background noise, codec issues, or STT service degradation.",
      proposedFix:
        "Implement a STT failure detection threshold: if the agent cannot process audio after 2 attempts, automatically offer a transfer to a human agent instead of looping. Also investigate whether specific phone carriers or environments correlate with these failures.",
      confidence: 0.95,
    };
  }

  // Rule 4: NULL_CLASSIFICATION
  if (
    (!call.reasonForCalling || call.reasonForCalling === 'Unclassified') &&
    call.conversation.length > 100
  ) {
    return {
      matched: true,
      errorCode: 'NULL_CLASSIFICATION',
      description: `The call reason is "${call.reasonForCalling || 'empty'}" despite a conversation with ${call.conversation.length} characters of content.`,
      whyItMatters:
        'Unclassified calls cannot be analyzed, tracked, or used to improve the system. They represent blind spots in the monitoring pipeline.',
      proposedFix:
        'Review the intent classification logic for calls that end with no category. Add a post-call classification step that re-classifies calls based on conversation content when the real-time classifier fails.',
      confidence: 0.9,
    };
  }

  // Rule 5: REPEAT_CALLER
  if (repeatCallerMap.has(call.phone)) {
    return {
      matched: true,
      errorCode: 'REPEAT_CALLER',
      description: `Phone token ${call.phone} has called 3 or more times for the same reason: "${call.reasonForCalling}". The issue was not resolved in previous calls.`,
      whyItMatters:
        'Repeat calls for the same unresolved issue indicate a systematic failure to help this type of customer. Each repeat call is a signal of frustration and wasted capacity.',
      proposedFix:
        "Add repeat-caller detection: when the same phone number calls 2+ times for the same reason within a short window, escalate to a human agent immediately instead of repeating the same failed flow. Log these patterns for KB improvement.",
      confidence: 0.88,
    };
  }

  // Rule 6: LANGUAGE_MISMATCH
  if (call.restaurantName === 'RT Buckhead' && hasSpanish(conv)) {
    // Only flag if the agent is responding in Spanish, not the customer
    const agentLines = conv
      .split('\n')
      .filter((l) => l.startsWith('Assistant:'))
      .join(' ')
      .toLowerCase();
    if (SPANISH_MARKERS.filter((m) => agentLines.includes(m)).length >= 2) {
      return {
        matched: true,
        errorCode: 'LANGUAGE_MISMATCH',
        description: `The RT Buckhead assistant (expected: English) responded with Spanish phrases in this call.`,
        whyItMatters:
          'RT Buckhead serves primarily English-speaking customers. Unexpected Spanish responses can confuse callers who do not speak Spanish.',
        proposedFix:
          'Review the system prompt for RT Buckhead to ensure the language instruction is strict. Check whether any knowledge base entries contain Spanish phrases that bleed into responses.',
        confidence: 0.82,
      };
    }
  }

  return null;
}

// ─── LLM-based classifier ─────────────────────────────────────────────────────

const TAXONOMY_DESCRIPTION = `
ERROR TAXONOMY:
- BROKEN_PROMISE: Agent says it sent an SMS/confirmation but the textsSent field is empty. CRITICAL.
- AVOIDABLE_TRANSFER: Agent fully answers the customer's question or sends a link, but still transfers the call. The transfer adds no value. HIGH.
- STT_FAILURE: Agent outputs repeated "I'm ..." or repeatedly asks "Are you still there?" — voice recognition failed. HIGH.
- INCOMPLETE_FLOW: Agent collects all reservation details (name, date, time, party) but never confirms or delivers a result. HIGH.
- NULL_CLASSIFICATION: Call has meaningful conversation content but reasonForCalling is empty or "Unclassified". MEDIUM.
- UNFILTERED_SPAM: AgentHangup call that is clearly a commercial solicitation. MEDIUM.
- REPEAT_CALLER: Same caller calling multiple times for the same unresolved issue. MEDIUM.
- LANGUAGE_MISMATCH: RT Buckhead agent responds in Spanish during an English call. LOW.
- CORRECT_BEHAVIOR: Transfer was necessary (lost items, legitimate manager request, complex multi-part issue), or the call resolved cleanly. NOT an error.
- NO_ERROR: Short call that answered a question correctly, clean resolution, or appropriate behavior for the situation.

KEY DISTINCTIONS:
- NOT every CallTransfer is an error. Lost items, legitimate manager requests, after-hours calls = CORRECT_BEHAVIOR.
- NOT every short call is spam. A clean "do you take reservations? no, walk-in only" answered in 20s = NO_ERROR.
- NOT every human-request transfer is an error — sometimes it is the right response.
- AVOIDABLE_TRANSFER: Only flag if the agent clearly completed its purpose (sent link, answered question) AND THEN transferred anyway.
`;

interface LlmClassification {
  errorCode: ErrorCode;
  isError: boolean;
  description: string;
  whyItMatters: string;
  proposedFix: string;
  confidence: number;
}

async function classifyWithLlm(
  client: Anthropic,
  call: Call,
  cacheSystemPrompt: boolean,
): Promise<LlmClassification> {
  const systemPrompt = `You are an AI quality analyst for RestoHost, a company that operates voice AI assistants in restaurants. Your job is to evaluate call records and classify whether the assistant failed.

${TAXONOMY_DESCRIPTION}

Always respond with valid JSON matching this exact structure:
{
  "errorCode": "<code from taxonomy>",
  "isError": <true|false>,
  "description": "<1-2 sentences describing what happened>",
  "whyItMatters": "<1 sentence on the business impact>",
  "proposedFix": "<1-2 sentences of a concrete fix>",
  "confidence": <0.0-1.0>
}`;

  const userMessage = `Evaluate this call record:

Restaurant: ${call.restaurantName}
Duration: ${call.callDurationSeconds}s
End Reason: ${call.callEndReason}
Reason For Calling: ${call.reasonForCalling || '(empty)'}
Party Size: ${call.partySizeNumber ?? 'N/A'}
SMS Sent: ${call.textsSent.length > 0 ? call.textsSent.join(', ') : 'none'}
Office Hours: ${call.callWithinOfficeHours}

Conversation:
${call.conversation.slice(0, 900)}

Classify this call using the error taxonomy. Output only the JSON.`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ];

  const systemContent: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: systemPrompt,
      ...(cacheSystemPrompt ? { cache_control: { type: 'ephemeral' } } : {}),
    },
  ];

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: systemContent,
    messages,
  });

  const raw = (response.content[0] as Anthropic.TextBlock).text.trim();
  // Extract JSON from possible markdown fences
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`LLM returned non-JSON: ${raw.slice(0, 100)}`);

  const parsed = JSON.parse(jsonMatch[0]) as LlmClassification;
  return parsed;
}

// ─── Mock classifier (MOCK_LLM=true) ─────────────────────────────────────────

function mockClassify(call: Call): LlmClassification {
  // Simple heuristic for mock mode
  const conv = call.conversation.toLowerCase();

  if (
    call.callEndReason === 'CallTransfer' &&
    call.textsSent.length > 0 &&
    (conv.includes('link') || conv.includes('enlace'))
  ) {
    return {
      errorCode: 'AVOIDABLE_TRANSFER',
      isError: true,
      description:
        'Agent sent the online order link and then transferred the call unnecessarily.',
      whyItMatters:
        'The customer already received what they needed, making the transfer an avoidable operational cost.',
      proposedFix:
        'End the call after confirming the customer received and understood the link, without transferring.',
      confidence: 0.8,
    };
  }

  if (
    call.callEndReason === 'UserHangup' &&
    call.callDurationSeconds < 20 &&
    call.reasonForCalling.includes('Reservation') &&
    call.restaurantName === 'TF Oakwood'
  ) {
    return {
      errorCode: 'NO_ERROR',
      isError: false,
      description:
        "TF Oakwood correctly informed the customer they don't accept reservations.",
      whyItMatters: 'N/A',
      proposedFix: 'N/A',
      confidence: 0.9,
    };
  }

  return {
    errorCode: 'NO_ERROR',
    isError: false,
    description: 'No error detected based on available signals.',
    whyItMatters: 'N/A',
    proposedFix: 'N/A',
    confidence: 0.7,
  };
}

// ─── Main classifier ──────────────────────────────────────────────────────────

export async function classifyCalls(calls: Call[]): Promise<ClassifiedCall[]> {
  const useMock = process.env.MOCK_LLM === 'true';
  const apiKey = process.env.ANTHROPIC_API_KEY;

  let client: Anthropic | null = null;
  if (!useMock) {
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set. Set MOCK_LLM=true for demo mode.');
    client = new Anthropic({ apiKey });
  }

  const repeatCallerMap = buildRepeatCallerMap(calls);
  const results: ClassifiedCall[] = [];

  console.log(`Classifying ${calls.length} calls (mode: ${useMock ? 'mock' : 'llm'})...`);

  let llmCallCount = 0;

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i]!;

    // Try rules first
    const ruleResult = applyRules(call, repeatCallerMap);

    if (ruleResult) {
      const meta = ERROR_META[ruleResult.errorCode];
      results.push({
        ...call,
        errorCode: ruleResult.errorCode,
        errorLabel: meta.label,
        severity: meta.severity,
        isError: ruleResult.errorCode !== 'CORRECT_BEHAVIOR' && ruleResult.errorCode !== 'NO_ERROR',
        description: ruleResult.description,
        whyItMatters: ruleResult.whyItMatters,
        proposedFix: ruleResult.proposedFix,
        confidence: ruleResult.confidence,
        source: 'rule',
      });
      continue;
    }

    // Fall through to LLM
    try {
      let llmResult: LlmClassification;
      if (useMock) {
        llmResult = mockClassify(call);
      } else {
        // Use prompt caching for all calls (system prompt cached after first call)
        llmResult = await classifyWithLlm(client!, call, llmCallCount === 0);
        llmCallCount++;
        // Small delay to avoid rate limiting
        if (llmCallCount % 10 === 0) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      const meta = ERROR_META[llmResult.errorCode] ?? ERROR_META['NO_ERROR']!;
      results.push({
        ...call,
        errorCode: llmResult.errorCode,
        errorLabel: meta.label,
        severity: meta.severity,
        isError: llmResult.isError,
        description: llmResult.description,
        whyItMatters: llmResult.whyItMatters,
        proposedFix: llmResult.proposedFix,
        confidence: llmResult.confidence,
        source: 'llm',
      });
    } catch (err) {
      console.warn(`LLM classification failed for ${call.conversationId}: ${err}`);
      results.push({
        ...call,
        errorCode: 'NO_ERROR',
        errorLabel: ERROR_META['NO_ERROR']!.label,
        severity: 'NONE' as Severity,
        isError: false,
        description: 'Classification failed — defaulting to no error.',
        whyItMatters: '',
        proposedFix: '',
        confidence: 0,
        source: 'none',
      });
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  Progress: ${i + 1}/${calls.length} calls classified`);
    }
  }

  const errors = results.filter((r) => r.isError).length;
  const llmUsed = results.filter((r) => r.source === 'llm').length;
  console.log(`Classification complete: ${errors} errors found, ${llmUsed} LLM calls made`);

  return results;
}
