import {
  createFastlyComputeHandler,
  type FastlyComputeFetchEventLike,
} from "promptscout-live-ai-traffic-fastly-compute";

type FastlyComputeFetchEvent = FastlyComputeFetchEventLike & {
  respondWith(response: Promise<unknown>): void;
};

declare function addEventListener(
  type: "fetch",
  listener: (event: FastlyComputeFetchEvent) => void,
): void;

const handler = createFastlyComputeHandler({
  originBackend: "origin",
  ingestBackend: "promptscout_ingest",
  ingestEndpoint: "https://ingest.promptscout.com/live-ai-traffic",
  ingestToken: "placeholder-runtime-config-value",
});

addEventListener("fetch", (event) => {
  event.respondWith(handler(event));
});
