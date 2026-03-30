import { useState, useEffect } from "react";

/**
 * Hook to detect if the current view is a mobile device based on a breakpoint.
 * @param breakpoint The width breakpoint in pixels. Defaults to 768px.
 * @returns An object containing `isMobile` boolean.
 */
export function useMobileView(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return { isMobile };
}