# CloudFront/AWS Example

This example uses CloudFront real-time access logs delivered to Kinesis Data
Streams. A regional Lambda or Kinesis consumer imports the package helpers,
parses fixture-compatible log records, and forwards normalized PromptScout live
AI traffic events.

CloudFront Functions are not part of this path because they cannot perform the
outbound network POST to PromptScout ingest.

## Files

- `src/index.ts` re-exports the CloudFront/AWS package helpers for a consumer.
- `packages/cloudfront-aws/fixtures/realtime-log-record.tsv` is a local
  tab-delimited real-time log record fixture.
- `packages/cloudfront-aws/fixtures/kinesis-event.json` is a local Lambda
  Kinesis event fixture.
- `docs/integrations/cloudfront-aws.md` contains the setup decision, IAM notes,
  and cost/risk caveats.

## CloudFront Real-Time Log Fields

Configure the real-time log with the package field order:

```ts
recommendedCloudFrontRealtimeLogFields
```

That resolves to:

```text
timestamp, c-ip, sc-status, cs-method, cs-protocol, cs-host, cs-uri-stem,
x-edge-request-id, cs-user-agent, cs-referer, cs-uri-query, c-country
```

The consumer depends on the selected CloudFront fields and their delivered
order. If the CloudFront log configuration changes, update the consumer field
list and fixture tests together.

## Local Fixture Check

From the repository root:

```bash
node --test tests/cloudfront_aws.test.mjs
```

The test builds `packages/cloudfront-aws`, reads the local fixture record and
Kinesis event, and does not call AWS.

## Deployment Shape

1. Create a Kinesis Data Stream sized for expected CloudFront request volume.
2. Create a CloudFront real-time log configuration with the recommended fields.
3. Give CloudFront an IAM role that can assume `cloudfront.amazonaws.com` and
   write to the Kinesis stream.
4. Attach the real-time log configuration to the target cache behaviors.
5. Deploy a regional Lambda/Kinesis consumer that calls
   `handlePromptScoutCloudFrontAwsKinesisEvent`.
6. Store `PROMPTSCOUT_INGEST_URL` and `PROMPTSCOUT_INGEST_TOKEN` in the
   regional runtime configuration or secret store.

Keep PromptScout delivery asynchronous and fail-open. If PromptScout ingest is
temporarily unavailable, customer traffic should continue and the consumer
should retry or route failed batches through the customer's dead-letter policy.

## Cost And Risk Notes

CloudFront real-time logs and Kinesis Data Streams both add AWS cost. Start with
a narrow cache behavior or low sampling rate for rollout validation, then widen
coverage after checking record size, shard utilization, throttling, and
PromptScout ingest acceptance.

CloudFront real-time logs are delivered on a best-effort basis. They are useful
for AI traffic observability, but they are not a perfect accounting system for
every request.
