"use client";
import { useEffect } from "react";

const ServiceWorkerRegistration = () => {
  useEffect(() => {
    // Register service worker for enhanced notifications
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered:", registration);
        })
        .catch((error) => {
          console.log("SW registration failed:", error);
        });
    }
  }, []);

  return null; // This component doesn't render anything
};

export default ServiceWorkerRegistration;
