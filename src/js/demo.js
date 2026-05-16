import { supabase } from "../lib/db.js";

const {error,data}
  = await supabase.from('movies').select('*');
  console.log('Supabase data:', data);
  console.log('Supabase error:', error);
