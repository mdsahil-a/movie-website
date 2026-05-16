import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://oecnirospljntwridrtz.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lY25pcm9zcGxqbnR3cmlkcnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NTQyMTYsImV4cCI6MjA5NDQzMDIxNn0.HHg9QDdBWT4sOqNFCybEoUFRK_gOVzkN2QamQlFsxcU";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);