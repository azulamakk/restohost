import type {
  Call,
  ClassifiedCall,
  KbGap,
  Opportunity,
  PatternAnalysis,
  RestaurantComparison,
  RestaurantName,
  RestaurantStats,
  TemporalPatterns,
} from './types.ts';

function countBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of arr) {
    const k = key(item);
    result[k] = (result[k] ?? 0) + 1;
  }
  return result;
}

function buildRestaurantStats(calls: Call[], classified: ClassifiedCall[]): RestaurantStats {
  const total = calls.length;
  const classifiedForRest = classified.filter((c) => c.restaurantName === calls[0]?.restaurantName);
  const transfers = calls.filter((c) => c.callEndReason === 'CallTransfer').length;
  const withSms = calls.filter((c) => c.textsSent.length > 0).length;
  const autonomous = calls.filter(
    (c) => c.callEndReason === 'UserHangup' && c.textsSent.length > 0,
  ).length;
  const frustrated = calls.filter((c) => {
    const lower = c.conversation.toLowerCase();
    return ['es una m', "can't hear", 'are you still', 'hablar con', 'representante'].some(
      (m) => lower.includes(m),
    );
  }).length;

  return {
    totalCalls: total,
    callEndReasonDist: countBy(calls, (c) => c.callEndReason),
    reasonForCallingDist: countBy(calls, (c) => c.reasonForCalling || '(empty)'),
    transferRate: total ? transfers / total : 0,
    smsRate: total ? withSms / total : 0,
    autonomousResolutionRate: total ? autonomous / total : 0,
    avgDurationSeconds:
      total
        ? Math.round(calls.reduce((a, c) => a + c.callDurationSeconds, 0) / total)
        : 0,
    frustrationRate: total ? frustrated / total : 0,
  };
}

export function analyzePatterns(
  calls: Call[],
  classified: ClassifiedCall[],
): PatternAnalysis {
  // ── Temporal patterns ──────────────────────────────────────────────────────
  const callsByHour: Record<number, number> = {};
  const callsByDayOfWeek: Record<number, number> = {};
  const transfersByHour: Record<number, number> = {};
  const transfersByDow: Record<number, number> = {};

  for (const call of calls) {
    const h = call.callStartTime.getHours();
    const dow = call.callStartTime.getDay();
    callsByHour[h] = (callsByHour[h] ?? 0) + 1;
    callsByDayOfWeek[dow] = (callsByDayOfWeek[dow] ?? 0) + 1;
    if (call.callEndReason === 'CallTransfer') {
      transfersByHour[h] = (transfersByHour[h] ?? 0) + 1;
      transfersByDow[dow] = (transfersByDow[dow] ?? 0) + 1;
    }
  }

  const transferRateByHour: Record<number, number> = {};
  for (const [h, count] of Object.entries(callsByHour)) {
    const hour = Number(h);
    transferRateByHour[hour] = count
      ? (transfersByHour[hour] ?? 0) / count
      : 0;
  }

  const transferRateByDayOfWeek: Record<number, number> = {};
  for (const [d, count] of Object.entries(callsByDayOfWeek)) {
    const day = Number(d);
    transferRateByDayOfWeek[day] = count
      ? (transfersByDow[day] ?? 0) / count
      : 0;
  }

  const peakHour = Number(
    Object.entries(callsByHour).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0,
  );
  const peakDay = Number(
    Object.entries(callsByDayOfWeek).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0,
  );

  const temporalPatterns: TemporalPatterns = {
    callsByHour,
    callsByDayOfWeek,
    peakHour,
    peakDay,
    transferRateByHour,
    transferRateByDayOfWeek,
  };

  // ── Restaurant comparison ──────────────────────────────────────────────────
  const tfCalls = calls.filter((c) => c.restaurantName === 'TF Oakwood');
  const rtCalls = calls.filter((c) => c.restaurantName === 'RT Buckhead');

  const restaurantComparison: RestaurantComparison = {
    tfOakwood: buildRestaurantStats(tfCalls, classified),
    rtBuckhead: buildRestaurantStats(rtCalls, classified),
  };

  // ── Opportunities ──────────────────────────────────────────────────────────

  // O1: Fix reservation SMS
  const resCalls = calls.filter((c) =>
    c.reasonForCalling.toLowerCase().includes('reservation'),
  );
  const resRtCalls = resCalls.filter((c) => c.restaurantName === 'RT Buckhead');
  const resWithNoSms = resRtCalls.filter((c) => c.textsSent.length === 0);
  const brokenPromiseCalls = classified.filter(
    (c) => c.errorCode === 'BROKEN_PROMISE',
  ).length;

  // O2: Reduce TF Oakwood delivery transfers
  const tfDelivery = tfCalls.filter((c) =>
    c.reasonForCalling.toLowerCase().includes('takeout'),
  );
  const tfDeliveryTransfers = tfDelivery.filter(
    (c) => c.callEndReason === 'CallTransfer',
  );

  // O3: Spam filter
  const spamCalls = classified.filter((c) => c.errorCode === 'UNFILTERED_SPAM').length;
  const agentHangups = calls.filter((c) => c.callEndReason === 'AgentHangup').length;

  // O4: Human request rate
  const humanRequestCalls = calls.filter((c) =>
    c.reasonForCalling.toLowerCase().includes('speak to a human') ||
    c.reasonForCalling.toLowerCase().includes('human') ||
    c.reasonForCalling.toLowerCase().includes('person'),
  );

  const opportunities: Opportunity[] = [
    {
      id: 'O1',
      title: 'Fix reservation SMS confirmation (RT Buckhead)',
      description:
        'The assistant collects reservation details and tells customers to check their phone for a confirmation SMS, but no SMS is ever sent. This affects 100% of RT Buckhead reservation calls.',
      evidence: `${resRtCalls.length} reservation calls at RT Buckhead with 0 SMS sent. ${brokenPromiseCalls} calls with explicit broken promise detected.`,
      affectedCalls: resWithNoSms.length,
      estimatedMonthlyImpact: `${resRtCalls.length} customers per month receive no booking confirmation. Estimated 10–20% no-show rate without confirmation.`,
      proposedFix:
        'Debug and restore the SMS sender integration for the reservation confirmation flow. Add monitoring to alert if reservation SMS delivery rate drops below 90%.',
      impactScore: 9,
      effortScore: 4,
      priority: 1,
    },
    {
      id: 'O2',
      title: 'Eliminate avoidable transfers in TF Oakwood delivery',
      description:
        'When customers call to place a delivery or pickup order, the assistant sends them the online order link and then transfers them to staff anyway. In 93.8% of delivery calls, the transfer adds no value.',
      evidence: `${tfDeliveryTransfers.length} of ${tfDelivery.length} TF Oakwood delivery calls transfer after the link was sent or offered.`,
      affectedCalls: tfDeliveryTransfers.length,
      estimatedMonthlyImpact: `~${tfDeliveryTransfers.length} fewer staff interruptions per month. Each transfer takes ~2 minutes of staff time.`,
      proposedFix:
        "Update the delivery flow: once the customer acknowledges receiving the link, end the conversation gracefully. Transfer should only happen if the customer explicitly requests it or the link fails to send.",
      impactScore: 8,
      effortScore: 3,
      priority: 2,
    },
    {
      id: 'O3',
      title: 'Add spam call detection and early rejection',
      description:
        'Commercial solicitation calls (Google Business account pitches, system service offers) are currently answered by the assistant before it hangs up. These calls waste API tokens and distort metrics.',
      evidence: `${spamCalls} spam calls detected in ${agentHangups} AgentHangup events. Spam represents ${Math.round((spamCalls / agentHangups) * 100)}% of all AgentHangup calls.`,
      affectedCalls: spamCalls,
      estimatedMonthlyImpact:
        'Minor direct impact (~5 calls/month), but high signal value: zero legitimate calls should end in AgentHangup. Fixing this cleans up a key metric.',
      proposedFix:
        'Implement a pre-response keyword filter for the first customer message. If spam patterns are detected (commercial solicitation keywords), immediately hang up or play a rejection message.',
      impactScore: 5,
      effortScore: 2,
      priority: 3,
    },
    {
      id: 'O4',
      title: 'Reduce direct human-bypass rate through better assistant onboarding',
      description:
        '29% of all calls request a human agent immediately, before attempting to use the AI assistant. This suggests customers do not know what the AI can do or do not trust it to help them.',
      evidence: `${humanRequestCalls.length} of ${calls.length} calls (${Math.round((humanRequestCalls.length / calls.length) * 100)}%) have "request to speak to a human" as the primary reason.`,
      affectedCalls: humanRequestCalls.length,
      estimatedMonthlyImpact: `If even 30% of these calls could be resolved by the AI, that is ~${Math.round(humanRequestCalls.length * 0.3)} fewer transfers per month.`,
      proposedFix:
        "Rewrite the opening greeting to clearly state the assistant's capabilities: 'I can help you with orders, reservations, wait times, hours, and more. How can I help you today?' Consider adding a brief 3-second pause before the greeting so callers know the call connected.",
      impactScore: 7,
      effortScore: 3,
      priority: 4,
    },
  ];

  // ── KB gaps ────────────────────────────────────────────────────────────────
  const kbGaps: KbGap[] = [];

  // RT Buckhead delivery: 25 calls, only 2 SMS sent
  const rtDelivery = rtCalls.filter((c) =>
    c.reasonForCalling.toLowerCase().includes('takeout'),
  );
  const rtDeliveryWithSms = rtDelivery.filter((c) => c.textsSent.length > 0);
  if (rtDelivery.length > 0 && rtDeliveryWithSms.length < rtDelivery.length * 0.5) {
    kbGaps.push({
      topic: 'Online ordering / delivery flow',
      restaurant: 'RT Buckhead',
      callCount: rtDelivery.length,
      description: `${rtDelivery.length} delivery/pickup calls at RT Buckhead but only ${rtDeliveryWithSms.length} SMS sent. The delivery flow is not configured or integrated for this restaurant.`,
    });
  }

  // Calls with "Assistance with Online Platforms"
  const onlinePlatformCalls = calls.filter((c) =>
    c.reasonForCalling.toLowerCase().includes('online platform') ||
    c.reasonForCalling.toLowerCase().includes('technical issue'),
  );
  if (onlinePlatformCalls.length > 0) {
    kbGaps.push({
      topic: 'Online platform / app assistance',
      restaurant: onlinePlatformCalls[0]?.restaurantName ?? '',
      callCount: onlinePlatformCalls.length,
      description:
        'Customers calling with app/online ordering issues are not being helped effectively. No specific flow exists for this category.',
    });
  }

  const tfHumanReqs = tfCalls.filter((c) =>
    /human|person|representa|operador|hostess|hablar con/i.test(c.reasonForCalling),
  ).length;
  const rtHumanReqs = rtCalls.filter((c) =>
    /human|person|representa|hostess|speak to|manager/i.test(c.reasonForCalling),
  ).length;
  if (tfHumanReqs > 20 || rtHumanReqs > 20) {
    kbGaps.push({
      topic: 'Human-bypass intent',
      restaurant: tfHumanReqs >= rtHumanReqs ? 'TF Oakwood' : 'RT Buckhead',
      callCount: tfHumanReqs + rtHumanReqs,
      description: `${tfHumanReqs + rtHumanReqs} calls request a human immediately (TF Oakwood: ${tfHumanReqs}, RT Buckhead: ${rtHumanReqs}). Neither assistant has an onboarding step that demonstrates its capabilities before callers bypass to human. Adding a 5-second capability preview ("I can take orders, check hours, and make reservations — what do you need?") would reduce bypass attempts.`,
    });
  }

  return {
    temporalPatterns,
    restaurantComparison,
    opportunities,
    kbGaps,
  };
}
