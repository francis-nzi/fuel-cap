"use client";

import dynamic from "next/dynamic";
import { List, LocateFixed, Map as MapIcon, Navigation, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { demoAreas, formatDistance, looksLikeUkPostcode, looksLikeZip, milesBetween, nearestMiles, NEARBY_MILES, type Coords, type Place } from "@/lib/geo";
import { markets, money, type MarketCode } from "@/lib/markets";
import type { PriceOption } from "@/lib/price-options";
import { locationMessages, type DeviceLocation } from "./use-location";
import { card, primaryButton } from "./ui";
import { shortLabel, type MarketProps } from "./types";

const StationMap = dynamic(() => import("./station-map").then((module) => module.StationMap), {
  ssr: false,
  loading: () => <div className="grid h-[340px] place-items-center rounded-[14px] border border-[#d3ded8] bg-white text-sm text-[#52625c]">Loading map…</div>,
});

type Located = PriceOption & { scopeId: string; latitude: number; longitude: number };
const hasCoords = (option: PriceOption): option is Located => option.scopeId !== null && typeof option.latitude === "number" && typeof option.longitude === "number";
const countryNames: Record<string, string> = { US: "the US", CA: "Canada", GB: "the UK" };

/** Where the stations are measured from, and how we describe it. */
export function useOrigin(market: MarketCode, stations: PriceOption[], device: DeviceLocation, place: Place | null) {
  return useMemo(() => {
    const points = stations.filter(hasCoords);
    if (place) return { coords: place as Coords, label: `Near ${place.label}`, demo: false };
    if (device.coords && points.length && nearestMiles(device.coords, points) <= NEARBY_MILES) return { coords: device.coords as Coords, label: "Near you", demo: false };
    const area = demoAreas[market];
    return { coords: area as Coords, label: `Demo area: ${area.label}`, demo: true, away: Boolean(device.coords) };
  }, [market, stations, device.coords, place]);
}

export function StationPicker({ market, stations, selectedId, choose, cancel, device, coverage, switchCountry }: MarketProps & {
  stations: PriceOption[]; selectedId: string | null; choose: (id: string) => void; cancel: () => void;
  device: DeviceLocation & { locate: () => Promise<void> }; coverage: string; switchCountry: (code: MarketCode) => void;
}) {
  const [view, setView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(selectedId);
  const [expanded, setExpanded] = useState(false);
  const [deviceCountry, setDeviceCountry] = useState<string | null>(null);
  const origin = useOrigin(market.code, stations, device, place);
  const lookup = useRef(0);

  // Postcodes, ZIPs, towns and cities are looked up; plain station or brand names just filter the list.
  const needle = query.trim().toLocaleLowerCase();
  const nameMatches = useMemo(() => needle ? stations.filter((option) => `${option.label} ${option.providerName ?? ""}`.toLocaleLowerCase().includes(needle)) : stations, [stations, needle]);
  const placeLike = looksLikeUkPostcode(query) || looksLikeZip(query) || (needle.length >= 3 && nameMatches.length === 0);
  useEffect(() => {
    if (!placeLike) return;
    const id = ++lookup.current;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const response = await fetch(`/api/geocode?market=${market.code}&q=${encodeURIComponent(query.trim())}`);
        if (id !== lookup.current) return;
        if (response.ok) { const found = await response.json() as Place; setPlace(found); }
        else setSearchError(response.status === 404 ? `We couldn't find “${query.trim()}” in ${countryNames[market.code]}.` : "Search is unavailable just now. Try a station name, or use your location.");
      } catch { if (id === lookup.current) setSearchError("Search is unavailable just now. Try a station name, or use your location."); }
      finally { if (id === lookup.current) setSearching(false); }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [query, placeLike, market.code]);

  // If the device is in another FuelCap country, offer to switch.
  useEffect(() => {
    if (!device.coords) return;
    let cancelled = false;
    fetch(`/api/geocode?lat=${device.coords.latitude}&lon=${device.coords.longitude}`).then((r) => r.ok ? r.json() : null).then((data: { country?: string | null } | null) => { if (!cancelled) setDeviceCountry(data?.country ?? null); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [device.coords]);

  const pool = placeLike && place ? stations : nameMatches;
  const ranked = useMemo(() => pool.map((option) => ({ option, miles: hasCoords(option) ? milesBetween(origin.coords, option) : null }))
    .sort((a, b) => (a.miles ?? 1e9) - (b.miles ?? 1e9) || a.option.unitPrice - b.option.unitPrice), [pool, origin.coords]);
  const nearby = ranked.filter(({ miles }) => miles !== null && miles <= 5);
  const cheapestNearbyId = [...(nearby.length ? nearby : ranked)].sort((a, b) => a.option.unitPrice - b.option.unitPrice)[0]?.option.scopeId;
  const nearestId = ranked[0]?.miles !== null ? ranked[0]?.option.scopeId : undefined;
  const shown = ranked.slice(0, expanded ? 25 : 6);
  const chosen = stations.find((option) => option.scopeId === pending);
  const chosenMiles = chosen && hasCoords(chosen) ? milesBetween(origin.coords, chosen) : null;
  const mapStations = useMemo(() => pool.filter(hasCoords).map((option) => ({ id: option.scopeId, name: shortLabel(option.label), price: money(option.unitPrice, market), latitude: option.latitude, longitude: option.longitude })), [pool, market]);
  const suggested = deviceCountry && deviceCountry !== market.code && deviceCountry in markets ? deviceCountry as MarketCode : null;
  const message = locationMessages[device.status];

  return <div className="view-enter flex flex-col gap-3.5">
    <div className="flex flex-col gap-1"><h1 className="m-0 font-display text-[26px] font-bold leading-tight">Choose your station</h1><p className="m-0 text-sm leading-snug text-[#52625c]">Your price is set from this station. Your plan covers {coverage}.</p></div>

    <div className="flex gap-2">
      <label className="relative min-w-0 flex-1"><span className="sr-only">Search postcode, town or station</span><Search aria-hidden="true" size={18} className="absolute left-3 top-3.5 text-[#52625c]" /><input value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value.trim()) { setPlace(null); setSearchError(null); } }} placeholder={market.code === "GB" ? "Postcode or town" : market.code === "US" ? "ZIP or city" : "Postal code or city"} className="h-12 w-full rounded-xl border border-[#cdd9d1] bg-white pl-10 pr-3 text-sm" /></label>
      <button type="button" onClick={() => { setPlace(null); setQuery(""); void device.locate(); }} disabled={device.status === "locating"} className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-[#cdd9d1] bg-white px-3 text-sm font-semibold text-[#0b7a4b]"><LocateFixed size={17} aria-hidden="true" />{device.status === "locating" ? "Finding…" : "Use my location"}</button>
    </div>

    <div className="flex items-center justify-between gap-3">
      <span className="truncate text-[13px] text-[#52625c]" data-testid="station-origin">{searching ? "Searching…" : origin.label}</span>
      <div className="flex shrink-0 rounded-xl border border-[#cdd9d1] bg-white p-0.5" role="tablist" aria-label="Show stations as">
        {([["list", "List", List], ["map", "Map", MapIcon]] as const).map(([key, label, Icon]) => <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)} className={`inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold ${view === key ? "bg-[#0b7a4b] text-white" : "text-[#33443d]"}`}><Icon size={16} aria-hidden="true" />{label}</button>)}
      </div>
    </div>

    {message && <p role="status" className="m-0 rounded-xl bg-[#fff3d6] px-3 py-2.5 text-[13px] leading-snug text-[#6b5310]">{message}</p>}
    {searchError && <p role="status" className="m-0 rounded-xl bg-[#fff3d6] px-3 py-2.5 text-[13px] leading-snug text-[#6b5310]">{searchError}</p>}
    {origin.demo && "away" in origin && origin.away && !suggested && <p className="m-0 rounded-xl bg-[#f1f7f3] px-3 py-2.5 text-[13px] leading-snug text-[#33443d]">You&apos;re not near our {market.name} demo stations, so we&apos;re showing the demo area.</p>}
    {suggested && <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f1f7f3] px-3 py-2.5 text-[13px] text-[#33443d]"><span>You seem to be in {countryNames[suggested]}.</span><button type="button" onClick={() => switchCountry(suggested)} className="min-h-10 shrink-0 rounded-lg bg-white px-3 font-bold text-[#0b7a4b]">Switch to {markets[suggested].name}</button></div>}

    {view === "map" ? <StationMap stations={mapStations} selectedId={pending} onSelect={setPending} center={origin.coords} user={device.coords} focusKey={`${market.code}:${origin.coords.latitude},${origin.coords.longitude}`} />
      : <div className="flex flex-col gap-2" role="radiogroup" aria-label="Filling station">
        {shown.map(({ option, miles }) => {
          const on = option.scopeId === pending;
          const tag = option.scopeId === nearestId ? "Nearest" : option.scopeId === cheapestNearbyId ? "Cheapest nearby" : "";
          const address = option.label.split(" - ").slice(1).join(" - ") || option.providerName;
          return <button type="button" role="radio" aria-checked={on} key={option.scopeId} onClick={() => setPending(option.scopeId)} className={`flex w-full items-center justify-between gap-3 rounded-[14px] px-3.5 py-3 text-left ${on ? "border-2 border-[#0b7a4b] bg-[#f1faf5]" : "border border-[#d3ded8] bg-white"}`}>
            <span className="flex min-w-0 flex-col gap-0.5"><span className="truncate text-[15px] font-bold">{shortLabel(option.label)}</span><span className="truncate text-xs text-[#52625c]">{miles !== null ? `${formatDistance(miles, market.code)} · ` : ""}{address}</span></span>
            <span className="flex shrink-0 flex-col items-end gap-0.5"><span className="text-base font-bold">{money(option.unitPrice, market)}</span><span className="text-[11px] font-bold text-[#0b7a4b]">{on ? "Selected" : tag}</span></span>
          </button>;
        })}
        {!shown.length && !searching && <p className="m-0 p-3 text-sm text-[#52625c]">No stations match. Try a postcode, town or a shorter name.</p>}
        {ranked.length > shown.length && <button type="button" onClick={() => setExpanded(true)} className="min-h-11 text-sm font-semibold text-[#0b7a4b]">Show more stations</button>}
      </div>}

    {chosen && <section className={`${card} flex items-center justify-between gap-3 p-3.5`} aria-label="Chosen station">
      <span className="flex min-w-0 flex-col gap-0.5"><span className="truncate text-[15px] font-bold">{shortLabel(chosen.label)} · {money(chosen.unitPrice, market)}</span><span className="truncate text-xs text-[#52625c]">{chosenMiles !== null ? `${formatDistance(chosenMiles, market.code)} · ` : ""}{chosen.label.split(" - ").slice(1).join(" - ")}</span></span>
      {hasCoords(chosen) && <a href={`https://www.google.com/maps/dir/?api=1&destination=${chosen.latitude},${chosen.longitude}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-[#cdd9d1] px-2.5 text-[13px] font-semibold text-[#0b7a4b]"><Navigation size={14} aria-hidden="true" />Directions</a>}
    </section>}
    <div className="flex flex-col gap-2">
      <button type="button" disabled={!pending} onClick={() => pending && choose(pending)} className={primaryButton}>{chosen ? `Use ${shortLabel(chosen.label)}` : "Choose a station"}</button>
      <button type="button" onClick={cancel} className="min-h-11 text-sm font-semibold text-[#52625c]">Cancel</button>
    </div>
  </div>;
}
