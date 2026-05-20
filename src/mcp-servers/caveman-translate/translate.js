// translate.js — Google Translate API v2 client
// translate(text, targetLang, apiKey) → Promise<string>
// targetLang: 'zh' for EN→ZH, 'en' for ZH→EN

const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';

async function translate(text, targetLang, apiKey) {
  const url = `${GOOGLE_TRANSLATE_URL}?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      target: targetLang,
      source: 'auto',
    }),
  });

  if (!res.ok) {
    throw new Error(`Google Translate API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  return json.data.translations[0].translatedText;
}

module.exports = { translate };