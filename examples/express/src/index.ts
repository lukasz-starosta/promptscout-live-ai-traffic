import type {
  LiveAiTrafficEvent,
  LiveAiTrafficIngestClient,
} from "@promptscout/live-ai-traffic/core";
import {
  createExpressLiveAiTrafficMiddleware,
  type ExpressNext,
  type ExpressRequestLike,
  type ExpressResponseLike,
  type LiveAiTrafficNodeMiddlewareOptions,
} from "promptscout-live-ai-traffic-node-middleware";

declare const process:
  | {
      env: Record<string, string | undefined>;
      argv: string[];
    }
  | undefined;
declare const console:
  | {
      log(...values: unknown[]): void;
      error(...values: unknown[]): void;
    }
  | undefined;

type ExpressFactory = () => ExpressLikeApp;

type ExpressLikeApp = {
  use(
    middleware: (
      request: ExpressRequestLike,
      response: ExpressResponseLike,
      next: ExpressNext,
    ) => void,
  ): void;
  get(
    path: string,
    handler: (
      request: ExpressRequestLike,
      response: ExpressLikeResponse,
    ) => void,
  ): void;
  listen(port: number, hostname: string, callback: () => void): void;
};

type ExpressLikeResponse = ExpressResponseLike & {
  json(body: unknown): void;
};

type HttpModuleLike = {
  createServer(
    handler: (request: ExpressRequestLike, response: HttpResponseLike) => void,
  ): {
    listen(port: number, hostname: string, callback: () => void): void;
  };
};

type HttpResponseLike = ExpressLikeResponse & {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

export function createExampleApp(
  express: ExpressFactory,
  env: Record<string, string | undefined> = process?.env ?? {},
): ExpressLikeApp {
  const app = express();

  app.use(createExpressLiveAiTrafficMiddleware(optionsFromEnv(env)));

  app.get("/", (_request, response) => {
    response.json({
      ok: true,
      message: "PromptScout live AI traffic Express example",
    });
  });

  return app;
}

export async function main(
  env: Record<string, string | undefined> = process?.env ?? {},
): Promise<void> {
  const express = await loadExpressFactory();
  const app = createExampleApp(express, env);
  const port = Number(env.PORT ?? 3000);
  const hostname = env.HOST ?? "127.0.0.1";

  app.listen(port, hostname, () => {
    console?.log(
      `PromptScout Express example listening on http://${hostname}:${port}`,
    );
  });
}

function optionsFromEnv(
  env: Record<string, string | undefined>,
): LiveAiTrafficNodeMiddlewareOptions {
  if (env.PROMPTSCOUT_MOCK_INGEST !== "0") {
    return {
      client: createMockIngestClient(),
      onError(error) {
        console?.error("PromptScout mock ingest failed", error);
      },
    };
  }

  return {
    endpoint: env.PROMPTSCOUT_INGEST_ENDPOINT,
    ingestToken: env.PROMPTSCOUT_INGEST_TOKEN,
    siteId: env.PROMPTSCOUT_SITE_ID,
    signingSecret: env.PROMPTSCOUT_SIGNING_SECRET,
    onError(error) {
      console?.error("PromptScout ingest failed", error);
    },
  };
}

function createMockIngestClient(): LiveAiTrafficIngestClient {
  return {
    async send(event) {
      console?.log("PromptScout mock live AI traffic event", summarize(event));
      return {
        ok: true,
        status: 202,
        attempts: 1,
        retryable: false,
        authFailure: false,
      };
    },
    async sendBatch(events) {
      for (const event of events) {
        console?.log(
          "PromptScout mock live AI traffic event",
          summarize(event),
        );
      }

      return {
        ok: true,
        status: 202,
        attempts: 1,
        retryable: false,
        authFailure: false,
      };
    },
  };
}

function summarize(event: LiveAiTrafficEvent): Record<string, unknown> {
  return {
    observedAt: event.observedAt,
    path: event.request.path,
    provider: event.providerClassification.provider,
    agentType: event.providerClassification.agentType,
  };
}

function optionalImport(specifier: string): Promise<unknown> {
  const importer = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<unknown>;

  return importer(specifier);
}

async function loadExpressFactory(): Promise<ExpressFactory> {
  try {
    const expressModule = (await optionalImport("express")) as {
      default?: ExpressFactory;
    } & ExpressFactory;

    return expressModule.default ?? expressModule;
  } catch {
    const httpModule = (await optionalImport("node:http")) as HttpModuleLike;
    return createNodeHttpExpressFactory(httpModule);
  }
}

function createNodeHttpExpressFactory(http: HttpModuleLike): ExpressFactory {
  return () => {
    const middlewareStack: Array<
      (
        request: ExpressRequestLike,
        response: ExpressResponseLike,
        next: ExpressNext,
      ) => void
    > = [];
    const getRoutes = new Map<
      string,
      (request: ExpressRequestLike, response: ExpressLikeResponse) => void
    >();

    return {
      use(middleware) {
        middlewareStack.push(middleware);
      },
      get(path, handler) {
        getRoutes.set(path, handler);
      },
      listen(port, hostname, callback) {
        http
          .createServer((request, response) => {
            const wrappedResponse = withJsonResponse(response);
            let index = 0;
            const next: ExpressNext = (error) => {
              if (error !== undefined) {
                wrappedResponse.statusCode = 500;
                wrappedResponse.end("Internal Server Error");
                return;
              }

              const middleware = middlewareStack[index];
              index += 1;
              if (middleware !== undefined) {
                middleware(request, wrappedResponse, next);
                return;
              }

              const path = request.url?.split("?", 1)[0] ?? "/";
              const route = getRoutes.get(path);
              if (request.method === "GET" && route !== undefined) {
                route(request, wrappedResponse);
                return;
              }

              wrappedResponse.statusCode = 404;
              wrappedResponse.end("Not Found");
            };

            next();
          })
          .listen(port, hostname, callback);
      },
    };
  };
}

function withJsonResponse(response: HttpResponseLike): HttpResponseLike {
  response.json = (body: unknown) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(body));
  };

  return response;
}

if (process?.argv[1]?.endsWith("/dist/index.js")) {
  void main().catch((error) => {
    console?.error(error);
  });
}
