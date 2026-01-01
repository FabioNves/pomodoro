import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "react-hot-toast";
import ServiceWorkerRegistration from "../components/ServiceWorkerRegistration";
import { ThemeProvider } from "../hooks/useTheme";

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
  title: "PomoDRIVE",
  description: "A Pomodoro Timer with a Twist",
  icons: {
    icon: "/logo/pomodrive-png/pomoDrive-icon.png",
    shortcut: "/logo/pomodrive-png/pomoDrive-icon.png",
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
                  const theme = localStorage.getItem('theme');
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (!theme && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
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
            {children}
          </GoogleOAuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 5000,
              className: "",
              style: {
                background: "var(--card-bg)",
                color: "var(--foreground)",
                border: "1px solid var(--border-color)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
