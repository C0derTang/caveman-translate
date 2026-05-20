# caveman

Talk like smart caveman. Same brain, fewer tokens.

## What it does

Compress every model response to caveman-style prose. Drops articles, filler, pleasantries, and hedging. Keeps every technical detail, code block, error string, and symbol exact. Cuts ~65-75% of output tokens with full accuracy preserved. Mode persists for the whole session until changed or stopped.

Six intensity levels:

| Level | What change |
|-------|-------------|
| `lite` | Drop filler/hedging. Sentences stay full. Professional but tight. |
| `full` | Default. Drop articles, fragments OK, short synonyms. |
| `ultra` | Bare fragments. Abbreviations (DB, auth, fn). Arrows for causality. |
| `wenyan-lite` | Classical Chinese register, light compression. |
| `wenyan-full` | Maximum 文言文. 80-90% character reduction. |
| `wenyan-ultra` | Extreme classical compression. |

Auto-clarity rule: caveman drops to normal prose for security warnings, irreversible-action confirmations, multi-step sequences where fragment ambiguity risks misread, and when user repeats a question. Resumes after the clear part.

## How to invoke

```
/caveman              # full mode (default)
/caveman lite         # lighter compression
/caveman ultra        # extreme compression
/caveman wenyan       # classical Chinese
stop caveman          # back to normal prose
```

## Example output

Question: "Why does my React component re-render?"

Normal prose:
> Your component re-renders because you create a new object reference each render. Wrapping it in `useMemo` will fix the issue.

Caveman (full):
> New object ref each render. Inline object prop = new ref = re-render. Wrap in `useMemo`.

Caveman (ultra):
> Inline obj prop → new ref → re-render. `useMemo`.

## Wenyan Translation Mode

When you want Claude to think in classical Chinese while you type in English.

**How it works:**
1. You type in English
2. Hook translates your prompt EN→ZH via Google Translate
3. Claude sees and responds in Mandarin (wenyan mode)
4. MCP middleware translates the response ZH→EN
5. You see English output

**Setup:**

1. Get Google Translate API key:
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create API Key, enable "Cloud Translation API"
   - Free tier: 500K chars/month

2. Add to your Claude Code `settings.json`:
   ```json
   {
     "env": {
       "GOOGLE_TRANSLATE_API_KEY": "your-key-here",
       "CAVEMAN_TRANSLATE": "1"
     }
   }
   ```

3. Activate:
   ```
   /caveman wenyan-full
   ```

**What you get:**
- You type English
- Claude thinks in classical Chinese (wenyan mode)
- You see English response
- Translation is transparent — no code, URLs, or technical content is translated

## See also

- [`SKILL.md`](./SKILL.md) — full LLM-facing instructions
