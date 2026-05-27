import {
  buildPromptScoutVercelAiTrafficEvent,
  trackPromptScoutAiTraffic,
} from "../../packages/vercel-middleware/dist/index.js";

const dogfoodRequests = [
  {
    label: "chatgpt-user",
    userAgent: "ChatGPT-User/1.0",
    expectedProvider: "openai_chatgpt_user",
    path: "/promptscout-dogfood/chatgpt-user",
    referer: "https://chatgpt.com/share/promptscout-dogfood",
  },
  {
    label: "oai-searchbot",
    userAgent: "OAI-SearchBot/1.0",
    expectedProvider: "openai_search_bot",
    path: "/promptscout-dogfood/oai-searchbot",
  },
  {
    label: "gptbot",
    userAgent: "GPTBot/1.3",
    expectedProvider: "openai_gptbot",
    path: "/promptscout-dogfood/gptbot",
  },
];

const ingestUrl = requiredEnv("PROMPTSCOUT_INGEST_URL");
const ingestToken = requiredEnv("PROMPTSCOUT_INGEST_TOKEN");
const dogfoodHost =
  process.env.PROMPTSCOUT_DOGFOOD_HOST ?? "vercel-dogfood.promptscout.test";
const debugUrl = optionalEnv("PROMPTSCOUT_DOGFOOD_DEBUG_URL");
const debugBearerToken = optionalEnv("PROMPTSCOUT_DOGFOOD_DEBUG_BEARER_TOKEN");
const expectedSourceId = optionalEnv("PROMPTSCOUT_DOGFOOD_EXPECT_SOURCE_ID");
const expectedSourceHost =
  optionalEnv("PROMPTSCOUT_DOGFOOD_EXPECT_SOURCE_HOST") ?? dogfoodHost;

const sent = [];

for (const requestCase of dogfoodRequests) {
  const request = nextRequestLike(requestCase);
  const waitUntilPromises = [];
  const event = await buildPromptScoutVercelAiTrafficEvent(request, {
    now: () => new Date(),
    privacy: {
      query: { mode: "omit" },
      ip: { mode: "disabled" },
    },
  });

  if (event.sourceProvider !== "vercel") {
    throw new Error(
      `Expected sourceProvider vercel, got ${event.sourceProvider}`,
    );
  }

  if (event.providerClassification.provider !== requestCase.expectedProvider) {
    throw new Error(
      `Expected ${requestCase.expectedProvider}, got ${event.providerClassification.provider}`,
    );
  }

  const result = trackPromptScoutAiTraffic(
    request,
    {
      waitUntil(promise) {
        waitUntilPromises.push(promise);
      },
    },
    {
      endpoint: ingestUrl,
      ingestToken,
      now: () => new Date(),
      privacy: {
        query: { mode: "omit" },
        ip: { mode: "disabled" },
      },
    },
  );

  if (!result.tracked) {
    throw new Error(
      `Expected ${requestCase.userAgent} to be tracked, got ${result.reason}`,
    );
  }

  if (waitUntilPromises.length !== 1) {
    throw new Error(
      `Expected one waitUntil ingest promise for ${requestCase.userAgent}`,
    );
  }

  const ingestResult = await waitUntilPromises[0];

  if (!ingestResult.ok) {
    const body = ingestResult.responseBody ?? ingestResult.error?.message ?? "";
    throw new Error(
      `PromptScout ingest rejected ${requestCase.userAgent}: status=${ingestResult.status ?? "network_error"} body=${body}`,
    );
  }

  sent.push({
    userAgent: requestCase.userAgent,
    sourceProvider: event.sourceProvider,
    provider: event.providerClassification.provider,
    agentType: event.providerClassification.agentType,
    status: ingestResult.status,
    attempts: ingestResult.attempts,
    host: event.request.host,
    path: event.request.path,
  });
}

const debug =
  debugUrl === undefined
    ? {
        checked: false,
        reason: "PROMPTSCOUT_DOGFOOD_DEBUG_URL not set",
      }
    : await verifyDebugSurface({
        debugUrl,
        debugBearerToken,
        expectedSourceId,
        expectedSourceHost,
        sent,
      });

console.log(
  JSON.stringify(
    {
      ok: true,
      sent,
      debug,
      limitations: [
        "Vercel Hobby and Pro both execute Proxy/Middleware, but plan-level traffic volume, logs, and observability differ.",
        "Proxy and older middleware.ts setups must use a matcher that includes the routes you want to observe.",
        "The recommended matcher excludes API routes, Next.js internals, metadata files, and common static assets.",
      ],
    },
    null,
    2,
  ),
);

function nextRequestLike(requestCase) {
  const url = `https://${dogfoodHost}${requestCase.path}?promptscout_dogfood=${requestCase.label}`;
  const headers = new Headers({
    host: dogfoodHost,
    "user-agent": requestCase.userAgent,
    "x-forwarded-for": "203.0.113.10",
    "x-vercel-id": `iad1::promptscout-dogfood::${requestCase.label}`,
    "x-vercel-ip-country": "US",
    "x-vercel-ip-country-region": "VA",
  });

  if (requestCase.referer !== undefined) {
    headers.set("referer", requestCase.referer);
  }

  return {
    method: "GET",
    url,
    nextUrl: {
      hostname: dogfoodHost,
      pathname: requestCase.path,
      search: `?promptscout_dogfood=${requestCase.label}`,
    },
    headers,
  };
}

async function verifyDebugSurface({
  debugUrl,
  debugBearerToken,
  expectedSourceId,
  expectedSourceHost,
  sent,
}) {
  const headers = { accept: "application/json" };

  if (debugBearerToken !== undefined) {
    headers.authorization = `Bearer ${debugBearerToken}`;
  }

  const response = await fetch(debugUrl, { headers });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `PromptScout debug surface returned ${response.status}: ${body}`,
    );
  }

  const debugText = body.trim();
  assertDebugContains(debugText, "vercel", "sourceProvider vercel");
  assertDebugContains(
    debugText,
    expectedSourceHost,
    "site source host metadata",
  );

  if (expectedSourceId !== undefined) {
    assertDebugContains(debugText, expectedSourceId, "source_id");
  } else {
    assertDebugMatches(debugText, /source_id|sourceId/, "source_id field");
  }

  for (const event of sent) {
    assertDebugContains(debugText, event.provider, event.provider);
  }

  return {
    checked: true,
    status: response.status,
    sourceId: expectedSourceId ?? "matched source_id/sourceId field",
    sourceHost: expectedSourceHost,
  };
}

function assertDebugContains(debugText, expected, label) {
  if (!debugText.includes(expected)) {
    throw new Error(`Debug surface did not include ${label}: ${expected}`);
  }
}

function assertDebugMatches(debugText, pattern, label) {
  if (!pattern.test(debugText)) {
    throw new Error(`Debug surface did not include ${label}`);
  }
}

function requiredEnv(name) {
  const value = optionalEnv(name);

  if (value === undefined) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function optionalEnv(name) {
  const value = process.env[name];
  return value === undefined || value.trim().length === 0
    ? undefined
    : value.trim();
}
