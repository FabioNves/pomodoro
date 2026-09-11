// GET /api/app/version
//
// What the installed desktop app asks to find out whether a newer build has
// been released. Deliberately public and tiny: the shells call it before
// anyone has signed in, and it holds nothing private.
//
// The website itself always serves its newest code, so this only describes
// the packaged desktop build. Leave DESKTOP_LATEST_VERSION unset and the
// endpoint reports nothing, which keeps the banner hidden until you have a
// release to point at.
export const dynamic = "force-dynamic";

function clean(value, max = 200) {
  const text = (value || "").trim();
  return text.slice(0, max);
}

export async function GET() {
  const version = clean(process.env.DESKTOP_LATEST_VERSION, 32);
  const downloadUrl = clean(process.env.DESKTOP_DOWNLOAD_URL, 500);
  const notes = clean(process.env.DESKTOP_RELEASE_NOTES, 300);

  // Only advertise a release that can actually be downloaded over https.
  const usable = /^\d+(\.\d+)*([-+].+)?$/.test(version) && /^https:\/\//i.test(downloadUrl);

  return Response.json(
    {
      desktop: usable ? { version, downloadUrl, notes: notes || null } : null,
    },
    {
      headers: {
        // A short cache keeps a long-running app from asking on every focus
        // while still surfacing a release within the hour.
        "Cache-Control": "public, max-age=900, s-maxage=900",
      },
    },
  );
}
