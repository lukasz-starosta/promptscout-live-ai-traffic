export type PlaceholderIntegration = {
  provider: string;
  status: "placeholder";
  notes: string;
};

export function createPlaceholderIntegration(
  provider: string,
): PlaceholderIntegration {
  return {
    provider,
    status: "placeholder",
    notes: "Scaffold only. Runtime implementation is intentionally deferred.",
  };
}
