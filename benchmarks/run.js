const fs = require('fs');
const path = require('path');

const API_BASE = process.env.ANTHROPIC_BASE_URL || 'https://api.minimax.io/anthropic';
const API_KEY = process.env.ANTHROPIC_AUTH_TOKEN;
const MODEL = process.env.ANTHROPIC_MODEL || 'MiniMax-M2.7';

const prompts = [
  "Write a function to reverse a string in JavaScript",
  "How do I read a file in Python and handle errors?",
  "Explain the difference between let and const in JavaScript",
  "Write a CSS flexbox layout for a responsive navbar",
  "How do I merge two sorted arrays in Python?",
  "What is the purpose of useEffect in React?",
  "Write a function to find the longest palindrome in a string",
  "How do I connect to a PostgreSQL database in Node.js?",
  "Explain REST API conventions and best practices",
  "Write a bash script to find and replace text in files"
];

const SYSTEM_PROMPTS = {
  baseline: "You are a helpful coding assistant.",

  "caveman-full": "Respond terse like smart caveman. All technical substance stay. Only fluff die.\n\nACTIVE EVERY RESPONSE. No revert after many turns. No filler drift. Still active if unsure. Off only: \"stop caveman\" / \"normal mode\".\n\nDefault: full.\n\nRules:\n\nDrop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging. Fragments OK. Short synonyms (big not extensive, fix not \"implement a solution for\"). Technical terms exact. Code blocks unchanged. Errors quoted exact.\n\nPattern: [thing] [action] [reason]. [next step].\n\nIntensity level: full — Drop articles, fragments OK, short synonyms. Classic caveman.",

  "caveman-translate": "Respond terse like smart caveman. All technical substance stay. Only fluff die.\n\nACTIVE EVERY RESPONSE. No revert after many turns. No filler drift. Still active if unsure. Off only: \"stop caveman\" / \"normal mode\".\n\nDefault: full.\n\nRules:\n\nDrop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging. Fragments OK. Short synonyms (big not extensive, fix not \"implement a solution for\"). Technical terms exact. Code blocks unchanged. Errors quoted exact.\n\nPattern: [thing] [action] [reason]. [next step].\n\nIntensity level: wenyan-full — Maximum classical terseness. Fully 文言文. 80-90% character reduction. Classical sentence patterns, verbs precede objects, subjects often omitted, classical particles (之/乃/為/其).\n\nTranslation mode: Your prompts are translated EN→ZH via Google Translate before the model sees them. Model responses in Mandarin are translated ZH→EN before returned. You type English, you see English, model thinks in Mandarin. Code, URLs, and technical content are preserved."
};

async function callAPI(systemPrompt, userPrompt) {
  const url = API_BASE + "/v1/messages";

  const body = {
    model: MODEL,
    messages: [{ role: "user", content: userPrompt }],
    max_tokens: 1024,
    system: systemPrompt
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("API error " + response.status + ": " + text);
  }

  return await response.json();
}

function extractTokens(data) {
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens
  };
}

async function runBenchmarks() {
  console.log("API: " + API_BASE);
  console.log("Model: " + MODEL);
  console.log("Prompts: " + prompts.length);
  console.log("Modes: " + Object.keys(SYSTEM_PROMPTS).join(", "));
  console.log("");

  const results = {
    prompts: prompts,
    results: {
      baseline: [],
      "caveman-full": [],
      "caveman-translate": []
    }
  };

  const modes = Object.keys(SYSTEM_PROMPTS);

  for (const mode of modes) {
    console.log("\n=== Mode: " + mode + " ===");
    const systemPrompt = SYSTEM_PROMPTS[mode];

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      process.stdout.write("  [" + (i + 1) + "/" + prompts.length + "] \"" + prompt + "\" ... ");

      let attempt = 0;
      const maxAttempts = 3;
      let lastError;

      while (attempt < maxAttempts) {
        try {
          const data = await callAPI(systemPrompt, prompt);
          const tokens = extractTokens(data);
          results.results[mode].push(tokens);
          process.stdout.write("OK input=" + tokens.input_tokens + " output=" + tokens.output_tokens + " total=" + tokens.total_tokens + "\n");
          break;
        } catch (err) {
          lastError = err;
          attempt++;
          if (attempt < maxAttempts) {
            process.stdout.write("retry(" + attempt + ")... ");
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
      }

      if (attempt === maxAttempts) {
        console.error("FAILED after " + maxAttempts + " attempts: " + lastError.message);
        results.results[mode].push({ input_tokens: -1, output_tokens: -1, total_tokens: -1, error: lastError.message });
      }

      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log("\n\n=== SUMMARY ===");
  for (const mode of modes) {
    const r = results.results[mode];
    const valid = r.filter(x => x.input_tokens >= 0);
    if (valid.length === 0) continue;
    const avgInput = valid.reduce((s, x) => s + x.input_tokens, 0) / valid.length;
    const avgOutput = valid.reduce((s, x) => s + x.output_tokens, 0) / valid.length;
    const avgTotal = valid.reduce((s, x) => s + x.total_tokens, 0) / valid.length;
    console.log(mode + ":");
    console.log("  avg input_tokens:  " + avgInput.toFixed(1));
    console.log("  avg output_tokens: " + avgOutput.toFixed(1));
    console.log("  avg total_tokens:  " + avgTotal.toFixed(1));
  }

  const outPath = path.join(__dirname, "results.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log("\nResults written to " + outPath);

  return results;
}

runBenchmarks().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
