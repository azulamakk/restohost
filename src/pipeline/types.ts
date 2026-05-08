export type RestaurantName = 'TF Oakwood' | 'RT Buckhead';

export type CallEndReason =
  | 'AgentHangup'
  | 'UserHangup'
  | 'CallTransfer'
  | 'UserInactivity';

export interface Call {
  conversationId: string;
  restaurantName: RestaurantName;
  callStartTime: Date;
  callDurationSeconds: number;
  callEndReason: CallEndReason;
  callWithinOfficeHours: boolean | null;
  reasonForCalling: string;
  partySizeNumber: number | null;
  textsSent: string[];
  numberOfTextsSent: number;
  phone: string;
  conversation: string;
}

// ─── Error taxonomy ───────────────────────────────────────────────────────────

export type ErrorCode =
  | 'BROKEN_PROMISE'
  | 'AVOIDABLE_TRANSFER'
  | 'STT_FAILURE'
  | 'INCOMPLETE_FLOW'
  | 'NULL_CLASSIFICATION'
  | 'UNFILTERED_SPAM'
  | 'REPEAT_CALLER'
  | 'LANGUAGE_MISMATCH'
  | 'CORRECT_BEHAVIOR'
  | 'NO_ERROR';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export const ERROR_META: Record<
  ErrorCode,
  { label: string; severity: Severity }
> = {
  BROKEN_PROMISE: {
    label: 'Unfulfilled SMS promise',
    severity: 'CRITICAL',
  },
  AVOIDABLE_TRANSFER: {
    label: 'Unnecessary transfer',
    severity: 'HIGH',
  },
  STT_FAILURE: {
    label: 'Speech recognition failure',
    severity: 'HIGH',
  },
  INCOMPLETE_FLOW: {
    label: 'Unconfirmed reservation flow',
    severity: 'HIGH',
  },
  NULL_CLASSIFICATION: {
    label: 'Missing call classification',
    severity: 'MEDIUM',
  },
  UNFILTERED_SPAM: {
    label: 'Undetected spam call',
    severity: 'MEDIUM',
  },
  REPEAT_CALLER: {
    label: 'Repeat frustrated caller',
    severity: 'MEDIUM',
  },
  LANGUAGE_MISMATCH: {
    label: 'Wrong language in response',
    severity: 'LOW',
  },
  CORRECT_BEHAVIOR: {
    label: 'Complex situation handled correctly',
    severity: 'NONE',
  },
  NO_ERROR: {
    label: 'No error detected',
    severity: 'NONE',
  },
};

// ─── Classifier output ────────────────────────────────────────────────────────

export type ClassificationSource = 'rule' | 'llm' | 'none';

export interface ClassifiedCall extends Call {
  errorCode: ErrorCode;
  errorLabel: string;
  severity: Severity;
  isError: boolean;
  description: string;
  whyItMatters: string;
  proposedFix: string;
  confidence: number;
  source: ClassificationSource;
}

// ─── Ticket ───────────────────────────────────────────────────────────────────

export interface Ticket {
  conversationId: string;
  restaurantName: RestaurantName;
  callStartTime: string;
  callDurationSeconds: number;
  callEndReason: CallEndReason;
  reasonForCalling: string;
  errorCode: ErrorCode;
  errorLabel: string;
  severity: Severity;
  description: string;
  whyItMatters: string;
  proposedFix: string;
  confidence: number;
  source: ClassificationSource;
}

// ─── Descriptive stats ────────────────────────────────────────────────────────

export interface DescriptiveStats {
  totalCalls: number;
  byRestaurant: Record<RestaurantName, RestaurantStats>;
  callEndReasonDist: Record<string, number>;
  reasonForCallingDist: Record<string, number>;
  durationStats: DurationStats;
  temporalStats: TemporalStats;
  conversationStats: ConversationStats;
  smsStats: SmsStats;
  callerStats: CallerStats;
  sentimentStats: SentimentStats;
  languageStats: LanguageStats;
  partySizeStats: PartySizeStats;
  officeHoursStats: { within: number; outside: number; unknown: number };
}

export interface RestaurantStats {
  totalCalls: number;
  callEndReasonDist: Record<string, number>;
  reasonForCallingDist: Record<string, number>;
  transferRate: number;
  smsRate: number;
  autonomousResolutionRate: number;
  avgDurationSeconds: number;
  frustrationRate: number;
}

export interface DurationStats {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
  buckets: Record<string, number>;
  byEndReason: Record<string, number>;
}

export interface TemporalStats {
  byHour: Record<number, number>;
  byDayOfWeek: Record<number, number>;
  byDate: Record<string, number>;
  peakHour: number;
  peakDay: number;
  peakDate: string;
}

export interface ConversationStats {
  avgTurns: number;
  minTurns: number;
  maxTurns: number;
  turnBuckets: Record<string, number>;
  avgLengthChars: number;
  medianLengthChars: number;
  maxLengthChars: number;
  emptyOrTruncated: number;
}

export interface SmsStats {
  totalWithSms: number;
  smsRate: number;
  byType: Record<string, number>;
  autonomousResolutions: number;
  reservationsWithSms: number;
  reservationSmsRate: number;
}

export interface CallerStats {
  uniqueCallers: number;
  repeatCallers: number;
  topRepeatCallers: Array<{ phone: string; count: number; reasons: string[] }>;
  possibleBot: string[];
}

export interface SentimentStats {
  byRestaurant: Record<
    RestaurantName,
    { frustration: number; satisfaction: number; frustrationRate: number }
  >;
}

export interface LanguageStats {
  byRestaurant: Record<RestaurantName, { es: number; en: number; mixed: number }>;
  mismatchedCalls: number;
}

export interface PartySizeStats {
  callsWithPartySize: number;
  distribution: Record<string, number>;
  largePartyRate: number;
}

// ─── Patterns ─────────────────────────────────────────────────────────────────

export interface PatternAnalysis {
  temporalPatterns: TemporalPatterns;
  restaurantComparison: RestaurantComparison;
  opportunities: Opportunity[];
  kbGaps: KbGap[];
}

export interface TemporalPatterns {
  callsByHour: Record<number, number>;
  callsByDayOfWeek: Record<number, number>;
  peakHour: number;
  peakDay: number;
  transferRateByHour: Record<number, number>;
  transferRateByDayOfWeek: Record<number, number>;
}

export interface RestaurantComparison {
  tfOakwood: RestaurantStats;
  rtBuckhead: RestaurantStats;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  evidence: string;
  affectedCalls: number;
  estimatedMonthlyImpact: string;
  proposedFix: string;
  impactScore: number;
  effortScore: number;
  priority: number;
}

export interface KbGap {
  topic: string;
  restaurant: string;
  callCount: number;
  description: string;
}

// ─── Sentiment analysis ───────────────────────────────────────────────────────

export type SentimentEmotion = 'FRUSTRATED' | 'SATISFIED' | 'IMPATIENT' | 'CONFUSED' | 'NEUTRAL';

export interface CallSentiment {
  conversationId: string;
  restaurantName: RestaurantName;
  sentimentScore: number;
  emotion: SentimentEmotion;
  positiveSignals: number;
  negativeSignals: number;
  impatienceSignals: number;
  callEndReason: string;
  durationSeconds: number;
  isResolved: boolean;
  isError: boolean;
  motiveCategory: string;
  callStartTime: string;
}

export interface MotiveGroup {
  category: string;
  count: number;
  pct: number;
  avgSentimentScore: number;
  successRate: number;
  errorRate: number;
  avgDuration: number;
  byRestaurant: Record<string, number>;
  emotionDist: Record<string, number>;
  examples: string[];
}

export interface SentimentOutcomeBucket {
  bucket: string;
  scoreRange: [number, number];
  count: number;
  transferRate: number;
  errorRate: number;
  resolvedRate: number;
  avgDuration: number;
}

export interface SentimentAnalysis {
  generatedAt: string;
  totalCalls: number;
  avgScore: number;
  distribution: { positive: number; neutral: number; negative: number };
  topEmotions: { emotion: string; count: number; pct: number }[];
  callSentiments: CallSentiment[];
  motiveGroups: MotiveGroup[];
  sentimentOutcomes: SentimentOutcomeBucket[];
  byHour: Record<number, { avgScore: number; count: number }>;
  byDayOfWeek: Record<number, { avgScore: number; count: number }>;
  byRestaurant: Record<string, {
    avgScore: number;
    distribution: { positive: number; neutral: number; negative: number };
    emotionDist: Record<string, number>;
    moodOutcomeMatrix: {
      positiveResolved: number;
      positiveTransferred: number;
      negativeResolved: number;
      negativeTransferred: number;
    };
  }>;
}

// ─── Forecast ─────────────────────────────────────────────────────────────────

export interface AssistantAdjustment {
  restaurant: string;    // 'TF Oakwood' | 'RT Buckhead' | 'Both'
  trigger: string;       // forecast signal — e.g. "~40% delivery calls predicted Mon–Thu"
  action: string;        // concrete assistant behavior change to make before the week starts
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ForecastResult {
  generatedAt: string;
  forecastWeek: string;
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  caveat: string;
  dailyForecasts: DailyForecast[];
  preventiveRecommendations: string[];
  byRestaurant: Record<string, {
    predictedWeeklyTotal: number;
    peakDay: string;
    topMotives: { category: string; pct: number }[];
    dailyVolumes: Record<string, number>;
  }>;
  assistantAdjustments: AssistantAdjustment[];
}

export interface DailyForecast {
  date: string;
  dayOfWeek: string;
  predictedVolume: number;
  predictedReasonDistribution: Record<string, number>;
  historicalAvg: number;
}
