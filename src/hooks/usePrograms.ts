import { useEffect, useState } from "react";
import { getPrograms, type Program } from "../services/outreach.service";

export function usePrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    getPrograms().then(setPrograms);
  }, []);

  return { programs };
}