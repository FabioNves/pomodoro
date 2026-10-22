// Two build modes share this config:
//   next build                     -> the website, with API routes (Vercel)
//   NEXT_OUTPUT=export next build  -> the static frontend bundled into the
//                                     mobile and desktop apps
//                                     (see scripts/build-web-static.mjs)
const isStaticExport = process.env.NEXT_OUTPUT === "export";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The news API routes load the MCP SDK at runtime; keeping it external
  // avoids bundling its transports (child processes, SSE) into the server build.
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
  turbopack: {
    // The static-export script builds a staged copy whose node_modules is a
    // link back to the repo; Turbopack needs the repo to be its root then.
    root: process.env.NEXT_TURBOPACK_ROOT || process.cwd(),
  },
  ...(isStaticExport
    ? {
        output: "export",
        images: { unoptimized: true },
      }
    : {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                {
                  key: "Content-Security-Policy",
                  value: [
                    "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client https://apis.google.com https://www.gstatic.com",
                    // Google sign-in, then the players saved link posts
                    // embed (embedFor() in src/lib/notebook/posts.js).
                    "frame-src https://accounts.google.com/gsi/ https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.instagram.com https://www.tiktok.com",
                    "connect-src 'self' https://accounts.google.com/gsi/",
                    "object-src 'none'",
                    "base-uri 'self'",
                    "form-action 'self'",
                  ].join("; "),
                },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
