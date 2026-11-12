import { useEffect, useState } from "react";
import { getPrograms, type Program } from "../services/outreach.service";

export function usePrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    let active = true;
    getPrograms()
      .then((data) => {
        if (active && data) setPrograms(data);
      })
      .catch((err) => {
        console.warn("Failed to load programs:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  return { programs };
}
