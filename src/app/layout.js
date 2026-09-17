import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "react-hot-toast";
import ServiceWorkerRegistration from "../components/ServiceWorkerRegistration";
import NativeBridge from "../components/NativeBridge";
import UpdateBanner from "../components/UpdateBanner";
import ViewAsBar from "../components/access/ViewAsBar";
import { AccessProvider } from "../lib/access/client";
import { TimerProvider } from "../components/timer/TimerProvider";
import { ThemeProvider } from "../hooks/useTheme";
import {
  THEME_IDS,
  DARK_THEME_IDS,
  DEFAULT_THEME,
  LEGACY_THEME_IDS,
} from "../lib/themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Add Montserrat local font
const montserrat = localFont({
  src: [
    {
      path: "../fonts/Montserrat/static/Montserrat-Thin.ttf",
      weight: "100",
      style: "normal",
    },
    {
      path: "../fonts/Montserrat/static/Montserrat-ExtraLight.ttf",
      weight: "200",
      style: "normal",
    },
    {
      path: "../fonts/Montserrat/static/Montserrat-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../fonts/Montserrat/static/Montserrat-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/Montserrat/static/Montserrat-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/Montserrat/static/Montserrat-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../fonts/Montserrat/static/Montserrat-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../fonts/Montserrat/static/Montserrat-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
    {
      path: "../fonts/Montserrat/static/Montserrat-Black.ttf",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-montserrat",
});

export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "https://pomodrive.vercel.app"
  ),
  title: "PomoDRIVE",
  description: "A Pomodoro Timer with a Twist",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/logo/pomodrive-png/pomoDrive-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "PomoDRIVE",
    description: "A Pomodoro Timer with a Twist",
    url: "https://pomodrive.vercel.app/",
    siteName: "PomoDRIVE",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en-US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PomoDRIVE",
    description: "A Pomodoro Timer with a Twist",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var THEMES = ${JSON.stringify(THEME_IDS)};
                  var DARK = ${JSON.stringify(DARK_THEME_IDS)};
                  var LEGACY = ${JSON.stringify(LEGACY_THEME_IDS)};
                  var saved = localStorage.getItem('theme');
                  if (LEGACY[saved]) saved = LEGACY[saved];
                  var theme = THEMES.indexOf(saved) !== -1 ? saved : ${JSON.stringify(DEFAULT_THEME)};
                  var root = document.documentElement;
                  root.setAttribute('data-theme', theme);
                  if (DARK.indexOf(theme) !== -1) root.classList.add('dark');
                  else root.classList.remove('dark');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} antialiased`}
      >
        <ThemeProvider>
          <GoogleOAuthProvider
            clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
          >
            <ServiceWorkerRegistration />
            <NativeBridge />
            <AccessProvider>
              <TimerProvider>
                <div className="app-bg w-screen min-h-screen text-fg pt-[4.5rem] md:pt-[4.75rem] pb-[5.25rem] md:pb-0 transition-colors duration-300">
                  <UpdateBanner />
                  <ViewAsBar />
                  {children}
                </div>
              </TimerProvider>
            </AccessProvider>
          </GoogleOAuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 5000,
              className: "",
              style: {
                background: "var(--surface)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
