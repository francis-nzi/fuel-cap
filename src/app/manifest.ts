import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FuelCap",
    short_name: "FuelCap",
    description: "Cap your fuel price. Never overpay.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f6f4",
    theme_color: "#0ba75e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
