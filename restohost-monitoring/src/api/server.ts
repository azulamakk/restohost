import express from 'express';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../../output');
const PORT = 3001;

const app = express();

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

function readOutput(filename: string): unknown {
  const filePath = path.join(OUTPUT_DIR, filename);
  if (!existsSync(filePath)) {
    return {
      error: `Pipeline output not found: ${filename}. Run 'npm run pipeline' first.`,
    };
  }
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

app.get('/api/stats',    (_req, res) => res.json(readOutput('descriptive_stats.json')));
app.get('/api/tickets',  (_req, res) => res.json(readOutput('tickets.json')));
app.get('/api/patterns', (_req, res) => res.json(readOutput('patterns.json')));
app.get('/api/forecast', (_req, res) => res.json(readOutput('forecast.json')));
app.get('/api/calls',     (_req, res) => res.json(readOutput('classified_calls.json')));
app.get('/api/sentiment', (_req, res) => res.json(readOutput('sentiment_analysis.json')));

app.listen(PORT, () => {
  console.log(`RestoHost API running at http://localhost:${PORT}`);
});
