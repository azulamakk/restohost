import type {
  Call,
  CallerStats,
  ConversationStats,
  DescriptiveStats,
  DurationStats,
  LanguageStats,
  PartySizeStats,
  RestaurantName,
  RestaurantStats,
  SentimentStats,
  SmsStats,
  TemporalStats,
} from './types.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)]!;
}

function countBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of arr) {
    const k = key(item);
    result[k] = (result[k] ?? 0) + 1;
  }
  return result;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

// ─── Language detection ───────────────────────────────────────────────────────

const SPANISH_MARKERS = [
  'gracias', 'hola', 'cómo', 'como', 'por favor', 'sí ', ' si ', 'está',
  'ayudar', 'quiero', 'puedo', 'pedido', 'hablar', 'llamar', 'enviar',
  'yuli', 'oakwood', 'frito',
];

const ENGLISH_MARKERS = [
  'thank', 'hello', 'please', ' would ', ' want ', 'reservation', 'nacho',
  'order', 'pickup', 'delivery', 'calling', 'minutes', 'buckhead',
];

function detectLanguage(text: string): 'es' | 'en' | 'mixed' {
  const lower = text.toLowerCase();
  const esScore = SPANISH_MARKERS.filter((m) => lower.includes(m)).length;
  const enScore = ENGLISH_MARKERS.filter((m) => lower.includes(m)).length;
  if (esScore > enScore + 1) return 'es';
  if (enScore > esScore + 1) return 'en';
  return 'mixed';
}

// ─── Sentiment markers ────────────────────────────────────────────────────────

const FRUSTRATION_MARKERS = [
  'es una m', // "es una máquina"
  "can't hear",
  "hello?",
  "hola?",
  "are you there",
  "are you still",
  "speak to someone",
  "speak to a",
  "transfer me",
  "hablar con",
  "representante",
  "no me ayuda",
  "no puedo",
  "frustrated",
  "i give up",
  "forget it",
  "never mind",
];

const SATISFACTION_MARKERS = [
  "thank you",
  "gracias",
  "perfect",
  "perfecto",
  "that's great",
  "sounds good",
  "got it",
  "awesome",
  "excellent",
  "great",
  "wonderful",
  "appreciate",
];

function hasFrustration(conv: string): boolean {
  const lower = conv.toLowerCase();
  return FRUSTRATION_MARKERS.some((m) => lower.includes(m));
}

function hasSatisfaction(conv: string): boolean {
  const lower = conv.toLowerCase();
  return SATISFACTION_MARKERS.some((m) => lower.includes(m));
}

// ─── Turn counting ────────────────────────────────────────────────────────────

function countTurns(conv: string): number {
  const assistantTurns = (conv.match(/Assistant:/g) ?? []).length;
  const customerTurns = (conv.match(/Customer:/g) ?? []).length;
  return assistantTurns + customerTurns;
}

// ─── Duration buckets ─────────────────────────────────────────────────────────

function durationBucket(secs: number): string {
  if (secs < 10) return '<10s';
  if (secs < 30) return '10–30s';
  if (secs < 60) return '30–60s';
  if (secs < 120) return '1–2min';
  if (secs < 180) return '2–3min';
  return '3min+';
}

// ─── Restaurant stats ─────────────────────────────────────────────────────────

function buildRestaurantStats(calls: Call[]): RestaurantStats {
  const total = calls.length;
  const transfers = calls.filter((c) => c.callEndReason === 'CallTransfer').length;
  const withSms = calls.filter((c) => c.textsSent.length > 0).length;
  const autonomous = calls.filter(
    (c) =>
      c.callEndReason === 'UserHangup' && c.textsSent.length > 0,
  ).length;
  const durations = calls.map((c) => c.callDurationSeconds);
  const avgDur = durations.reduce((a, b) => a + b, 0) / (total || 1);
  const frustrated = calls.filter((c) => hasFrustration(c.conversation)).length;

  return {
    totalCalls: total,
    callEndReasonDist: countBy(calls, (c) => c.callEndReason),
    reasonForCallingDist: countBy(calls, (c) => c.reasonForCalling || '(empty)'),
    transferRate: total ? transfers / total : 0,
    smsRate: total ? withSms / total : 0,
    autonomousResolutionRate: total ? autonomous / total : 0,
    avgDurationSeconds: avgDur,
    frustrationRate: total ? frustrated / total : 0,
  };
}

// ─── Main analysis function ───────────────────────────────────────────────────

export function analyzeDescriptive(calls: Call[]): DescriptiveStats {
  const total = calls.length;
  const restaurants: RestaurantName[] = ['TF Oakwood', 'RT Buckhead'];

  // ── Duration stats ──────────────────────────────────────────────────────────
  const sortedDurations = [...calls.map((c) => c.callDurationSeconds)].sort(
    (a, b) => a - b,
  );
  const avgDur =
    sortedDurations.reduce((a, b) => a + b, 0) / (sortedDurations.length || 1);

  const durationStats: DurationStats = {
    p10: percentile(sortedDurations, 10),
    p25: percentile(sortedDurations, 25),
    p50: percentile(sortedDurations, 50),
    p75: percentile(sortedDurations, 75),
    p90: percentile(sortedDurations, 90),
    p99: percentile(sortedDurations, 99),
    avg: Math.round(avgDur),
    min: sortedDurations[0] ?? 0,
    max: sortedDurations[sortedDurations.length - 1] ?? 0,
    buckets: countBy(calls, (c) => durationBucket(c.callDurationSeconds)),
    byEndReason: {} as Record<string, number>,
  };
  for (const reason of ['AgentHangup', 'UserHangup', 'CallTransfer', 'UserInactivity']) {
    const subset = calls.filter((c) => c.callEndReason === reason);
    if (subset.length > 0) {
      durationStats.byEndReason[reason] = Math.round(
        subset.map((c) => c.callDurationSeconds).reduce((a, b) => a + b, 0) /
          subset.length,
      );
    }
  }

  // ── Temporal stats ──────────────────────────────────────────────────────────
  const byHour: Record<number, number> = {};
  const byDayOfWeek: Record<number, number> = {};
  const byDate: Record<string, number> = {};

  for (const call of calls) {
    const h = call.callStartTime.getHours();
    const dow = call.callStartTime.getDay();
    const date = call.callStartTime.toISOString().slice(0, 10);
    byHour[h] = (byHour[h] ?? 0) + 1;
    byDayOfWeek[dow] = (byDayOfWeek[dow] ?? 0) + 1;
    byDate[date] = (byDate[date] ?? 0) + 1;
  }

  const peakHour = Number(
    Object.entries(byHour).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0,
  );
  const peakDay = Number(
    Object.entries(byDayOfWeek).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0,
  );
  const peakDate =
    Object.entries(byDate).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  const temporalStats: TemporalStats = {
    byHour,
    byDayOfWeek,
    byDate,
    peakHour,
    peakDay,
    peakDate,
  };

  // ── Conversation stats ──────────────────────────────────────────────────────
  const turns = calls.map((c) => countTurns(c.conversation));
  const sortedTurns = [...turns].sort((a, b) => a - b);
  const lengths = calls.map((c) => c.conversation.length);
  const sortedLengths = [...lengths].sort((a, b) => a - b);

  const conversationStats: ConversationStats = {
    avgTurns: turns.reduce((a, b) => a + b, 0) / (total || 1),
    minTurns: sortedTurns[0] ?? 0,
    maxTurns: sortedTurns[sortedTurns.length - 1] ?? 0,
    turnBuckets: {
      '1–2': turns.filter((t) => t <= 2).length,
      '3–4': turns.filter((t) => t >= 3 && t <= 4).length,
      '5–8': turns.filter((t) => t >= 5 && t <= 8).length,
      '9+': turns.filter((t) => t >= 9).length,
    },
    avgLengthChars: Math.round(
      lengths.reduce((a, b) => a + b, 0) / (total || 1),
    ),
    medianLengthChars: median(sortedLengths),
    maxLengthChars: sortedLengths[sortedLengths.length - 1] ?? 0,
    emptyOrTruncated: calls.filter((c) => c.conversation.length < 50).length,
  };

  // ── SMS stats ───────────────────────────────────────────────────────────────
  const withSms = calls.filter((c) => c.textsSent.length > 0);
  const smsTypeCount: Record<string, number> = {};
  for (const call of withSms) {
    for (const t of call.textsSent) {
      smsTypeCount[t] = (smsTypeCount[t] ?? 0) + 1;
    }
  }

  const resCalls = calls.filter((c) =>
    c.reasonForCalling.toLowerCase().includes('reservation'),
  );
  const resWithSms = resCalls.filter((c) => c.textsSent.length > 0);

  const smsStats: SmsStats = {
    totalWithSms: withSms.length,
    smsRate: total ? withSms.length / total : 0,
    byType: smsTypeCount,
    autonomousResolutions: calls.filter(
      (c) => c.callEndReason === 'UserHangup' && c.textsSent.length > 0,
    ).length,
    reservationsWithSms: resWithSms.length,
    reservationSmsRate: resCalls.length ? resWithSms.length / resCalls.length : 0,
  };

  // ── Caller stats ─────────────────────────────────────────────────────────────
  const phoneMap = new Map<string, Call[]>();
  for (const call of calls) {
    if (!phoneMap.has(call.phone)) phoneMap.set(call.phone, []);
    phoneMap.get(call.phone)!.push(call);
  }

  const repeatCallers = [...phoneMap.entries()].filter(([, c]) => c.length > 1);
  const topRepeat = repeatCallers
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([phone, c]) => ({
      phone,
      count: c.length,
      reasons: [...new Set(c.map((x) => x.reasonForCalling))],
    }));

  const possibleBot = [...phoneMap.entries()]
    .filter(([, c]) => {
      // Same question repeated 5+ times = likely bot
      if (c.length < 5) return false;
      const uniqueConvs = new Set(c.map((x) => x.conversation.slice(0, 80)));
      return uniqueConvs.size <= 2;
    })
    .map(([phone]) => phone);

  const callerStats: CallerStats = {
    uniqueCallers: phoneMap.size,
    repeatCallers: repeatCallers.length,
    topRepeatCallers: topRepeat,
    possibleBot,
  };

  // ── Sentiment stats ──────────────────────────────────────────────────────────
  const sentimentStats: SentimentStats = {
    byRestaurant: {
      'TF Oakwood': { frustration: 0, satisfaction: 0, frustrationRate: 0 },
      'RT Buckhead': { frustration: 0, satisfaction: 0, frustrationRate: 0 },
    },
  };

  for (const rest of restaurants) {
    const subset = calls.filter((c) => c.restaurantName === rest);
    const frustrated = subset.filter((c) => hasFrustration(c.conversation)).length;
    const satisfied = subset.filter((c) => hasSatisfaction(c.conversation)).length;
    sentimentStats.byRestaurant[rest] = {
      frustration: frustrated,
      satisfaction: satisfied,
      frustrationRate: subset.length ? frustrated / subset.length : 0,
    };
  }

  // ── Language stats ───────────────────────────────────────────────────────────
  const languageStats: LanguageStats = {
    byRestaurant: {
      'TF Oakwood': { es: 0, en: 0, mixed: 0 },
      'RT Buckhead': { es: 0, en: 0, mixed: 0 },
    },
    mismatchedCalls: 0,
  };

  let mismatches = 0;
  for (const call of calls) {
    const lang = detectLanguage(call.conversation);
    languageStats.byRestaurant[call.restaurantName][lang]++;
    const expectedLang = call.restaurantName === 'TF Oakwood' ? 'es' : 'en';
    if (lang !== expectedLang && lang !== 'mixed') mismatches++;
  }
  languageStats.mismatchedCalls = mismatches;

  // ── Party size stats ─────────────────────────────────────────────────────────
  const withParty = calls.filter((c) => c.partySizeNumber !== null);
  const partySizeStats: PartySizeStats = {
    callsWithPartySize: withParty.length,
    distribution: countBy(withParty, (c) => String(c.partySizeNumber)),
    largePartyRate: calls.length
      ? calls.filter((c) => (c.partySizeNumber ?? 0) >= 5).length / calls.length
      : 0,
  };

  // ── Office hours ─────────────────────────────────────────────────────────────
  const officeHoursStats = {
    within: calls.filter((c) => c.callWithinOfficeHours === true).length,
    outside: calls.filter((c) => c.callWithinOfficeHours === false).length,
    unknown: calls.filter((c) => c.callWithinOfficeHours === null).length,
  };

  return {
    totalCalls: total,
    byRestaurant: {
      'TF Oakwood': buildRestaurantStats(
        calls.filter((c) => c.restaurantName === 'TF Oakwood'),
      ),
      'RT Buckhead': buildRestaurantStats(
        calls.filter((c) => c.restaurantName === 'RT Buckhead'),
      ),
    },
    callEndReasonDist: countBy(calls, (c) => c.callEndReason),
    reasonForCallingDist: countBy(calls, (c) => c.reasonForCalling || '(empty)'),
    durationStats,
    temporalStats,
    conversationStats,
    smsStats,
    callerStats,
    sentimentStats,
    languageStats,
    partySizeStats,
    officeHoursStats,
  };
}
