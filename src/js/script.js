import { MOVIES, loadMovies, searchMovies, getSearchSuggestions, preloadSearchCatalog, fetchMovieDetails, fetchAllMovies } from "./movies.js";

/* --------- Helpers --------- */
const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};
const movie_id=86;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => root.querySelectorAll(sel);
const getParam = (k) => new URLSearchParams(location.search).get(k);

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* --------- Path Management (root HTML entry points for Vercel/Vite) --------- */
const PATHS = {
  home: 'index.html',
  movie: 'movie.html',
  download: 'download.html',
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
  const siteName = "MovifyHub";
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
let loaderHidden = false;
const hideLoader = () => {
  if (loaderHidden) return;
  const loader = $('.loader');
  if (!loader) return;
  loaderHidden = true;
  loader.classList.add('hidden');
};

// Fallback only if data fetch hangs
setTimeout(hideLoader, 2000);

/* --------- Sticky navbar shadow --------- */
window.addEventListener('scroll', () => {
  const nav = $('.navbar');
  if (!nav) return;
  nav.classList.toggle('scrolled', window.scrollY > 20);
});

/* --------- Mobile side navigation --------- */
const MOBILE_NAV_BREAKPOINT = 900;

function setMobileNavOpen(open) {
  const burger = $('.hamburger');
  const links = $('.nav-links');
  const overlay = $('.nav-overlay');
  if (!burger || !links) return;

  burger.classList.toggle('active', open);
  links.classList.toggle('active', open);
  overlay?.classList.toggle('active', open);
  document.body.classList.toggle('menu-open', open);
  burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  burger.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  overlay?.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function closeMobileNav() {
  setMobileNavOpen(false);
}

document.addEventListener('click', (e) => {
  const burger = e.target.closest('.hamburger');
  if (burger) {
    e.stopPropagation();
    const isOpen = burger.classList.contains('active');
    setMobileNavOpen(!isOpen);
    return;
  }
  if (e.target.closest('.nav-overlay')) {
    closeMobileNav();
    return;
  }
  if (!e.target.closest('.nav-links')) {
    closeMobileNav();
  }
});

$$('.nav-links a').forEach((link) => {
  link.addEventListener('click', closeMobileNav);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMobileNav();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > MOBILE_NAV_BREAKPOINT) closeMobileNav();
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

/* --------- Search + suggestions --------- */
function setupSearchWrap(input) {
  const searchBox = input.closest('.search-box');
  if (!searchBox || searchBox.parentElement?.classList.contains('search-wrap')) {
    return searchBox?.parentElement;
  }
  const wrap = document.createElement('div');
  wrap.className = 'search-wrap';
  searchBox.parentNode.insertBefore(wrap, searchBox);
  wrap.appendChild(searchBox);

  const list = document.createElement('div');
  list.id = 'searchSuggestions';
  list.className = 'search-suggestions';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Movie suggestions');
  list.hidden = true;
  wrap.appendChild(list);
  return wrap;
}

function bindSearch() {
  const input = $('#searchInput');
  const grid = $('#movieGrid');
  const hero = $('.hero');
  const sectionTitle = $('.section-title');
  const sectionLink = $('.section-link');

  if (!input) return;

  preloadSearchCatalog();

  const wrap = setupSearchWrap(input);
  const suggestionsEl = $('#searchSuggestions');
  let activeIndex = -1;
  let currentSuggestions = [];
  let suggestionsRequest = 0;

  const closeSuggestions = () => {
    activeIndex = -1;
    currentSuggestions = [];
    if (!suggestionsEl) return;
    suggestionsEl.hidden = true;
    suggestionsEl.classList.remove('open');
    suggestionsEl.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
  };

  const renderSuggestions = (movies) => {
    if (!suggestionsEl) return;
    currentSuggestions = movies;
    activeIndex = -1;

    if (!movies.length) {
      closeSuggestions();
      return;
    }

    suggestionsEl.innerHTML = movies
      .map(
        (m, i) => `
        <a href="${PATHS.movie}?id=${m.id}" class="search-suggestion-item" role="option" data-index="${i}" tabindex="-1">
          <img class="suggestion-poster" src="${escapeHtml(m.poster || '')}" alt="" loading="lazy" width="40" height="60" />
          <span class="suggestion-text">
            <span class="suggestion-title">${escapeHtml(m.title)}</span>
            <span class="suggestion-meta">${escapeHtml(m.year || '')}${m.rating ? ` · ★ ${escapeHtml(m.rating)}` : ''}</span>
          </span>
        </a>`
      )
      .join('');

    suggestionsEl.hidden = false;
    suggestionsEl.classList.add('open');
    input.setAttribute('aria-expanded', 'true');

    $$('.search-suggestion-item', suggestionsEl).forEach((el) => {
      el.addEventListener('mousedown', (e) => e.preventDefault());
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = el.getAttribute('href');
      });
    });
  };

  const setActiveSuggestion = (index) => {
    const items = $$('.search-suggestion-item', suggestionsEl);
    if (!items.length) return;
    activeIndex = Math.max(-1, Math.min(index, items.length - 1));
    items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    if (activeIndex >= 0) {
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  };

  const updateSuggestions = async (raw) => {
    const q = raw.trim();
    if (q.length < 1) {
      closeSuggestions();
      return;
    }

    const reqId = ++suggestionsRequest;
    const list = await getSearchSuggestions(q, 8);
    if (reqId !== suggestionsRequest) return;
    renderSuggestions(list);
  };

  const performSearch = async (q) => {
    const rawQ = q;
    q = q.trim();
    closeSuggestions();

    if (hero) hero.style.display = q ? 'none' : '';
    if (sectionTitle) sectionTitle.textContent = q ? `Searching for "${rawQ}"...` : 'Trending Now';
    if (sectionLink) sectionLink.style.display = q ? 'none' : '';

    if (grid) grid.style.opacity = '0.5';

    const list = await searchMovies(q);

    if (grid) {
      grid.style.opacity = '1';
      if (sectionTitle) sectionTitle.textContent = q ? `Results for "${rawQ}"` : 'Trending Now';

      grid.innerHTML = list.length
        ? list.map(movieCardHTML).join('')
        : `<p style="grid-column:1/-1;text-align:center;color:#777;padding:40px;">No movies match "${escapeHtml(rawQ)}"</p>`;
    }
  };

  const debouncedSearch = debounce((val) => performSearch(val), 400);
  const debouncedSuggestions = debounce((val) => updateSuggestions(val), 120);

  input.setAttribute('autocomplete', 'off');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  if (suggestionsEl) input.setAttribute('aria-controls', 'searchSuggestions');

  input.addEventListener('input', (e) => {
    const val = e.target.value;
    debouncedSuggestions(val);
    if (grid) debouncedSearch(val);
    else if (!val.trim()) closeSuggestions();
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 1) updateSuggestions(input.value);
  });

  input.addEventListener('keydown', (e) => {
    const items = $$('.search-suggestion-item', suggestionsEl);
    const open = suggestionsEl && !suggestionsEl.hidden && items.length;

    if (e.key === 'ArrowDown' && open) {
      e.preventDefault();
      setActiveSuggestion(activeIndex + 1);
      return;
    }
    if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      setActiveSuggestion(activeIndex - 1);
      return;
    }
    if (e.key === 'Escape') {
      closeSuggestions();
      return;
    }
    if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && currentSuggestions[activeIndex]) {
        e.preventDefault();
        window.location.href = `${PATHS.movie}?id=${currentSuggestions[activeIndex].id}`;
        return;
      }
      const q = input.value.trim();
      if (!grid && q) {
        e.preventDefault();
        window.location.href = `${PATHS.home}?q=${encodeURIComponent(q)}`;
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrap?.contains(e.target)) closeSuggestions();
  });

  if (!grid) {
    return;
  }

  const initialQ = getParam('q');
  if (initialQ) {
    input.value = initialQ;
    performSearch(initialQ);
  }
}

/* --------- Page init --------- */
async function bootstrap() {
  const pageType = getPageType();

  try {
    if (pageType === 'home' || pageType === 'movie') {
      await loadMovies();
    }

    if (pageType === 'home') {
      initHomePage();
    } else if (pageType === 'movie') {
      renderDetails();
    } else if (pageType === 'download') {
      await renderDownload();
    }
  } catch (err) {
    console.error("Page bootstrap failed:", err);
  } finally {
    hideLoader();
  }

  bindSearch();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
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
    // render the homepage grid sorted by release year (newest first)
    const sortedByYear = MOVIES.slice().sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    grid.innerHTML = sortedByYear.map(movieCardHTML).join('');
    // console.log(`Loaded ${MOVIES[1].id} movies into the homepage grid.`);

    let featured;
    MOVIES.forEach(m => {
      if (m.id == movie_id) {
        featured = m;
        return;
      }
    });
    if (!featured) featured = MOVIES[0] || null;

  
   
    const heroBg = $('.hero-bg');
    

    if (featured) {
      if (heroBg && (featured.banner || featured.backdrop)) {
        heroBg.style.backgroundImage = `url('${featured.banner || featured.backdrop}')`;
      }
      if ($('#heroTitle')) $('#heroTitle').textContent = featured.title;
      if ($('#heroDesc')) $('#heroDesc').textContent = featured.description;
      $('#heroWatch')?.setAttribute('href', `${PATHS.movie}?id=${featured.id}`);
    }
  } else {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:100px;color:#777;">No movies found. Check your database.</p>`;
  }

  document.title = "MovifyHub — Premium Movie Downloads";

  // Wire "View all" link to append all movies
  const viewAllLink = document.querySelector('#trending .section-link');
  if (viewAllLink) {
    viewAllLink.addEventListener('click', (e) => {
      e.preventDefault();
      appendAllMovies();
    });
  }
}

async function appendAllMovies() {
  const grid = $('#movieGrid');
  const viewAllLink = document.querySelector('#trending .section-link');
  if (!grid) return;

  if (viewAllLink) {
    viewAllLink.classList.add('loading');
    viewAllLink.textContent = 'Loading all movies...';
  }

  const all = await fetchAllMovies();
  const existingIds = new Set(Array.from(grid.querySelectorAll('.movie-card')).map(card => {
    const url = card.getAttribute('href') || '';
    const match = url.match(/id=(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }).filter(Boolean));

  const missing = all.filter(m => !existingIds.has(m.id));
  // sort missing by year desc before appending
  missing.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));

  if (missing.length) {
    grid.insertAdjacentHTML('beforeend', missing.map(movieCardHTML).join(''));
  }

  if (viewAllLink) {
    viewAllLink.classList.remove('loading');
    viewAllLink.textContent = missing.length ? 'Showing all movies' : 'All movies already loaded';
    viewAllLink.disabled = true;
  }
}

/* --------- Details renderer --------- */
function renderDetails() {
  const id = getParam('id') || getParam('slug');
  if (!id) return;

  const cached = MOVIES.find(x => String(x.id) === String(id) || x.slug === id);
  if (cached) updateUI(cached);

  fetchMovieDetails(id).then((fullMovie) => {
    if (fullMovie) updateUI(fullMovie);
    else if (!cached && $('#dTitle')) {
      $('#dTitle').textContent = 'Movie not found';
    }
  });
}

function updateUI(m) {
  if (!m) return;
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
