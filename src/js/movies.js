import { supabase } from "../lib/db.js";

/**
 * Fetch initial movies (Top 20 for homepage)
 */
async function fetchInitialMovies() {
  const { data, error } = await supabase
    .from('movies')
    .select('id, title, slug, poster, banner, rating, year, quality, duration, description')
    .limit(20);

  if (error) {
    console.error("Error fetching movies:", error);
    return [];
  }
  return data;
}

/**
 * Real-time Database Search
 */
export async function searchMovies(query) {
  if (!query) return fetchInitialMovies();

  const { data, error } = await supabase
    .from('movies')
    .select('id, title, slug, poster, rating, year, quality, duration')
    .ilike('title', `%${query}%`)
    .limit(20);

  if (error) {
    console.error("Search error:", error);
    return [];
  }
  return data;
}

/**
 * Fetch all movies (for "View all" behavior)
 */
export async function fetchAllMovies() {
  const { data, error } = await supabase
    .from('movies')
    .select('id, title, slug, poster, banner, rating, year, quality, duration, description');

  if (error) {
    console.error("Error fetching all movies:", error);
    return [];
  }
  return data || [];
}

/**
 * Fetch full movie details
 */
export async function fetchMovieDetails(idOrSlug) {
  try {
    const query = supabase.from('movies').select('*');
    
    if (/^\d+$/.test(idOrSlug)) {
      query.eq('id', parseInt(idOrSlug));
    } else {
      query.eq('slug', idOrSlug);
    }

    const { data, error } = await query.single();
    
    if (error) {
      console.warn("Movie not found in DB:", idOrSlug, error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("fetchMovieDetails crash:", err);
    return null;
  }
}

export const MOVIES = await fetchInitialMovies();
