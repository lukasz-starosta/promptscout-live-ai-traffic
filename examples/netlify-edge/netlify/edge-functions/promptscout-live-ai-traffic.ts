import { handlePromptScoutNetlifyEdgeRequest } from "@lukasz-starosta/promptscout-live-ai-traffic-netlify-edge";

export default async function promptScoutLiveAiTraffic(
  request: Request,
  context: Parameters<typeof handlePromptScoutNetlifyEdgeRequest>[1],
): Promise<Response> {
  return handlePromptScoutNetlifyEdgeRequest(request, context);
}
