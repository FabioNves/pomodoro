// Capacitor host configuration.
//
// The Capacitor project root is the repository root so the web code and the
// Capacitor plugins share a single package.json. The generated native projects
// live under native/android and native/ios, and the web assets they ship are
// the static export produced by `npm run build:static` (dist/web).
//
// Live reload during development: point the shell at the Next.js dev server
// (reachable from the phone) instead of the bundled assets, e.g.
//   CAP_SERVER_URL=http://192.168.1.20:3500 npx cap run android

const devServerUrl = process.env.CAP_SERVER_URL;

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "com.pomodrive.app",
  appName: "PomoDRIVE",
  webDir: "dist/web",
  android: { path: "native/android" },
  ios: { path: "native/ios" },
  ...(devServerUrl ? { server: { url: devServerUrl, cleartext: true } } : {}),
};

module.exports = config;
