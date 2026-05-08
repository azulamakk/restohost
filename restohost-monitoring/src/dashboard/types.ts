// Dashboard-facing types (loaded from JSON output)

export type RestaurantName = 'TF Oakwood' | 'RT Buckhead';
export type CallEndReason = 'AgentHangup' | 'UserHangup' | 'CallTransfer' | 'UserInactivity';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
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

export interface DescriptiveStats {
  totalCalls: number;
  byRestaurant: Record<RestaurantName, RestaurantStats>;
  callEndReasonDist: Record<string, number>;
  temporalStats: {
    byDate: Record<string, number>;
    byHour: Record<string, number>;
    byDayOfWeek: Record<string, number>;
    peakHour: number;
    peakDay: number;
    peakDate: string;
  };
  durationStats: {
    avg: number;
    p50: number;
    p90: number;
    buckets: Record<string, number>;
  };
  smsStats: {
    totalWithSms: number;
    smsRate: number;
    reservationSmsRate: number;
  };
  callerStats: {
    uniqueCallers: number;
    repeatCallers: number;
    possibleBot: string[];
  };
  sentimentStats: {
    byRestaurant: Record<RestaurantName, { frustration: number; frustrationRate: number }>;
  };
  conversationStats: {
    avgTurns: number;
    medianLengthChars: number;
  };
}

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
  source: string;
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

export interface PatternAnalysis {
  temporalPatterns: {
    callsByHour: Record<string, number>;
    callsByDayOfWeek: Record<string, number>;
    transferRateByHour: Record<string, number>;
  };
  restaurantComparison: {
    tfOakwood: RestaurantStats;
    rtBuckhead: RestaurantStats;
  };
  opportunities: Opportunity[];
  kbGaps: Array<{ topic: string; restaurant: string; callCount: number; description: string }>;
}

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

export interface SentimentAnalysis {
  generatedAt: string;
  totalCalls: number;
  avgScore: number;
  distribution: { positive: number; neutral: number; negative: number };
  topEmotions: { emotion: string; count: number; pct: number }[];
  callSentiments: CallSentiment[];
  motiveGroups: MotiveGroup[];
  sentimentOutcomes: {
    bucket: string;
    scoreRange: [number, number];
    count: number;
    transferRate: number;
    errorRate: number;
    resolvedRate: number;
    avgDuration: number;
  }[];
  byHour: Record<string, { avgScore: number; count: number }>;
  byDayOfWeek: Record<string, { avgScore: number; count: number }>;
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

export interface AssistantAdjustment {
  restaurant: string;
  trigger: string;
  action: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ForecastResult {
  forecastWeek: string;
  confidenceLevel: string;
  caveat: string;
  dailyForecasts: Array<{
    date: string;
    dayOfWeek: string;
    predictedVolume: number;
    historicalAvg: number;
  }>;
  preventiveRecommendations: string[];
  byRestaurant: Record<string, {
    predictedWeeklyTotal: number;
    peakDay: string;
    topMotives: { category: string; pct: number }[];
    dailyVolumes: Record<string, number>;
  }>;
  assistantAdjustments: AssistantAdjustment[];
}
