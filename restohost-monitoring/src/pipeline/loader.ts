import { parse } from 'csv-parse';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Call, CallEndReason, RestaurantName } from './types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, '../../data/calls_dataset.csv');

function parseBoolean(val: string): boolean | null {
  if (val.toUpperCase() === 'TRUE') return true;
  if (val.toUpperCase() === 'FALSE') return false;
  return null;
}

function parseDuration(val: string): number {
  if (!val) return 0;
  const parts = val.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]!, 10) * 60 + parseInt(parts[1]!, 10);
  }
  return 0;
}

function parseTextsSent(val: string): string[] {
  if (!val || val.trim() === '') return [];
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function loadCalls(): Promise<Call[]> {
  return new Promise((resolve, reject) => {
    const calls: Call[] = [];

    const stream = createReadStream(CSV_PATH, { encoding: 'latin1' });

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
    });

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        try {
          const call: Call = {
            conversationId: record.conversationId ?? '',
            restaurantName: record.restaurantName as RestaurantName,
            callStartTime: new Date(record.callStartTime),
            callDurationSeconds: parseDuration(record.callDuration),
            callEndReason: record.callEndReason as CallEndReason,
            callWithinOfficeHours: parseBoolean(record.callWithinOfficeHours),
            reasonForCalling: record.reasonForCalling ?? '',
            partySizeNumber: record.partysizenumber
              ? parseInt(record.partysizenumber, 10) || null
              : null,
            textsSent: parseTextsSent(record.textsSent),
            numberOfTextsSent: parseInt(record.numberOfTextsSent, 10) || 0,
            phone: record.phone ?? '',
            conversation: record.conversation ?? '',
          };
          calls.push(call);
        } catch (err) {
          console.warn(`Skipping malformed record: ${err}`);
        }
      }
    });

    parser.on('error', reject);
    parser.on('end', () => resolve(calls));

    stream.pipe(parser);
  });
}
