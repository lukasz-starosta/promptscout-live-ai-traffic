# CloudFront/AWS Integration

## Implementation Decision

PromptScout supports AWS CloudFront collection through CloudFront real-time
access logs delivered to Kinesis Data Streams, then a regional Lambda or Kinesis
consumer forwards normalized live AI traffic events to PromptScout.

Do not use CloudFront Functions for PromptScout delivery. CloudFront Functions
are suitable for lightweight request/response mutation, but they cannot perform
the outbound network POST required for PromptScout ingest. Lambda@Edge can make
network calls, but it is not the first supported path because it carries edge
runtime limits around deployment region, versioning, environment variables, and
operational blast radius.

## Data Flow

1. Create a CloudFront real-time log configuration.
2. Select the PromptScout field set:
   `timestamp`, `c-ip`, `sc-status`, `cs-method`, `cs-protocol`, `cs-host`,
   `cs-uri-stem`, `x-edge-request-id`, `cs-user-agent`, `cs-referer`,
   `cs-uri-query`, and `c-country`.
3. Attach the real-time log configuration to the distribution cache behaviors
   that should emit request observations.
4. Deliver real-time logs to Kinesis Data Streams.
5. Run a regional Lambda or Kinesis consumer that imports
   `handlePromptScoutCloudFrontAwsKinesisEvent` from
   `@promptscout/live-ai-traffic-cloudfront-aws`.
6. Store the site-scoped PromptScout ingest token in the regional runtime secret
   store and forward events in batches.

The package does not depend on the AWS SDK. It accepts the standard Lambda
Kinesis event shape, decodes each base64 record, parses tab-delimited
CloudFront real-time log records by configured field order, classifies AI
traffic using the shared PromptScout rules, and sends normalized events through
the shared ingest client.

## Consumer Sketch

```ts
import {
  handlePromptScoutCloudFrontAwsKinesisEvent,
  recommendedCloudFrontRealtimeLogFields,
} from "@promptscout/live-ai-traffic-cloudfront-aws";

export async function handler(event: unknown) {
  return handlePromptScoutCloudFrontAwsKinesisEvent(
    event,
    {
      PROMPTSCOUT_INGEST_URL: process.env.PROMPTSCOUT_INGEST_URL ?? "",
      PROMPTSCOUT_INGEST_TOKEN: process.env.PROMPTSCOUT_INGEST_TOKEN ?? "",
    },
    {
      fields: recommendedCloudFrontRealtimeLogFields,
      privacy: {
        query: { mode: "omit" },
        ip: { mode: "disabled" },
      },
    },
  );
}
```

Use query omission by default. If a customer needs campaign attribution, prefer
`query: { mode: "allowlist", allow: ["utm_source", "utm_medium", "utm_campaign"] }`.
Do not store raw viewer IP addresses in PromptScout events; use `ip:
{ mode: "disabled" }` or an explicit salted hash policy.

## IAM Notes

CloudFront needs an IAM role that it can assume to write real-time access logs
to the Kinesis stream. For an unencrypted stream, the role needs Kinesis
describe and write permissions for the stream ARN, including
`kinesis:DescribeStreamSummary`, `kinesis:DescribeStream`, `kinesis:PutRecord`,
and `kinesis:PutRecords`.

If the stream is encrypted with a customer-managed KMS key, include the required
KMS data-key permission for that key. Keep the CloudFront delivery role separate
from the Lambda consumer execution role. The consumer role needs read access to
the stream and permission to read the PromptScout ingest token from the chosen
secret store.

## Cost And Risk Caveats

CloudFront charges for real-time access logs, and Kinesis Data Streams adds its
own shard and throughput costs. Start with a narrow cache behavior or a lower
sampling rate if the customer wants a cost-controlled rollout, then increase
coverage once event volume and shard sizing are understood.

CloudFront real-time logs are best-effort delivery. They are appropriate for
traffic observability and AI request classification, not billing reconciliation
or a perfect count of every request. Kinesis throttling can delay or drop
records if shards are undersized, so monitor incoming records, write
throttling, Lambda iterator age, retry/dead-letter behavior, and PromptScout
ingest failures.

Lambda@Edge remains a possible advanced path only when a customer explicitly
accepts its limits. CloudFront Functions remain unsupported for PromptScout
collection because outbound delivery is not available there.
