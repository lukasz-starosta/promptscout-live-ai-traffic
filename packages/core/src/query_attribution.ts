export const openAiQueryAttributionNormalizedValues = [
  "chatgpt",
  "chatgptcom",
  "chatopenaicom",
] as const;

export type OpenAiQueryAttributionCanonicalValue =
  | "chatgpt.com"
  | "chat.openai.com";

export function normalizeQueryAttributionValue(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const withoutProtocol = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const withoutWww = withoutProtocol.replace(/^www\./, "");
  const hostLike = withoutWww.split(/[/?#]/, 1)[0] ?? withoutWww;

  return hostLike.replace(/[^a-z0-9]+/g, "");
}

export function canonicalOpenAiQueryAttributionValue(
  value: string,
): OpenAiQueryAttributionCanonicalValue | undefined {
  switch (normalizeQueryAttributionValue(value)) {
    case "chatgpt":
    case "chatgptcom":
      return "chatgpt.com";
    case "chatopenaicom":
      return "chat.openai.com";
    default:
      return undefined;
  }
}
