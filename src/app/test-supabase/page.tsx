"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function TestSupabasePage() {
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .limit(1);
      if (error) setStatus("Error: " + error.message);
      else setStatus("OK! Connected to Supabase. Rows: " + (data?.length ?? 0));
    })();
  }, []);

  return <div style={{ padding: 20 }}>{status}</div>;
}
