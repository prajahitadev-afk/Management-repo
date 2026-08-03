import { supabase } from "./lib/supabase";

export default function TestSupabase() {

  const testLogin = async () => {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: "admin@company.com",
        password: "StrongPassword123!"
      });

    console.log("DATA:", data);
    console.log("ERROR:", error);
  };

  return (
    <div style={{ padding: "20px" }}>
      <button onClick={testLogin}>
        Test Login
      </button>
    </div>
  );
}