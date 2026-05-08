import type { ClassifiedCall, Ticket } from './types.ts';

export function generateTickets(classified: ClassifiedCall[]): Ticket[] {
  return classified
    .filter((c) => c.isError)
    .map((c) => ({
      conversationId: c.conversationId,
      restaurantName: c.restaurantName,
      callStartTime: c.callStartTime.toISOString(),
      callDurationSeconds: c.callDurationSeconds,
      callEndReason: c.callEndReason,
      reasonForCalling: c.reasonForCalling,
      errorCode: c.errorCode,
      errorLabel: c.errorLabel,
      severity: c.severity,
      description: c.description,
      whyItMatters: c.whyItMatters,
      proposedFix: c.proposedFix,
      confidence: c.confidence,
      source: c.source,
    }))
    .sort((a, b) => {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    });
}
