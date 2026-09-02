import { describe, expect, it } from "vitest";
import { buildFuelFinderOptions, fetchFuelFinderOptions } from "./fuel-finder";

describe("Fuel Finder price projection", () => {
  it("uses station actual, brand maximum and nationwide maximum E10 prices", () => {
    const options = buildFuelFinderOptions({ data: [
      { node_id: "one", trading_name: "Shell One", brand_name: "Shell", address: { town: "Leeds", postcode: "LS1 1AA" }, fuel_prices: [{ fuel_type: "E10", price: 141.9, price_last_updated: "2026-09-02T10:00:00Z" }] },
      { node_id: "two", trading_name: "Shell Two", brand_name: "Shell", address: { town: "York" }, fuel_prices: [{ fuel_type: "E10", price: 145.9, price_last_updated: "2026-09-02T10:05:00Z" }] },
      { node_id: "three", trading_name: "BP Three", brand_name: "BP", fuel_prices: [{ fuel_type: "E10", price: 143.5, price_last_updated: "2026-09-02T10:03:00Z" }] },
    ] });
    expect(options.find((option) => option.scopeId === "one")?.unitPrice).toBe(1.419);
    expect(options.find((option) => option.scopeId === "fuel-finder-brand-shell")).toMatchObject({ unitPrice: 1.459, stationCount: 2 });
    expect(options.find((option) => option.scopeType === "country")).toMatchObject({ unitPrice: 1.459, stationCount: 3 });
  });

  it("ignores invalid rows and non-selected fuel types", () => {
    expect(buildFuelFinderOptions({ results: [{ node_id: "diesel", fuel_prices: [{ fuel_type: "B7_Standard", price: 150.9 }] }] })).toEqual([]);
  });

  it("exchanges client credentials and keeps the bearer token server-side", async () => {
    const previous = { id: process.env.FUEL_FINDER_CLIENT_ID, secret: process.env.FUEL_FINDER_CLIENT_SECRET, token: process.env.FUEL_FINDER_TOKEN_URL };
    process.env.FUEL_FINDER_CLIENT_ID = "client-id";
    process.env.FUEL_FINDER_CLIENT_SECRET = "client-secret";
    process.env.FUEL_FINDER_TOKEN_URL = "https://identity.example.test/token";
    const calls: Array<{ url: string; authorization?: string; body?: string }> = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: input.toString(), authorization: new Headers(init?.headers).get("Authorization") ?? undefined, body: init?.body?.toString() });
      if (calls.length === 1) return Response.json({ success: true, data: { access_token: "short-lived-token", expires_in: 3600 } });
      return Response.json({ data: [{ node_id: "live", trading_name: "Live Forecourt", fuel_prices: [{ fuel_type: "E10", price: 139.9 }] }] });
    }) as typeof fetch;
    try {
      const options = await fetchFuelFinderOptions(fetcher);
      expect(calls[0]).toMatchObject({ url: "https://identity.example.test/token" });
      expect(calls[0].body).toContain("grant_type=client_credentials");
      expect(calls[0].body).toContain("client_secret=client-secret");
      expect(calls[1]).toMatchObject({ url: "https://api.fuelfinder.service.gov.uk/v1/prices?fuel_type=E10", authorization: "Bearer short-lived-token" });
      expect(options.find((option) => option.scopeId === "live")?.unitPrice).toBe(1.399);
    } finally {
      if (previous.id === undefined) delete process.env.FUEL_FINDER_CLIENT_ID; else process.env.FUEL_FINDER_CLIENT_ID = previous.id;
      if (previous.secret === undefined) delete process.env.FUEL_FINDER_CLIENT_SECRET; else process.env.FUEL_FINDER_CLIENT_SECRET = previous.secret;
      if (previous.token === undefined) delete process.env.FUEL_FINDER_TOKEN_URL; else process.env.FUEL_FINDER_TOKEN_URL = previous.token;
    }
  });
});
