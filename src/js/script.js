import { MOVIES, searchMovies, fetchMovieDetails } from "./movies.js";

/* --------- Helpers --------- */
const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => root.querySelectorAll(sel);
const getParam = (k) => new URLSearchParams(location.search).get(k);

/* --------- Path Management --------- */
// Detect if we are in the pages folder or root
const isInsidePages = window.location.pathname.includes('/pages/') || 
                      window.location.pathname.includes('/src/pages/');

const PATHS = {
  home: isInsidePages ? '../../index.html' : 'index.html',
  movie: isInsidePages ? 'movie.html' : 'src/pages/movie.html',
  download: isInsidePages ? 'download.html' : 'src/pages/download.html'
};

/**
 * Find movie by ID or Slug
 */
function findMovie(idOrSlug) {
  if (!idOrSlug) return null;
  return MOVIES.find(m =>
    String(m.id) === String(idOrSlug) ||
    m.slug === idOrSlug
  ) || null;
}

/**
 * Update Meta Tags for SEO
 */
function updateSEO(m) {
  if (!m) return;
  const siteName = "CineVault";
  document.title = `${m.title || 'Movie'} (${m.year || ''}) — ${siteName}`;

  // Update Meta Description
  let metaDesc = $('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.name = "description";
    document.head.appendChild(metaDesc);
  }
  
  const description = m.description || "Download latest movies in high quality.";
  metaDesc.content = `Download ${m.title} (${m.year}) in ${m.quality}. ${description.substring(0, 150)}...`;
}

/* --------- Loader --------- */
const hideLoader = () => {
  const loader = $('.loader');
  if (loader) setTimeout(() => loader.classList.add('hidden'), 350);
};

window.addEventListener('load', hideLoader);
// Safety: hide loader if it's still visible after 3 seconds
setTimeout(hideLoader, 3000);

/* --------- Sticky navbar shadow --------- */
window.addEventListener('scroll', () => {
  const nav = $('.navbar');
  if (!nav) return;
  nav.classList.toggle('scrolled', window.scrollY > 20);
});

/* --------- Mobile hamburger --------- */
document.addEventListener('click', (e) => {
  const burger = e.target.closest('.hamburger');
  if (burger) {
    burger.classList.toggle('active');
    $('.nav-links')?.classList.toggle('active');
  } else if (!e.target.closest('.nav-links')) {
    $('.hamburger')?.classList.remove('active');
    $('.nav-links')?.classList.remove('active');
  }
});

/* --------- Render movie card --------- */
function movieCardHTML(m) {
  return `
    <a class="movie-card fade-in" href="${PATHS.movie}?id=${m.id}">
      <div class="poster-wrap">
        <img src="${m.poster}" alt="${m.title} (${m.year}) poster" loading="lazy">
        <span class="quality-badge">${m.quality}</span>
        <div class="poster-overlay">
          <div class="play-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">${m.title}</div>
        <div class="card-meta">
          <span>${m.year}</span>
          <span class="dot"></span>
          <span>${m.duration}</span>
          <span class="dot"></span>
          <span class="rating">★ ${m.rating}</span>
        </div>
      </div>
    </a>`;
}

/* --------- Search filtering --------- */
function bindSearch() {
  const input = $('#searchInput');
  const grid = $('#movieGrid');
  const hero = $('.hero');
  const sectionTitle = $('.section-title');
  const sectionLink = $('.section-link');

  if (!input) return;

  const performSearch = async (q) => {
    const rawQ = q;
    q = q.trim();

    // Toggle hero visibility
    if (hero) hero.style.display = q ? 'none' : '';
    if (sectionTitle) sectionTitle.textContent = q ? `Searching for "${rawQ}"...` : 'Trending Now';
    if (sectionLink) sectionLink.style.display = q ? 'none' : '';

    // Show loading state in grid
    if (grid) grid.style.opacity = '0.5';

    // Database Search
    const list = await searchMovies(q);
    
    if (grid) {
      grid.style.opacity = '1';
      if (sectionTitle) sectionTitle.textContent = q ? `Results for "${rawQ}"` : 'Trending Now';
      
      grid.innerHTML = list.length
        ? list.map(movieCardHTML).join('')
        : `<p style="grid-column:1/-1;text-align:center;color:#777;padding:40px;">No movies match "${rawQ}"</p>`;
    }
  };

  const debouncedSearch = debounce((val) => performSearch(val), 400);

  input.addEventListener('input', (e) => debouncedSearch(e.target.value));

  // If no grid, enter key redirects to homepage with query
  if (!grid) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const q = input.value.trim();
        if (q) window.location.href = `${PATHS.home}?q=${encodeURIComponent(q)}`;
      }
    });
    return;
  }

  // Check for initial query param (from other pages)
  const initialQ = getParam('q');
  if (initialQ) {
    input.value = initialQ;
    performSearch(initialQ);
  }
}

/* --------- Page init --------- */
const init = () => {
  const pageType = getPageType();
  console.log("CineVault Init:", pageType, "| Movies:", MOVIES.length);

  if (pageType === 'home') {
    initHomePage();
  } else if (pageType === 'movie') {
    renderDetails();
  } else if (pageType === 'download') {
    renderDownload();
  }
};

// Modules are deferred, but let's be safe
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function getPageType() {
  if ($('#movieGrid')) return 'home';
  if ($('#detailsRoot')) return 'movie';
  if ($('#downloadRoot')) return 'download';
  return 'unknown';
}

function initHomePage() {
  const grid = $('#movieGrid');
  if (!grid) return;

  if (MOVIES.length > 0) {
    grid.innerHTML = MOVIES.map(movieCardHTML).join('');

    // Hero from a featured movie (first one)
    const featured = MOVIES[1];
    const heroBg = $('.hero-bg');
    console.log(featured.banner)

    if (heroBg && (featured.banner || featured.backdrop)) {
      heroBg.style.backgroundImage = `url('${featured.banner || featured.backdrop}')`;
   
    }
    if ($('#heroTitle')) $('#heroTitle').textContent = featured.title;
    if ($('#heroDesc')) $('#heroDesc').textContent = featured.description;
    $('#heroWatch')?.setAttribute('href', `${PATHS.movie}?id=${featured.id}`);
  } else {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:100px;color:#777;">No movies found. Check your database.</p>`;
  }

  bindSearch();
  document.title = "CineVault — Premium Movie Downloads";
}

/* --------- Details renderer --------- */
async function renderDetails() {
  const id = getParam('id') || getParam('slug');
  if (!id) return;

  // Show immediate partial UI if movie is in current list
  let m = MOVIES.find(x => String(x.id) === String(id) || x.slug === id);
  if (m) updateUI(m);

  // Fetch full details from DB
  const fullMovie = await fetchMovieDetails(id);
  if (fullMovie) updateUI(fullMovie);
}

function updateUI(m) {
  if (!m) return;
  console.log("Updating UI with movie:", m.title);
  updateSEO(m);

  if ($('.details-bg')) $('.details-bg').style.backgroundImage = `url('${m.banner || m.backdrop || ''}')`;
  if ($('#dPoster')) $('#dPoster').src = m.poster || '';
  if ($('#dPoster')) $('#dPoster').alt = `${m.title} (${m.year}) Poster`;
  if ($('#dTitle')) $('#dTitle').textContent = m.title || '';
  if ($('#dDesc')) $('#dDesc').textContent = m.description || '';
  if ($('#dYear')) $('#dYear').textContent = m.year || '';
  if ($('#dDuration')) $('#dDuration').textContent = m.duration || '';
  if ($('#dQuality')) $('#dQuality').textContent = m.quality || '';
  if ($('#dRating')) $('#dRating').textContent = m.rating ? `★ ${m.rating}` : '';

  if ($('#dGenres')) {
    const genres = Array.isArray(m.genres) ? m.genres : (typeof m.genres === 'string' ? m.genres.split(',').map(g => g.trim()) : []);
    $('#dGenres').innerHTML = genres.map(g => `<span class="genre-tag">${g}</span>`).join('');
  }

  if ($('#dDownload')) $('#dDownload').href = `${PATHS.download}?id=${m.id}`;

  // Screenshots
  if ($('#dGallery')) {
    const screens = Array.isArray(m.screenshots) ? m.screenshots : (typeof m.screenshots === 'string' ? JSON.parse(m.screenshots) : []);
    $('#dGallery').innerHTML = Array.isArray(screens) ? screens.map(s => `<img src="${s}" alt="${m.title} screenshot" loading="lazy">`).join('') : '';
  }

  // Related (random shuffle from initial list)
  const related = MOVIES.filter(x => x.id !== m.id).sort(() => 0.5 - Math.random()).slice(0, 6);
  if ($('#relatedGrid')) {
    $('#relatedGrid').innerHTML = related.map(movieCardHTML).join('');
  }
  
  // Ensure loader is hidden after UI update
  hideLoader();
}

/* --------- Download renderer --------- */
async function renderDownload() {
  const id = getParam('id') || getParam('slug');
  if (!id) return;

  // Always fetch full details for download page to ensure sizes/links are present
  const m = await fetchMovieDetails(id);
  if (!m) return;

  updateSEO(m);

  if ($('#downloadTitle')) $('#downloadTitle').textContent = m.title;
  if ($('#downloadYear')) $('#downloadYear').textContent = `${m.year} • ${m.duration} • ${m.genre}`;

  // Dynamically render quality links with sizes
  const qualityRow = $('.quality-row');
  if (qualityRow && m.sizes) {
    qualityRow.innerHTML = Object.entries(m.sizes).map(([quality, size]) => {
      const link = (m.links && m.links[quality]) ? m.links[quality] : '#';
      return `
        <a href="${link}" class="quality-btn" data-quality="${quality}">
          <div class="q-label">${quality}</div>
          <div class="q-size">${size}</div>
        </a>
      `;
    }).join('');
  }

  $$('.quality-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const q = btn.dataset.quality;
      const link = btn.getAttribute('href');

      // If link is just #, show the demo alert
      if (link === '#') {
        e.preventDefault();
        btn.style.transform = 'scale(0.96)';
        setTimeout(() => btn.style.transform = '', 150);

        const originalText = btn.innerHTML;
        btn.innerHTML = `<div class="q-label">Preparing...</div><div class="q-size">Please wait</div>`;
        btn.classList.add('disabled');

        setTimeout(() => {
          alert(`Starting ${q} download for "${m.title}" (${m.sizes[q]})...\n\nThis is a demo. Please provide a real link in movies.js to enable redirection.`);
          btn.innerHTML = originalText;
          btn.classList.remove('disabled');
        }, 1000);
      } else {
        // For real links, we can still show a brief "Preparing" state if desired, 
        // but direct redirection is often preferred. 
        // The user specifically asked to be redirected.
        console.log(`Redirecting to ${link} for ${q} quality`);
      }
    });
  });
}
