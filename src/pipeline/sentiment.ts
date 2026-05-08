import type {
  ClassifiedCall,
  SentimentAnalysis,
  CallSentiment,
  MotiveGroup,
  SentimentOutcomeBucket,
  RestaurantName,
} from './types.ts';

// ─── Signal keywords ──────────────────────────────────────────────────────────

const POSITIVE_SIGNALS = [
  'thanks', 'thank you', 'perfect', 'great', 'awesome', 'appreciate',
  'exactly', 'wonderful', 'love it', 'happy', 'got it', 'sounds good',
  'gracias', 'perfecto', 'excelente', 'genial', 'helpful',
  'excellent', 'fantastic', 'amazing', 'sounds great', 'that works',
  'very helpful', 'much appreciated', 'that is great', "that's great",
  'super helpful', 'thank', 'muchas gracias', 'muy bien',
];

const NEGATIVE_SIGNALS = [
  'frustrated', 'terrible', 'awful', 'ridiculous', 'unacceptable',
  "can't hear", 'give up', 'wrong order', 'still not', 'never',
  'horrible', "doesn't work", 'no funciona', 'no me ayuda',
  'disgusting', 'worst', 'angry', 'upset', 'disappointed', 'useless',
  'broken', 'already told', 'es una máquina', 'es una maquina',
  'keeping me waiting', 'waste of time', 'this is ridiculous',
  'rude', 'not helpful', 'cannot understand', 'keeps saying',
];

const IMPATIENCE_SIGNALS = [
  'hello?', 'hola?', 'are you there', 'are you still there',
  'speak to a person', 'speak to someone', 'speak to a human',
  'transfer me', 'hablar con un', 'hablar con una persona',
  'operador', 'representante', 'need a human', 'real person',
  'hello hello', 'hola hola', 'anyone there', 'is anyone',
];

// ─── Motive normalization ─────────────────────────────────────────────────────

interface MotiveRule {
  category: string;
  keywords: string[];
}

const MOTIVE_RULES: MotiveRule[] = [
  {
    category: 'Request Human',
    keywords: [
      'human', 'person', 'representative', 'operador', 'representante',
      'hablar con', 'customer service', 'host', 'hostess', 'speak to',
      'operator', 'agent', 'someone', 'talk to',
    ],
  },
  {
    category: 'Reservation',
    keywords: ['reservation', 'reserva', 'book', 'reserve', 'table for', 'mesa para', 'booking'],
  },
  {
    category: 'Delivery Order',
    keywords: ['delivery', 'deliver', 'orden de', 'pedido de', 'entrega'],
  },
  {
    category: 'Takeout / Pickup',
    keywords: ['takeout', 'pickup', 'para llevar', 'pick up', 'take out', 'to go', 'carry out'],
  },
  {
    category: 'Lost Items',
    keywords: ['left my', 'lost my', 'forgot', 'sunglasses', 'left a', 'lost a', 'belongings', 'jacket', 'lost and found'],
  },
  {
    category: 'Complaint / Issue',
    keywords: ['wrong', 'complaint', 'issue', 'problem', 'cold food', 'missing item', 'incorrect', 'bad order', 'overcharge', 'not satisfied'],
  },
  {
    category: 'Menu / Hours',
    keywords: ['menu', 'hours', 'horario', 'price', 'precio', 'open', 'close', 'what time', 'how much', 'cost', 'allergen', 'vegan', 'gluten', 'special'],
  },
  {
    category: 'Catering / Event',
    keywords: ['catering', 'event', 'group', 'party', 'birthday', 'corporate', 'banquet', 'private'],
  },
];

function normalizeCategory(reasonForCalling: string): string {
  if (!reasonForCalling) return 'Other';
  const lower = reasonForCalling.toLowerCase();
  for (const rule of MOTIVE_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) return rule.category;
  }
  return 'Other';
}

// ─── Sentiment scoring ────────────────────────────────────────────────────────

function extractCustomerText(conversation: string): string {
  return conversation
    .split('\n')
    .filter(line => line.startsWith('Customer:'))
    .map(line => line.replace(/^Customer:\s*/i, ''))
    .join(' ')
    .toLowerCase();
}

interface SignalCounts {
  positive: number;
  negative: number;
  impatience: number;
}

function countSignals(text: string): SignalCounts {
  return {
    positive: POSITIVE_SIGNALS.filter(s => text.includes(s)).length,
    negative: NEGATIVE_SIGNALS.filter(s => text.includes(s)).length,
    impatience: IMPATIENCE_SIGNALS.filter(s => text.includes(s)).length,
  };
}

function computeScore(signals: SignalCounts): number {
  const { positive, negative, impatience } = signals;
  const total = positive + negative + impatience;
  if (total === 0) return 0;
  const raw = (positive - negative - 0.5 * impatience) / total;
  return Math.max(-1, Math.min(1, parseFloat(raw.toFixed(3))));
}

type Emotion = 'FRUSTRATED' | 'SATISFIED' | 'IMPATIENT' | 'CONFUSED' | 'NEUTRAL';

function classifyEmotion(customerText: string, signals: SignalCounts): Emotion {
  const { positive, negative, impatience } = signals;
  if (negative >= 2 || impatience >= 2) return 'FRUSTRATED';
  if (impatience >= 1 && negative < 2) return 'IMPATIENT';
  if (positive >= 2 && negative === 0) return 'SATISFIED';
  const confusedMarkers = ["sorry?", "what?", 'repeat that', 'say again', 'pardon', 'come again'];
  const confusedCount = confusedMarkers.filter(m => customerText.includes(m)).length;
  if (confusedCount >= 2) return 'CONFUSED';
  return 'NEUTRAL';
}

// ─── Resolution logic ─────────────────────────────────────────────────────────

function isResolvedCall(call: ClassifiedCall): boolean {
  if (call.numberOfTextsSent > 0) return true;
  if (call.callEndReason === 'UserHangup' && !call.isError) return true;
  return false;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function analyzeSentiment(calls: ClassifiedCall[]): SentimentAnalysis {
  // Per-call sentiment
  const callSentiments: CallSentiment[] = calls.map(call => {
    const customerText = extractCustomerText(call.conversation);
    const signals = countSignals(customerText);
    return {
      conversationId: call.conversationId,
      restaurantName: call.restaurantName,
      sentimentScore: computeScore(signals),
      emotion: classifyEmotion(customerText, signals),
      positiveSignals: signals.positive,
      negativeSignals: signals.negative,
      impatienceSignals: signals.impatience,
      callEndReason: call.callEndReason,
      durationSeconds: call.callDurationSeconds,
      isResolved: isResolvedCall(call),
      isError: call.isError,
      motiveCategory: normalizeCategory(call.reasonForCalling),
      callStartTime: call.callStartTime instanceof Date
        ? call.callStartTime.toISOString()
        : String(call.callStartTime),
    };
  });

  // Distribution
  const posCount = callSentiments.filter(c => c.sentimentScore > 0.1).length;
  const negCount = callSentiments.filter(c => c.sentimentScore < -0.1).length;
  const distribution = {
    positive: posCount,
    neutral: calls.length - posCount - negCount,
    negative: negCount,
  };
  const avgScore = parseFloat(
    (callSentiments.reduce((s, c) => s + c.sentimentScore, 0) / calls.length).toFixed(3)
  );

  // Top emotions
  const emotionCounts: Record<string, number> = {};
  for (const c of callSentiments) emotionCounts[c.emotion] = (emotionCounts[c.emotion] ?? 0) + 1;
  const topEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([emotion, count]) => ({ emotion, count, pct: Math.round(count / calls.length * 100) }));

  // Motive groups (build examples in one indexed pass)
  const examplesMap = new Map<string, string[]>();
  calls.forEach((call, i) => {
    const cat = callSentiments[i]!.motiveCategory;
    if (!examplesMap.has(cat)) examplesMap.set(cat, []);
    const arr = examplesMap.get(cat)!;
    if (arr.length < 3 && call.reasonForCalling && !arr.includes(call.reasonForCalling)) {
      arr.push(call.reasonForCalling);
    }
  });

  const catBuckets = new Map<string, CallSentiment[]>();
  for (const cs of callSentiments) {
    if (!catBuckets.has(cs.motiveCategory)) catBuckets.set(cs.motiveCategory, []);
    catBuckets.get(cs.motiveCategory)!.push(cs);
  }

  const motiveGroups: MotiveGroup[] = [];
  for (const [category, group] of catBuckets) {
    const byRestaurant: Record<string, number> = {};
    const emotionDist: Record<string, number> = {};
    for (const c of group) {
      byRestaurant[c.restaurantName] = (byRestaurant[c.restaurantName] ?? 0) + 1;
      emotionDist[c.emotion] = (emotionDist[c.emotion] ?? 0) + 1;
    }
    motiveGroups.push({
      category,
      count: group.length,
      pct: Math.round(group.length / calls.length * 100),
      avgSentimentScore: parseFloat(
        (group.reduce((s, c) => s + c.sentimentScore, 0) / group.length).toFixed(3)
      ),
      successRate: group.filter(c => c.isResolved).length / group.length,
      errorRate: group.filter(c => c.isError).length / group.length,
      avgDuration: Math.round(group.reduce((s, c) => s + c.durationSeconds, 0) / group.length),
      byRestaurant,
      emotionDist,
      examples: examplesMap.get(category) ?? [],
    });
  }
  motiveGroups.sort((a, b) => b.count - a.count);

  // Sentiment → outcome buckets
  const BUCKETS = [
    { bucket: 'Very Negative', min: -1.01, max: -0.5 },
    { bucket: 'Negative',      min: -0.5,  max: -0.1 },
    { bucket: 'Neutral',       min: -0.1,  max:  0.1 },
    { bucket: 'Positive',      min:  0.1,  max:  0.5 },
    { bucket: 'Very Positive', min:  0.5,  max:  1.01 },
  ];

  const sentimentOutcomes: SentimentOutcomeBucket[] = BUCKETS.map(b => {
    const group = callSentiments.filter(c => c.sentimentScore > b.min && c.sentimentScore <= b.max);
    if (group.length === 0) {
      return { bucket: b.bucket, scoreRange: [b.min, b.max] as [number, number], count: 0, transferRate: 0, errorRate: 0, resolvedRate: 0, avgDuration: 0 };
    }
    return {
      bucket: b.bucket,
      scoreRange: [b.min, b.max] as [number, number],
      count: group.length,
      transferRate: group.filter(c => c.callEndReason === 'CallTransfer').length / group.length,
      errorRate: group.filter(c => c.isError).length / group.length,
      resolvedRate: group.filter(c => c.isResolved).length / group.length,
      avgDuration: Math.round(group.reduce((s, c) => s + c.durationSeconds, 0) / group.length),
    };
  });

  // Temporal aggregation (running average to avoid two-pass)
  const byHour: Record<number, { avgScore: number; count: number }> = {};
  const byDayOfWeek: Record<number, { avgScore: number; count: number }> = {};
  for (const cs of callSentiments) {
    const d = new Date(cs.callStartTime);
    const h = d.getHours();
    const dow = d.getDay();
    if (!byHour[h]) byHour[h] = { avgScore: 0, count: 0 };
    const hEntry = byHour[h]!;
    hEntry.avgScore = parseFloat(((hEntry.avgScore * hEntry.count + cs.sentimentScore) / (hEntry.count + 1)).toFixed(3));
    hEntry.count++;
    if (!byDayOfWeek[dow]) byDayOfWeek[dow] = { avgScore: 0, count: 0 };
    const dEntry = byDayOfWeek[dow]!;
    dEntry.avgScore = parseFloat(((dEntry.avgScore * dEntry.count + cs.sentimentScore) / (dEntry.count + 1)).toFixed(3));
    dEntry.count++;
  }

  // By restaurant
  const byRestaurant: SentimentAnalysis['byRestaurant'] = {};
  for (const rest of ['TF Oakwood', 'RT Buckhead'] as const) {
    const group = callSentiments.filter(c => c.restaurantName === rest);
    const pos = group.filter(c => c.sentimentScore > 0.1).length;
    const neg = group.filter(c => c.sentimentScore < -0.1).length;
    const eDist: Record<string, number> = {};
    for (const c of group) eDist[c.emotion] = (eDist[c.emotion] ?? 0) + 1;
    const posGroup = group.filter(c => c.sentimentScore >= 0);
    const negGroup = group.filter(c => c.sentimentScore < 0);
    byRestaurant[rest] = {
      avgScore: parseFloat((group.reduce((s, c) => s + c.sentimentScore, 0) / (group.length || 1)).toFixed(3)),
      distribution: { positive: pos, neutral: group.length - pos - neg, negative: neg },
      emotionDist: eDist,
      moodOutcomeMatrix: {
        positiveResolved: posGroup.filter(c => c.isResolved).length,
        positiveTransferred: posGroup.filter(c => c.callEndReason === 'CallTransfer').length,
        negativeResolved: negGroup.filter(c => c.isResolved).length,
        negativeTransferred: negGroup.filter(c => c.callEndReason === 'CallTransfer').length,
      },
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    totalCalls: calls.length,
    avgScore,
    distribution,
    topEmotions,
    callSentiments,
    motiveGroups,
    sentimentOutcomes,
    byHour,
    byDayOfWeek,
    byRestaurant,
  };
}
