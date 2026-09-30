import { useEffect, useState } from "react";
import {
  getCommunityImpact,
  type CommunityImpact,
} from "../services/communityImpact.service";

export function useCommunityImpact() {
  const [impact, setImpact] = useState<CommunityImpact[]>([]);

  useEffect(() => {
    getCommunityImpact().then(setImpact);
  }, []);

  return { impact };
}