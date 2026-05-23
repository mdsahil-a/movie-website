import { supabase } from "../lib/db.js";

export async function fetchFeaturedMovies() {
    const { data, error } = await supabase.from('movies')


}