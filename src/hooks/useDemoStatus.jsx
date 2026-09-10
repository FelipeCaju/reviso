import { useState, useEffect } from "react";
import { isDemoExpired, getDemoHoursRemaining } from "@/lib/demoMode";
import { useAuth } from "@/lib/AuthContext";

export function useDemoStatus() {
  const { isDemo } = useAuth();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isDemo) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, [isDemo]);

  return {
    isDemo,
    isExpired: isDemo ? isDemoExpired() : false,
    hoursRemaining: isDemo ? getDemoHoursRemaining() : 0,
  };
}