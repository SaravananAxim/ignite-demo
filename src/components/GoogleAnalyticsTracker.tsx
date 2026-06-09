import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const GA_MEASUREMENT_ID = "G-QKZE6Q8F9F";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export const GoogleAnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (!window.gtag) return;

    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: `${location.pathname}${location.search}`,
    });
  }, [location.pathname, location.search]);

  return null;
};
