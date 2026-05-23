import { supabase } from "../lib/db.js";
import { rankMovies } from "./search-utils.js";

const SEARCH_SELECT = 'id, title, slug, poster, rating, year, quality, duration';

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

let searchCatalog = null;
let searchCatalogPromise = null;

/** Load full catalog once for fuzzy client-side search. */
async function getSearchCatalog() {
  if (searchCatalog) return searchCatalog;
  if (!searchCatalogPromise) {
    searchCatalogPromise = supabase
      .from('movies')
      .select(SEARCH_SELECT)
      .then(({ data, error }) => {
        if (error) {
          console.error("Search catalog error:", error);
          searchCatalog = [];
        } else {
          searchCatalog = data || [];
        }
        return searchCatalog;
      })
      .catch((err) => {
        console.error("Search catalog failed:", err);
        searchCatalog = [];
        searchCatalogPromise = null;
        return searchCatalog;
      });
  }
  return searchCatalogPromise;
}

export function preloadSearchCatalog() {
  return getSearchCatalog();
}

/**
 * Flexible search — matches partial words in any order.
 * "love and thunder", "thor love", "thunder" all find "Thor: Love and Thunder".
 */
async function getMoviesForSearch() {
  const catalog = await getSearchCatalog();
  return catalog.length ? catalog : MOVIES;
}

export async function searchMovies(query) {
  if (!query?.trim()) {
    await loadMovies();
    return MOVIES;
  }

  const pool = await getMoviesForSearch();
  return rankMovies(pool, query, 24);
}

/** Top matches for the search suggestions dropdown. */
export async function getSearchSuggestions(query, limit = 8) {
  const trimmed = query?.trim();
  if (!trimmed || trimmed.length < 1) return [];

  const pool = await getMoviesForSearch();
  return rankMovies(pool, trimmed, limit);
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

export let MOVIES = [];

let moviesLoadPromise = null;

/** Load homepage movie list once (non-blocking module init). */
export function loadMovies() {
  if (!moviesLoadPromise) {
    moviesLoadPromise = fetchInitialMovies()
      .then((data) => {
        MOVIES = data || [];
        return MOVIES;
      })
      .catch((err) => {
        console.error("Failed to load movies:", err);
        MOVIES = [];
        moviesLoadPromise = null;
        return MOVIES;
      });
  }
  return moviesLoadPromise;
}
