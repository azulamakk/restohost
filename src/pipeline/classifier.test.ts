import { describe, test, expect } from 'vitest';
import { classifyCalls } from './classifier.ts';
import type { Call } from './types.ts';

function makeCall(overrides: Partial<Call>): Call {
  return {
    conversationId: 'test-001',
    restaurantName: 'RT Buckhead',
    callStartTime: new Date('2026-03-15T19:00:00Z'),
    callDurationSeconds: 60,
    callEndReason: 'UserHangup',
    callWithinOfficeHours: true,
    reasonForCalling: 'Making a Reservation or Inquiring About Reservations',
    partySizeNumber: null,
    textsSent: [],
    numberOfTextsSent: 0,
    phone: 'CALLER-TEST001',
    conversation: 'Assistant: Hi\nCustomer: Hello',
    ...overrides,
  };
}

// Run in mock mode for tests
process.env.MOCK_LLM = 'true';

describe('Rule-based classifier — BROKEN_PROMISE', () => {
  test('flags BROKEN_PROMISE when agent says "check your messages" but textsSent is empty', async () => {
    const call = makeCall({
      conversation:
        'Assistant: Hi, thanks for calling.\nCustomer: I want to make a reservation.\nAssistant: Great! I just sent your information to our managers, please check your messages you should receive an SMS with the details.',
      textsSent: [],
      reasonForCalling: 'Making a Reservation or Inquiring About Reservations',
    });

    const [result] = await classifyCalls([call]);
    expect(result!.errorCode).toBe('BROKEN_PROMISE');
    expect(result!.isError).toBe(true);
    expect(result!.severity).toBe('CRITICAL');
    expect(result!.source).toBe('rule');
  });

  test('does NOT flag BROKEN_PROMISE when SMS was actually sent', async () => {
    const call = makeCall({
      conversation:
        'Assistant: I just sent your information to our managers, please check your messages.',
      textsSent: ['reservation'],
      numberOfTextsSent: 1,
    });

    const [result] = await classifyCalls([call]);
    expect(result!.errorCode).not.toBe('BROKEN_PROMISE');
  });
});

describe('Rule-based classifier — UNFILTERED_SPAM', () => {
  test('flags UNFILTERED_SPAM for AgentHangup with Google Business keywords', async () => {
    const call = makeCall({
      callEndReason: 'AgentHangup',
      reasonForCalling: 'Unclassified',
      conversation:
        'Assistant: Hi, thanks for calling.\nCustomer: Regarding your Google Business account, Our system shows numerous searches for your business.',
    });

    const [result] = await classifyCalls([call]);
    expect(result!.errorCode).toBe('UNFILTERED_SPAM');
    expect(result!.isError).toBe(true);
    expect(result!.source).toBe('rule');
  });
});

describe('Rule-based classifier — STT_FAILURE', () => {
  test('flags STT_FAILURE when "I\'m ..." appears 2+ times', async () => {
    const call = makeCall({
      callEndReason: 'CallTransfer',
      conversation:
        "Assistant: Hi, thanks for calling!\nCustomer: Hi I left my sunglasses.\nAssistant: I'm ...\nCustomer: Are you there?\nAssistant: I'm ...\nCustomer: Hello?",
    });

    const [result] = await classifyCalls([call]);
    expect(result!.errorCode).toBe('STT_FAILURE');
    expect(result!.severity).toBe('HIGH');
  });
});

describe('Rule-based classifier — NULL_CLASSIFICATION', () => {
  test('flags NULL_CLASSIFICATION for Unclassified call with content', async () => {
    const call = makeCall({
      reasonForCalling: 'Unclassified',
      conversation:
        'Assistant: Hi, thanks for calling!\nCustomer: ¿Me puede ayudar con servicio de pequeño de mil unidades?\nAssistant: Lo siento, no tenemos ese servicio disponible.',
    });

    const [result] = await classifyCalls([call]);
    expect(result!.errorCode).toBe('NULL_CLASSIFICATION');
    expect(result!.source).toBe('rule');
  });

  test('does NOT flag NULL_CLASSIFICATION for empty conversation', async () => {
    const call = makeCall({
      reasonForCalling: '',
      conversation: 'Assistant: Hi',
    });

    const [result] = await classifyCalls([call]);
    expect(result!.errorCode).not.toBe('NULL_CLASSIFICATION');
  });
});

describe('Rule-based classifier — REPEAT_CALLER', () => {
  test('flags REPEAT_CALLER when same phone calls 3+ times for same reason', async () => {
    const calls = [1, 2, 3].map((i) =>
      makeCall({
        conversationId: `test-repeat-${i}`,
        phone: 'CALLER-REPEAT001',
        reasonForCalling: 'Request to speak to a human',
        conversation:
          'Assistant: Hi, how can I help?\nCustomer: I want to speak to a human please.\nAssistant: Sure, connecting you now.',
        callEndReason: 'CallTransfer',
      }),
    );

    const results = await classifyCalls(calls);
    // All 3 should be flagged as REPEAT_CALLER
    const repeatFlags = results.filter((r) => r.errorCode === 'REPEAT_CALLER');
    expect(repeatFlags.length).toBe(3);
  });

  test('does NOT flag caller with only 2 calls as REPEAT_CALLER', async () => {
    const calls = [1, 2].map((i) =>
      makeCall({
        conversationId: `test-two-${i}`,
        phone: 'CALLER-TWOCALLS',
        reasonForCalling: 'Questions About Restaurant Hours and Wait Times',
        conversation:
          'Assistant: Hi!\nCustomer: What time do you close?\nAssistant: We close at 10pm.',
      }),
    );

    const results = await classifyCalls(calls);
    const repeatFlags = results.filter((r) => r.errorCode === 'REPEAT_CALLER');
    expect(repeatFlags.length).toBe(0);
  });
});

describe('Rule-based classifier — CORRECT_BEHAVIOR (no false positives)', () => {
  test('does NOT flag a clean Lost Items transfer as an error', async () => {
    const call = makeCall({
      reasonForCalling: 'Lost Items Inquiries',
      callEndReason: 'CallTransfer',
      callDurationSeconds: 45,
      conversation:
        "Assistant: Hi, thanks for calling RT Buckhead!\nCustomer: Hi, I left my purse there last night.\nAssistant: Let me transfer you to our host who can check lost and found.\nCustomer: Yes please.\nAssistant: Connecting you now.",
      textsSent: [],
    });

    const [result] = await classifyCalls([call]);
    // Should not be BROKEN_PROMISE (no promise made), not STT_FAILURE, not SPAM
    expect(result!.errorCode).not.toBe('BROKEN_PROMISE');
    expect(result!.errorCode).not.toBe('UNFILTERED_SPAM');
    expect(result!.errorCode).not.toBe('STT_FAILURE');
  });

  test('does NOT flag a clean hours inquiry as an error', async () => {
    const call = makeCall({
      reasonForCalling: 'Questions About Restaurant Hours and Wait Times',
      callEndReason: 'UserHangup',
      callDurationSeconds: 17,
      conversation:
        'Assistant: Hi, thanks for calling!\nCustomer: How long is the wait?\nAssistant: The current wait time is about thirty minutes.\nCustomer: Ok, thank you.',
    });

    const [result] = await classifyCalls([call]);
    expect(result!.isError).toBe(false);
  });
});
