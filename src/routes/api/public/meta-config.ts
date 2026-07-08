import { createFileRoute } from "@tanstack/react-router";

// Exposes the PUBLIC Meta identifiers to the browser (App ID + Configuration ID).
// These are not secrets — they appear in the OAuth URL Meta gives to end users.
// Never expose META_APP_SECRET here.
export const Route = createFileRoute("/api/public/meta-config")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          appId: process.env.META_APP_ID ?? null,
          configurationId: process.env.META_CONFIGURATION_ID ?? null,
          graphApiVersion: process.env.META_GRAPH_API_VERSION ?? "v25.0",
        });
      },
    },
  },
});
