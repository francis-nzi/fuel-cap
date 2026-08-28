const firstHeaderValue = (value: string | null) => value?.split(",", 1)[0]?.trim();

export function publicRequestOrigin(request: Request) {
  const internalUrl = new URL(request.url);
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const host = forwardedHost ?? request.headers.get("host")?.trim();
  const protocol = forwardedProto ?? internalUrl.protocol.slice(0, -1);

  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return internalUrl.origin;
  if (protocol !== "http" && protocol !== "https") return internalUrl.origin;

  return `${protocol}://${host}`;
}
