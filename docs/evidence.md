# Classifier Evidence

PromptScout Live AI Traffic is request-level instrumentation. It classifies
requests that actually reached a customer site by inspecting request headers and
edge logs from supported collectors. It must not assume that a browser beacon,
client-side analytics pixel, or later AI answer can prove crawler visibility.

JavaScript pixels are not complete AI crawler tracking. The Vercel and MERJ
crawler research found that major AI crawlers did not render client-side
JavaScript in their tests, so a script tag that runs after hydration can miss
the very traffic this project is meant to observe. The OpenAI crawler docs also
distinguish automated crawlers from user-triggered fetchers, which means the
same provider can produce different request-level signals with different
purposes.

## Sources

- OpenAI crawler docs: https://platform.openai.com/docs/bots
- OpenAI ChatGPT generated links:
  https://help.openai.com/en/articles/10984597-chatgpt-generated-links
- OpenAI ChatGPT shared links:
  https://help.openai.com/en/articles/7925741-chatgpt-shared-links-faq
- Claude shared chats:
  https://support.claude.com/en/articles/10593882-sharing-and-unsharing-chats
- Perplexity crawlers and response links:
  https://docs.perplexity.ai/docs/resources/perplexity-crawlers
- Gemini shared chats:
  https://support.google.com/gemini/answer/13743730
- Microsoft Copilot surfaces:
  https://support.microsoft.com/en-us/microsoft-365-copilot/what-s-the-difference-between-microsoft-copilot-free-and-copilot-in-microsoft-365
- Microsoft 365 Copilot web grounding:
  https://learn.microsoft.com/en-us/microsoft-365/copilot/manage-public-web-access
- Microsoft 365 Copilot Chat overview:
  https://learn.microsoft.com/en-us/copilot/overview
- Vercel and MERJ AI crawler behavior research:
  https://vercel.com/blog/the-rise-of-the-ai-crawler
- Vercel AI SEO guidance:
  https://vercel.com/i/how-ai-is-changing-seo

## Why Request-Level Visibility Is Required

AI crawler and assistant traffic can be server-to-server, edge-observed, or
user-triggered. A complete collector therefore needs request data from the
platform that received the HTTP request: user agent, referer, host, path, method,
timestamp, and integration metadata. Client-side pixels only observe browser
execution after a page loads and cannot cover crawlers that fetch HTML without
executing JavaScript.

The classifier treats the observation as evidence of traffic, not proof of an AI
answer or citation. A GPTBot request shows that GPTBot requested the page. A
ChatGPT-User request shows a user-triggered fetch from ChatGPT. A referer from an
assistant surface suggests follow-on browser traffic from that surface, but it is
weaker than a documented crawler user agent.

## High-Confidence Signals

High-confidence signals are request user agents that match a documented crawler
or user-fetch token. The fixture names in
`packages/core/fixtures/classifier/known-user-agents.json` trace each signal to a
source URL and the classifier rule that matched it.

| Signal source | Fixture examples | Why it is high confidence |
| --- | --- | --- |
| `user_agent` | `openai-oai-searchbot`, `openai-gptbot`, `openai-chatgpt-user` | OpenAI documents distinct crawler and user-fetch user agents. |
| `user_agent` | `anthropic-claudebot`, `anthropic-claude-searchbot`, `anthropic-claude-user` | Anthropic documents crawler and user-fetch identifiers. |
| `user_agent` | `perplexitybot`, `perplexity-user` | Perplexity documents bot and user-fetch identifiers. |
| `user_agent` | `google-agent`, `googleother` | Google documents crawler and user-triggered fetcher families. |
| `user_agent` | `meta-externalagent`, `bytedance-bytespider` | Public crawler docs or empirical crawler research identify the tokens. |

## Weak or Advisory Signals

Weak or advisory signals are useful for context but should not override a
higher-confidence user-agent match. Referers can be absent, stripped, rewritten,
or copied by browsers and intermediaries. The fixture names in
`packages/core/fixtures/classifier/known-referrers.json` keep these cases
reproducible while marking them as advisory.

| Signal source | Fixture examples | How to interpret it |
| --- | --- | --- |
| `referer` | `chatgpt-share-referral`, `claude-referral`, `perplexity-search-referral` | Likely browser traffic from an AI assistant surface. |
| `referer` | `gemini-referral`, `copilot-referral`, `bing-chat-referral`, `meta-ai-referral` | Assistant-surface traffic, useful for attribution but not crawler proof. |
| `referer` | `google-search-referral` | Conventional search referral baseline, not AI crawler traffic. |

## AI Referral Research Notes

Last reviewed: 2026-05-27.

The AI referral rules intentionally match only provider-owned chat or answer
surfaces with current public evidence:

| Provider surface | Matched examples | Source basis | Confidence |
| --- | --- | --- | --- |
| ChatGPT | `https://chatgpt.com/share/...`, `https://chatgpt.com/` | OpenAI documents ChatGPT-generated outbound links and `chatgpt.com/share/...` shared-link URLs. | Advisory, `0.78` |
| Claude | `https://claude.ai/chat/...` | Claude documents shareable chat snapshots from the Claude product and links users to `claude.ai` settings for shared chats. | Advisory, `0.72` |
| Perplexity | `https://www.perplexity.ai/search/...` | Perplexity documents responses that include links to pages surfaced by Perplexity. | Advisory, `0.74` |
| Gemini | `https://gemini.google.com/app/...` | Gemini documents its web app and public shared-chat flow, including redirects back to `gemini.google.com`. | Advisory, `0.70` |
| Copilot/Bing | `https://copilot.microsoft.com/...`, `https://www.bing.com/chat...` | Microsoft documents Copilot availability at `copilot.microsoft.com`, in Edge, and in Microsoft Bing, plus Bing-backed web grounding. | Advisory, `0.70` |

Referer behavior is treated as an observed request signal, not a provider
guarantee. Browsers and in-app surfaces can omit or rewrite `Referer`, and some
AI products also append query parameters such as UTM tags. The core privacy
helpers therefore strip referer query strings and fragments, and AI referral
visit events omit the landing-page query string before storage or forwarding.

Explicit non-goals:

- Do not infer AI referral traffic from arbitrary `utm_source` values without a
  matching provider-owned referer.
- Do not classify Google Search or AI Overview clicks as Gemini traffic when the
  referer is only a normal Google Search URL.
- Do not treat referral visits as crawler, training, or user-triggered fetch
  events.
- Do not store raw prompts, raw query strings, or UTM parameters from referers or
  referral landing-page URLs.

## Validation Fixtures

Classifier fixture tests load named JSON records instead of prose-only
assumptions. Each record includes:

- `name`: stable fixture identifier used in assertion messages.
- `signalSource`: signal kind used by the classifier, such as `user_agent` or
  `referer`.
- `confidenceLabel`: `high` for documented user-agent matches or `advisory` for
  referral-only matches.
- `sourceUrl`: public source for the signal family.
- `matchedRule`: classifier registry rule expected for the fixture.

This keeps confidence labels traceable to a source and makes future provider
changes testable without relying on undocumented beacon assumptions.
