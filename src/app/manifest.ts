import type { MetadataRoute } from "next";

// Saved to a home screen, the app opens full screen with its own icon: two fanned cards, the
// net from above on the front one (the card back from the draw stories). The icon files are
// rendered from src/app/icon.svg; apple-icon.png is the iPhone's home-screen icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cards · East London Roundnet",
    short_name: "Cards",
    description: "Weekend cards tournaments at Victoria Park.",
    start_url: "/",
    display: "standalone",
    background_color: "#0C0E10",
    theme_color: "#0C0E10",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
