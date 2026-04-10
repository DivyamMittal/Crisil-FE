import { useEffect, useState } from "react";

import { globalLoadingEventName } from "@/lib/loading";

export const GlobalLoadingIndicator = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let activeRequests = 0;

    const handleChange = (event: Event) => {
      const nextVisible = (event as CustomEvent<boolean>).detail;
      activeRequests = Math.max(0, activeRequests + (nextVisible ? 1 : -1));
      setVisible(activeRequests > 0);
    };

    window.addEventListener(globalLoadingEventName, handleChange);
    return () => window.removeEventListener(globalLoadingEventName, handleChange);
  }, []);

  return (
    <div className={`global-loading-indicator${visible ? " global-loading-indicator--visible" : ""}`}>
      <div className="global-loading-indicator__bar" />
    </div>
  );
};
