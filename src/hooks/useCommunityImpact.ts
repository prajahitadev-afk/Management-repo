import { useEffect, useState } from "react";
import {
  getCommunityImpact,
  type CommunityImpact,
} from "../services/communityImpact.service";

export function useCommunityImpact() {
  const [impact, setImpact] = useState<CommunityImpact[]>([]);

  useEffect(() => {
    let active = true;
    getCommunityImpact()
      .then((data) => {
        if (active && data) setImpact(data);
      })
      .catch((err) => {
        console.warn("Failed to load community impact:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  return { impact };
}
