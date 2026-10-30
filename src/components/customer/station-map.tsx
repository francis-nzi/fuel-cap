"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { milesBetween, type Coords } from "@/lib/geo";

export type MapStation = { id: string; name: string; price: string; latitude: number; longitude: number };

// OpenStreetMap's own tiles: free and keyless, but only for light use under the OSM tile policy, so fine for the demo.
// Before real traffic, set NEXT_PUBLIC_MAP_TILE_URL and NEXT_PUBLIC_MAP_ATTRIBUTION to a paid provider (MapTiler,
// Stadia, Mapbox).
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MAX_PINS = 150;

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Stations as price pins. Tap a pin to choose it. Only the pins nearest the middle of the view are drawn. */
export function StationMap({ stations, selectedId, onSelect, center, user, focusKey }: { stations: MapStation[]; selectedId: string | null; onSelect: (id: string) => void; center: Coords; user: Coords | null; focusKey: string }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const pins = useRef<Leaflet.LayerGroup | null>(null);
  const userDot = useRef<Leaflet.CircleMarker | null>(null);
  const latest = useRef({ stations, selectedId, onSelect, center });
  useEffect(() => { latest.current = { stations, selectedId, onSelect, center }; });

  const draw = () => {
    const leaflet = L.current, view = map.current, layer = pins.current;
    if (!leaflet || !view || !layer) return;
    const { stations: all, selectedId: chosen, onSelect: choose } = latest.current;
    const bounds = view.getBounds().pad(0.2);
    const middle = view.getCenter();
    const visible = all
      .filter((station) => bounds.contains([station.latitude, station.longitude]) || station.id === chosen)
      .map((station) => ({ station, d: milesBetween({ latitude: middle.lat, longitude: middle.lng }, station) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_PINS);
    layer.clearLayers();
    for (const { station } of visible) {
      const on = station.id === chosen;
      const icon = leaflet.divIcon({ className: "", iconSize: undefined, iconAnchor: [0, 0], html: `<span class="fc-pin${on ? " fc-pin-on" : ""}">${escape(station.price)}</span>` });
      leaflet.marker([station.latitude, station.longitude], { icon, title: station.name, alt: `${station.name}, ${station.price}`, keyboard: true, zIndexOffset: on ? 1000 : 0, riseOnHover: true })
        .on("click", () => choose(station.id))
        .addTo(layer);
    }
  };

  // Frame the person (or the searched place) plus the nearest few stations whenever the focus changes.
  const fit = () => {
    const leaflet = L.current, view = map.current;
    if (!leaflet || !view) return;
    const { center: middle } = latest.current;
    const nearest = [...latest.current.stations].sort((a, b) => milesBetween(middle, a) - milesBetween(middle, b)).slice(0, 5);
    const points: [number, number][] = [[middle.latitude, middle.longitude], ...nearest.map((s) => [s.latitude, s.longitude] as [number, number])];
    view.fitBounds(leaflet.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
  };
  useEffect(() => {
    let disposed = false;
    void import("leaflet").then((leaflet) => {
      if (disposed || !element.current || map.current) return;
      L.current = leaflet;
      const view = leaflet.map(element.current, { zoomControl: true, attributionControl: true }).setView([center.latitude, center.longitude], 13);
      leaflet.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(view);
      pins.current = leaflet.layerGroup().addTo(view);
      view.on("moveend", draw);
      map.current = view;
      fit();
      draw();
    });
    return () => { disposed = true; map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { latest.current = { stations, selectedId, onSelect, center }; fit(); draw(); }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { latest.current = { stations, selectedId, onSelect, center }; draw(); }, [stations, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const leaflet = L.current, view = map.current;
    if (!leaflet || !view) return;
    userDot.current?.remove();
    userDot.current = user ? leaflet.circleMarker([user.latitude, user.longitude], { radius: 8, color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).addTo(view) : null;
  }, [user, focusKey]);

  return <div ref={element} role="application" aria-label="Map of filling stations. Tap a price to choose a station." className="fc-map h-[340px] w-full overflow-hidden rounded-[14px] border border-[#d3ded8]" />;
}
