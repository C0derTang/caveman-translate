# caveman-translate

Caveman mode with EN↔ZH translation. Type in English, Claude thinks in Mandarin Chinese, you see English.

## Live Benchmark

**https://caveman-benchmark.surge.sh**

Token comparison across 10 coding prompts using Claude MiniMax M2.7 API.

## Results

| Mode | Avg Input | Avg Output | Avg Total | vs Baseline |
|------|-----------|------------|-----------|-------------|
| Baseline | 31 | 837 | 868 | — |
| **caveman-full** | 183 | 369 | 552 | **-36%** |
| caveman-translate | 267 | 475 | 743 | -14% |

**caveman-full** cuts output tokens ~56% (837 → 369) with 36% total token savings.

**caveman-translate** adds ~85 input token overhead from wenyan rules + translation context but doesn't compress as aggressively in English output.

## How It Works

1. You type prompt in English
2. `UserPromptSubmit` hook translates EN → ZH via Google Translate API
3. Claude receives Mandarin prompt, responds in Mandarin (wenyan mode)
4. `caveman-translate` MCP middleware translates ZH → EN transparently
5. You see English output

## Setup

### 1. Google Translate API Key

Get a key from [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
- Create project → Enable "Cloud Translation API" → Create API Key
- Free tier: 500K chars/month

### 2. Configure Claude Code

Add to your `settings.json`:

```json
{
  "env": {
    "GOOGLE_TRANSLATE_API_KEY": "your-key-here",
    "CAVEMAN_TRANSLATE": "1"
  },
  "plugins": {
    "installed": [
      { "path": "/path/to/caveman-translate" }
    ]
  }
}
```

### 3. Activate

```
/caveman wenyan-full
```

## What Gets Translated

- Prompts: EN → ZH before Claude sees them
- Responses: ZH → EN before you see them
- Code blocks, URLs, file paths: **not translated**

## Cavecrew Subagents

Caveman ships with three subagents for delegated work:

- **cavecrew-investigator** — read-only code locator. Finds symbols, paths, usages.
- **cavecrew-builder** — surgical 1-2 file editor. Refuses 3+ file scope.
- **cavecrew-reviewer** — diff/file reviewer. One-line findings with severity.

## File Structure

```
caveman/
├── skills/caveman/           # Wenyan mode skill
├── src/
│   ├── hooks/                # Claude Code hooks (activate, config, mode-tracker)
│   └── mcp-servers/
│       └── caveman-translate/  # ZH→EN MCP middleware
└── benchmarks/
    ├── index.html            # Live benchmark dashboard
    └── results.json          # Raw token data
```

## Benchmarks

Run your own benchmarks:

```bash
cd benchmarks
node run.js
```

Requires `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` in environment.

## License

MIT
