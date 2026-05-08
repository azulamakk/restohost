import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCalls } from './loader.ts';
import { analyzeDescriptive } from './descriptive.ts';
import { classifyCalls } from './classifier.ts';
import { generateTickets } from './tickets.ts';
import { analyzePatterns } from './patterns.ts';
import { buildForecast } from './forecast.ts';
import { analyzeSentiment } from './sentiment.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../../output');

function writeJson(filename: string, data: unknown): void {
  const filePath = path.join(OUTPUT_DIR, filename);
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  const size = JSON.stringify(data).length;
  console.log(`  ✓ ${filename} (${Math.round(size / 1024)}KB)`);
}

async function main(): Promise<void> {
  console.log('RestoHost Monitoring Pipeline');
  console.log('================================\n');

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Step 1: Load data
  console.log('Step 1/6: Loading dataset...');
  const calls = await loadCalls();
  console.log(`  Loaded ${calls.length} calls\n`);

  // Step 2: Descriptive analysis
  console.log('Step 2/6: Running descriptive analysis...');
  const stats = analyzeDescriptive(calls);
  writeJson('descriptive_stats.json', stats);
  console.log(
    `  TF Oakwood: ${stats.byRestaurant['TF Oakwood'].totalCalls} calls, ${Math.round(stats.byRestaurant['TF Oakwood'].transferRate * 100)}% transfer rate`,
  );
  console.log(
    `  RT Buckhead: ${stats.byRestaurant['RT Buckhead'].totalCalls} calls, ${Math.round(stats.byRestaurant['RT Buckhead'].transferRate * 100)}% transfer rate`,
  );
  console.log();

  // Step 3: Classification
  console.log('Step 3/6: Classifying calls...');
  const classified = await classifyCalls(calls);
  writeJson('classified_calls.json', classified);

  const errorCounts: Record<string, number> = {};
  for (const c of classified) {
    if (c.isError) {
      errorCounts[c.errorCode] = (errorCounts[c.errorCode] ?? 0) + 1;
    }
  }
  console.log('  Error breakdown:');
  for (const [code, count] of Object.entries(errorCounts).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`    ${code}: ${count}`);
  }
  console.log();

  // Step 4: Generate tickets
  console.log('Step 4/6: Generating tickets...');
  const tickets = generateTickets(classified);
  writeJson('tickets.json', tickets);
  console.log(`  Generated ${tickets.length} tickets\n`);

  // Step 5: Pattern analysis + forecast
  console.log('Step 5/6: Analyzing patterns and building forecast...');
  const patterns = analyzePatterns(calls, classified);
  writeJson('patterns.json', patterns);

  const forecast = buildForecast(calls);
  writeJson('forecast.json', forecast);
  console.log(
    `  Identified ${patterns.opportunities.length} opportunities`,
  );
  console.log(
    `  Forecast week: ${forecast.forecastWeek}`,
  );
  console.log();

  // Step 6: Sentiment analysis
  console.log('Step 6/6: Analyzing sentiment and call motives...');
  const sentimentAnalysis = analyzeSentiment(classified);
  writeJson('sentiment_analysis.json', sentimentAnalysis);
  console.log(`  Avg sentiment score: ${sentimentAnalysis.avgScore.toFixed(2)}`);
  console.log(`  Emotion distribution: ${sentimentAnalysis.topEmotions.map(e => `${e.emotion}=${e.count}`).join(', ')}`);
  console.log(`  Motive groups: ${sentimentAnalysis.motiveGroups.length}`);
  console.log();

  // Summary
  console.log('Pipeline complete!');
  console.log(`  Total calls: ${calls.length}`);
  console.log(`  Errors found: ${tickets.length} (${Math.round((tickets.length / calls.length) * 100)}% of calls)`);
  console.log(`  Output directory: ${OUTPUT_DIR}`);

  console.log('\nOutput files:');
  for (const f of [
    'descriptive_stats.json',
    'classified_calls.json',
    'tickets.json',
    'patterns.json',
    'forecast.json',
    'sentiment_analysis.json',
  ]) {
    console.log(`  output/${f}`);
  }
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
