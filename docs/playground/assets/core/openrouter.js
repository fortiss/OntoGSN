// assets/core/openrouter.js
// Reusable OpenRouter helpers (non-streaming chat.completions)

export const OPENROUTER_CHAT_ENDPOINT =
  "https://openrouter.ai/api/v1/chat/completions";

export const OPENROUTER_DEFAULT_MODEL = "openai/gpt-4o-mini";

export const OPENROUTER_STORAGE_KEYS = {
  apiKey: "ontogsn.chat.openrouter_api_key",
  model: "ontogsn.chat.openrouter_model",
};

// Names that earlier versions used in localStorage. They are deleted on load.
const LEGACY_STORAGE_KEYS = ["openrouter_api_key", "openrouter_model"];

// ---- prefs ---------------------------------------------------------------
// A page on GitHub Pages shares its origin with other projects of the same owner.
// The API key therefore lives in sessionStorage only: it is gone when the tab closes.
// The model name is not a secret, so it stays in localStorage across visits.

function dropLegacyKeys() {
  try {
    for (const k of LEGACY_STORAGE_KEYS) localStorage.removeItem(k);
  } catch {}
}

export function loadOpenRouterPrefs(opts = {}) {
  const {
    apiKeyKey = OPENROUTER_STORAGE_KEYS.apiKey,
    modelKey = OPENROUTER_STORAGE_KEYS.model,
    defaultModel = OPENROUTER_DEFAULT_MODEL,
  } = opts;

  // Be defensive (some environments block storage)
  let apiKey = "";
  let model = defaultModel;

  dropLegacyKeys();

  try {
    apiKey = sessionStorage.getItem(apiKeyKey) || "";
  } catch {}
  try {
    model = localStorage.getItem(modelKey) || defaultModel;
  } catch {}

  return { apiKey, model };
}

export function saveOpenRouterPrefs(opts = {}) {
  const {
    apiKey,
    model,
    apiKeyKey = OPENROUTER_STORAGE_KEYS.apiKey,
    modelKey = OPENROUTER_STORAGE_KEYS.model,
  } = opts;

  try {
    if (typeof apiKey === "string") sessionStorage.setItem(apiKeyKey, apiKey);
  } catch {}
  try {
    if (typeof model === "string") localStorage.setItem(modelKey, model);
  } catch {}
}

// ---- request helpers -----------------------------------------------------

export function buildOpenRouterHeaders(apiKey, opts = {}) {
  const {
    referer = location.origin,
    title = "App",
    extraHeaders = {},
  } = opts;

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": referer, // recommended by OpenRouter for attribution/analytics
    "X-Title": title,        // recommended by OpenRouter for attribution/analytics
    ...extraHeaders,
  };
}

// Low-level call: returns parsed JSON
export async function openRouterChatCompletions(opts = {}) {
  const {
    apiKey,
    model = OPENROUTER_DEFAULT_MODEL,
    messages = [],
    temperature = 0.2,
    maxTokens = 10000,
    endpoint = OPENROUTER_CHAT_ENDPOINT,
    referer = location.origin,
    title = "App",
    signal,
  } = opts;

  if (!apiKey) throw new Error("Missing OpenRouter API key.");
  if (!model) throw new Error("Missing model.");
  if (!messages) throw new Error("Missing messages.");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: buildOpenRouterHeaders(apiKey, { referer, title }),
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${t}`);
  }

  return res.json();
}

// High-level helper: returns assistant message content (string)
export async function askOpenRouter(opts = {}) {
  const data = await openRouterChatCompletions(opts);
  return data?.choices?.[0]?.message?.content || "";
}
