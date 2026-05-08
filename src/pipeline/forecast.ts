import type { Call, DailyForecast, ForecastResult, AssistantAdjustment } from './types.ts';

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

// Same keyword categories as sentiment.ts — keeps the two consistent
const MOTIVE_RULES: { category: string; keywords: string[] }[] = [
  { category: 'Request Human',    keywords: ['human', 'person', 'representative', 'operador', 'representante', 'hablar con', 'customer service', 'host', 'hostess', 'speak to', 'operator', 'agent', 'someone', 'talk to'] },
  { category: 'Reservation',      keywords: ['reservation', 'reserva', 'book', 'reserve', 'table for', 'mesa para', 'booking'] },
  { category: 'Delivery Order',   keywords: ['delivery', 'deliver', 'orden de', 'pedido de', 'entrega'] },
  { category: 'Takeout / Pickup', keywords: ['takeout', 'pickup', 'para llevar', 'pick up', 'take out', 'to go', 'carry out'] },
  { category: 'Lost Items',       keywords: ['left my', 'lost my', 'forgot', 'sunglasses', 'left a', 'lost a', 'belongings', 'jacket', 'lost and found'] },
  { category: 'Complaint / Issue',keywords: ['wrong', 'complaint', 'issue', 'problem', 'cold food', 'missing item', 'incorrect', 'bad order', 'overcharge', 'not satisfied'] },
  { category: 'Menu / Hours',     keywords: ['menu', 'hours', 'horario', 'price', 'precio', 'open', 'close', 'what time', 'how much', 'cost', 'allergen', 'vegan', 'gluten', 'special'] },
  { category: 'Catering / Event', keywords: ['catering', 'event', 'group', 'party', 'birthday', 'corporate', 'banquet', 'private'] },
];

function normalizeCategory(reason: string): string {
  if (!reason) return 'Other';
  const lower = reason.toLowerCase();
  for (const rule of MOTIVE_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) return rule.category;
  }
  return 'Other';
}

function nextWeekDates(fromDate: Date): Date[] {
  const dates: Date[] = [];
  const dayOfWeek = fromDate.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  for (let i = 0; i < 7; i++) {
    const d = new Date(fromDate);
    d.setDate(fromDate.getDate() + daysUntilMonday + i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

function buildRestaurantForecast(
  calls: Call[],
  forecastDates: Date[],
): ForecastResult['byRestaurant'][string] {
  const callsByDow: Record<number, Call[]> = {};
  const datesByDow: Record<number, Set<string>> = {};
  for (let i = 0; i < 7; i++) { callsByDow[i] = []; datesByDow[i] = new Set(); }

  for (const call of calls) {
    const dow = call.callStartTime.getDay();
    callsByDow[dow]!.push(call);
    datesByDow[dow]!.add(call.callStartTime.toISOString().slice(0, 10));
  }

  const avgByDow: Record<number, number> = {};
  for (let i = 0; i < 7; i++) {
    const wc = datesByDow[i]!.size;
    avgByDow[i] = wc > 0 ? callsByDow[i]!.length / wc : 0;
  }

  const dailyVolumes: Record<string, number> = {};
  let total = 0;
  let peakDay = forecastDates[0]?.toISOString().slice(0, 10) ?? '';
  let peakVol = 0;
  for (const date of forecastDates) {
    const dow = date.getDay();
    const vol = Math.round(avgByDow[dow] ?? 0);
    const dow_name = DAY_NAMES[dow]!;
    dailyVolumes[dow_name] = vol;
    total += vol;
    if (vol > peakVol) { peakVol = vol; peakDay = dow_name; }
  }

  // Normalized motive distribution across all calls for this restaurant
  const motiveCounts: Record<string, number> = {};
  for (const call of calls) {
    const cat = normalizeCategory(call.reasonForCalling);
    motiveCounts[cat] = (motiveCounts[cat] ?? 0) + 1;
  }
  const totalCalls = calls.length || 1;
  const topMotives = Object.entries(motiveCounts)
    .map(([category, count]) => ({ category, pct: Math.round((count / totalCalls) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  return { predictedWeeklyTotal: total, peakDay, topMotives, dailyVolumes };
}

export function buildForecast(calls: Call[]): ForecastResult {
  // ── Compute combined DOW averages ─────────────────────────────────────────
  const callsByDow: Record<number, Call[]> = {};
  const datesByDow: Record<number, Set<string>> = {};
  for (let i = 0; i < 7; i++) { callsByDow[i] = []; datesByDow[i] = new Set(); }

  for (const call of calls) {
    const dow = call.callStartTime.getDay();
    callsByDow[dow]!.push(call);
    datesByDow[dow]!.add(call.callStartTime.toISOString().slice(0, 10));
  }

  const avgByDow: Record<number, number> = {};
  for (let i = 0; i < 7; i++) {
    const wc = datesByDow[i]!.size;
    avgByDow[i] = wc > 0 ? callsByDow[i]!.length / wc : 0;
  }

  // Normalized motive distribution by DOW
  const motiveCatByDow: Record<number, Record<string, number>> = {};
  for (let i = 0; i < 7; i++) {
    const dowCalls = callsByDow[i]!;
    const total = dowCalls.length || 1;
    const dist: Record<string, number> = {};
    for (const call of dowCalls) {
      const cat = normalizeCategory(call.reasonForCalling);
      dist[cat] = (dist[cat] ?? 0) + 1;
    }
    const normalized: Record<string, number> = {};
    for (const [k, v] of Object.entries(dist)) {
      normalized[k] = Math.round((v / total) * 100);
    }
    motiveCatByDow[i] = normalized;
  }

  // ── Forecast next week ────────────────────────────────────────────────────
  const lastCallDate = new Date(Math.max(...calls.map(c => c.callStartTime.getTime())));
  const forecastDates = nextWeekDates(lastCallDate);

  const dailyForecasts: DailyForecast[] = forecastDates.map(date => {
    const dow = date.getDay();
    return {
      date: date.toISOString().slice(0, 10),
      dayOfWeek: DAY_NAMES[dow]!,
      predictedVolume: Math.round(avgByDow[dow] ?? 0),
      predictedReasonDistribution: motiveCatByDow[dow] ?? {},
      historicalAvg: Math.round((avgByDow[dow] ?? 0) * 10) / 10,
    };
  });

  const totalPredicted = dailyForecasts.reduce((a, d) => a + d.predictedVolume, 0);
  const peakForecast = dailyForecasts.reduce((best, d) => d.predictedVolume > best.predictedVolume ? d : best, dailyForecasts[0]!);

  // ── Per-restaurant forecasts ──────────────────────────────────────────────
  const tfCalls = calls.filter(c => c.restaurantName === 'TF Oakwood');
  const rtCalls = calls.filter(c => c.restaurantName === 'RT Buckhead');

  const byRestaurant: ForecastResult['byRestaurant'] = {
    'TF Oakwood': buildRestaurantForecast(tfCalls, forecastDates),
    'RT Buckhead': buildRestaurantForecast(rtCalls, forecastDates),
  };

  // ── Assistant adjustments ─────────────────────────────────────────────────
  const adjustments: AssistantAdjustment[] = [];

  const tfMotives = byRestaurant['TF Oakwood']!.topMotives;
  const rtMotives = byRestaurant['RT Buckhead']!.topMotives;

  const tfDeliveryPct  = tfMotives.find(m => m.category === 'Delivery Order')?.pct ?? 0;
  const tfHumanPct     = tfMotives.find(m => m.category === 'Request Human')?.pct ?? 0;
  const rtResPct       = rtMotives.find(m => m.category === 'Reservation')?.pct ?? 0;
  const tfMenuHoursPct = tfMotives.find(m => m.category === 'Menu / Hours')?.pct ?? 0;
  const rtMenuHoursPct = rtMotives.find(m => m.category === 'Menu / Hours')?.pct ?? 0;

  // TF Oakwood: delivery spike
  if (tfDeliveryPct >= 30) {
    adjustments.push({
      restaurant: 'TF Oakwood',
      trigger: `~${tfDeliveryPct}% of calls are predicted to be delivery orders`,
      action: `Run the delivery order flow end-to-end before Monday 18:00: place a test order, confirm the URL is live and returning correctly. The most common failure at TF Oakwood is the assistant promising an order link that 404s — catching this before the peak avoids the BROKEN_PROMISE error.`,
      priority: 'HIGH',
    });
  }

  // TF Oakwood: high human-request rate → escalation calibration
  if (tfHumanPct >= 25) {
    adjustments.push({
      restaurant: 'TF Oakwood',
      trigger: `~${tfHumanPct}% of TF Oakwood calls are predicted to request a human agent`,
      action: `Review the Spanish handoff decision logic before the week starts. With ${tfHumanPct}% escalation predicted, lower the transfer threshold for menu, hours, and basic FAQ questions — these are resolvable autonomously but the assistant currently escalates too early. Add at least 2 new Spanish-language menu FAQ entries to the KB.`,
      priority: 'HIGH',
    });
  }

  // RT Buckhead: reservation spike on weekends → SMS fallback
  const rtWeekendRes = (byRestaurant['RT Buckhead']!.dailyVolumes['Friday'] ?? 0)
    + (byRestaurant['RT Buckhead']!.dailyVolumes['Saturday'] ?? 0)
    + (byRestaurant['RT Buckhead']!.dailyVolumes['Sunday'] ?? 0);
  if (rtResPct >= 15 && rtWeekendRes >= 3) {
    adjustments.push({
      restaurant: 'RT Buckhead',
      trigger: `~${rtResPct}% reservation rate predicted, with ~${rtWeekendRes} weekend calls expected`,
      action: `If the BROKEN_PROMISE fix (SMS confirmation not sent after reservation) has not been deployed, activate the verbal fallback before Friday: configure the assistant to read the reservation details aloud (date, time, party size) at end of call and instruct the caller to take a screenshot. Do not wait for the SMS bug fix to be in production.`,
      priority: 'HIGH',
    });
  }

  // Peak day smoke-test
  if (peakForecast.predictedVolume >= 6) {
    adjustments.push({
      restaurant: 'Both',
      trigger: `Peak day predicted: ${peakForecast.dayOfWeek} with ~${peakForecast.predictedVolume} calls`,
      action: `Run a full assistant smoke-test (delivery → reservation → hours query → human-request escalation) on both restaurant assistants before ${peakForecast.dayOfWeek} 18:00. Verify STT latency is within acceptable range — speech recognition failures spike during high-volume windows.`,
      priority: 'MEDIUM',
    });
  }

  // Menu / hours KB freshness
  const menuHoursPct = Math.max(tfMenuHoursPct, rtMenuHoursPct);
  if (menuHoursPct >= 8) {
    const rest = tfMenuHoursPct >= rtMenuHoursPct ? 'TF Oakwood' : 'RT Buckhead';
    adjustments.push({
      restaurant: rest,
      trigger: `~${menuHoursPct}% menu/hours queries predicted at ${rest}`,
      action: `Verify the KB hours and specials entry for ${rest} is current before Monday. Menu/hours questions are the easiest for the assistant to resolve autonomously — but stale data turns a zero-transfer call into a frustrated escalation. Update the opening-hours entry and this week's specials.`,
      priority: 'LOW',
    });
  }

  // ── Operational checks (kept for backward compat) ─────────────────────────
  const preventiveRecommendations = [
    `Predicted peak day: ${peakForecast.dayOfWeek} (~${peakForecast.predictedVolume} calls). Ensure the AI system is healthy before peak hours (19:00–21:00).`,
    `Weekend delivery volume is high at TF Oakwood. Verify the online order link is functional every Friday morning before peak hours begin.`,
    `If the SMS reservation confirmation fix has not been deployed, brief the RT Buckhead team to expect ~${Math.round(rtWeekendRes * (rtResPct / 100))} reservation calls over the weekend where customers may not receive confirmation.`,
    `Schedule any planned system maintenance for Tuesday–Wednesday mornings (09:00–11:00) — historically the lowest call volume window.`,
    `Total predicted call volume for the week: ~${totalPredicted} calls. Confidence: LOW. Do not use for staffing decisions without additional data.`,
  ];

  return {
    generatedAt: new Date().toISOString(),
    forecastWeek: `${forecastDates[0]?.toISOString().slice(0, 10)} to ${forecastDates[6]?.toISOString().slice(0, 10)}`,
    confidenceLevel: 'LOW',
    caveat: 'This forecast is based on a single month of data (March 2026) and should be treated as directional only. One month cannot capture seasonal variation, month-over-month trends, holidays, or special events. The March 17 spike (likely St. Patrick\'s Day) inflates Tuesday averages. Use this as a rough order-of-magnitude guide, not a reliable prediction.',
    dailyForecasts,
    preventiveRecommendations,
    byRestaurant,
    assistantAdjustments: adjustments,
  };
}
