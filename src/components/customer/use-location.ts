"use client";

import { useCallback, useEffect, useState } from "react";
import type { Coords } from "@/lib/geo";

export type LocationStatus = "idle" | "locating" | "ready" | "denied" | "unavailable" | "timeout" | "unsupported" | "insecure";
export type DeviceLocation = { status: LocationStatus; coords: (Coords & { accuracy?: number }) | null };

const STORAGE_KEY = "fuelcap-location";

export const locationMessages: Partial<Record<LocationStatus, string>> = {
  denied: "Location is off for this site. Turn it on in your browser's site settings, or search a postcode, town or station.",
  timeout: "We couldn't get a location fix in time. Try again, or search a postcode, town or station.",
  unavailable: "Your device couldn't find where you are right now. Search a postcode, town or station instead.",
  unsupported: "This browser can't share your location. Search a postcode, town or station instead.",
  insecure: "Location only works over a secure (https) connection. Search a postcode, town or station instead.",
};

function position(options: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));
}

/**
 * The device's location for "nearest first". Asks only when the person taps "Use my location", except when the
 * browser already has permission, in which case it locates quietly on open. A quick, coarse fix is tried first;
 * if that times out, one high-accuracy attempt follows. The fix is remembered for the browser session.
 */
export function useDeviceLocation(): DeviceLocation & { locate: () => Promise<void> } {
  const [state, setState] = useState<DeviceLocation>({ status: "idle", coords: null });

  const locate = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) return setState({ status: "insecure", coords: null });
    if (!("geolocation" in navigator)) return setState({ status: "unsupported", coords: null });
    setState((current) => ({ ...current, status: "locating" }));
    const accept = (fix: GeolocationPosition) => {
      const coords = { latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy };
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords)); } catch { /* private mode: keep in memory */ }
      setState({ status: "ready", coords });
    };
    try {
      accept(await position({ enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 }));
    } catch (first) {
      const code = (first as GeolocationPositionError).code;
      if (code === 1) return setState({ status: "denied", coords: null });
      try {
        accept(await position({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }));
      } catch (second) {
        const again = (second as GeolocationPositionError).code;
        setState({ status: again === 1 ? "denied" : again === 3 ? "timeout" : "unavailable", coords: null });
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.setTimeout(() => {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored && !cancelled) { setState({ status: "ready", coords: JSON.parse(stored) as Coords }); return; }
      } catch { /* ignore */ }
      if (!window.isSecureContext || !navigator.permissions?.query) return;
      navigator.permissions.query({ name: "geolocation" }).then((permission) => {
        if (!cancelled && permission.state === "granted") void locate();
        if (!cancelled && permission.state === "denied") setState({ status: "denied", coords: null });
      }).catch(() => undefined);
    }, 0);
    return () => { cancelled = true; };
  }, [locate]);

  return { ...state, locate };
}
