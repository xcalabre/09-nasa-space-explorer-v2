// Use this URL to fetch NASA APOD JSON data (mirrored class feed)
const APOD_FEED = 'https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json';

const state = {
  items: [],
  filtered: [],
  displayCount: 3, // How many items to show per batch (changed from 9 to 3 for testing)
  currentlyShowing: 0 // Track how many we're currently displaying
};

const el = sel => document.querySelector(sel);
const gallery = el('#gallery');
const statusEl = el('#status');
const factEl = el('#fact');
const modal = el('#modal');
const modalBody = el('#modalBody');
const loadMoreContainer = el('#loadMoreContainer');
const loadMoreBtn = el('#loadMoreBtn');

// Random space facts (extra credit)
const FACTS = [
  'A day on Venus is longer than a year on Venus.',
  'Neutron stars can spin 600 times per second.',
  'There are more trees on Earth than stars in the Milky Way.',
  'Saturn could float in water because it is mostly made of gas.',
  'On Mars, the sunset is blue.',
  'In space, metal pieces can weld together in a process called cold welding.'
];

// Create ticker content with all facts and emoji separators
function createTickerContent() {
  const separators = ['🌙', '⭐', '🪐']; // Crescent moon, star, Saturn
  let tickerHTML = '<strong>Did you know?</strong> ';
  
  // Duplicate facts to create seamless loop
  const allFacts = [...FACTS, ...FACTS];
  
  allFacts.forEach((fact, index) => {
    tickerHTML += fact;
    // Add random emoji separator between facts
    const emoji = separators[index % separators.length];
    tickerHTML += ` ${emoji} <strong>Did you know?</strong> `;
  });
  
  // Find the ticker content element
  const tickerContent = document.querySelector('.ticker-content');
  if (tickerContent) {
    tickerContent.innerHTML = tickerHTML;
  }
}

// Initialize ticker on page load
createTickerContent();

// Compute responsive column count via JS to satisfy requirement
function applyResponsiveCols(){
  const w = window.innerWidth;
  const cols = w >= 1200 ? 3 : (w >= 750 ? 2 : 1);
  gallery.setAttribute('data-cols', String(cols));
}
window.addEventListener('resize', applyResponsiveCols);
window.addEventListener('orientationchange', applyResponsiveCols);

// Fetch on load to populate cache quickly (and fact banner)
window.addEventListener('DOMContentLoaded', async () => {
  status('loading');
  try {
    const res = await fetch(APOD_FEED, { cache: 'no-store' });
    if(!res.ok) throw new Error('Network error ' + res.status);
    const data = await res.json();
    // Normalize & sort newest first
    state.items = data
      .map(d => ({ ...d, dateObj: new Date(d.date) }))
      .sort((a,b) => b.dateObj - a.dateObj);
    status('idle');
    gallery.hidden = false;
    applyResponsiveCols();
  } catch (err){
    status('error', err.message);
  }
});

// Button handler
el('#getImageBtn').addEventListener('click', () => {
  const start = el('#startDate').value ? new Date(el('#startDate').value) : null;
  const end = el('#endDate').value ? new Date(el('#endDate').value) : null;

  // If no dates, show the latest 9 items initially
  let items = state.items;
  if(start || end){
    items = state.items.filter(it => {
      const t = it.dateObj.getTime();
      const sOk = start ? t >= start.getTime() : true;
      const eOk = end ? t <= end.getTime() : true;
      return sOk && eOk;
    });
  }
  
  // Store filtered items for "Load More" functionality
  state.filtered = items;
  state.currentlyShowing = 0; // Reset counter
  
  // Show initial batch
  loadMoreImages();
});

// Load More functionality - shows next batch of images
function loadMoreImages() {
  const itemsToShow = state.filtered.slice(state.currentlyShowing, state.currentlyShowing + state.displayCount);
  
  // Determine if this is the first load (append = false) or loading more (append = true)
  const isFirstLoad = state.currentlyShowing === 0;
  
  // Make sure gallery is visible on first load
  if (isFirstLoad) {
    gallery.hidden = false;
  }
  
  // Update counter
  state.currentlyShowing += itemsToShow.length;
  
  // Render the new batch (clear gallery on first load, append on subsequent loads)
  renderGallery(itemsToShow, !isFirstLoad);
  
  // Show or hide Load More button
  if (state.currentlyShowing < state.filtered.length) {
    loadMoreContainer.hidden = false;
    // Update button text to show remaining count
    const remaining = state.filtered.length - state.currentlyShowing;
    loadMoreBtn.textContent = `Load More Images (${remaining} remaining)`;
  } else {
    loadMoreContainer.hidden = true;
  }
}

// Load More button click handler
loadMoreBtn.addEventListener('click', loadMoreImages);

function status(mode, msg){
  if(mode === 'loading'){
    statusEl.style.display = 'flex';
    statusEl.querySelector('span:last-child').textContent = '🔄 Loading space photos…';
    gallery.setAttribute('aria-busy', 'true');
  } else if(mode === 'error'){
    statusEl.style.display = 'flex';
    statusEl.querySelector('span:last-child').textContent = '⚠️ ' + (msg || 'Something went wrong.');
    gallery.setAttribute('aria-busy', 'false');
  } else {
    statusEl.style.display = 'none';
    gallery.setAttribute('aria-busy', 'false');
  }
}

// Render gallery cards
function renderGallery(items, append = false){
  // Only clear gallery if not appending
  if (!append) {
    gallery.innerHTML = '';
  }
  
  if(!items.length){
    gallery.innerHTML = `<div class="placeholder"><div class="placeholder-icon">🛰️</div><p>No results for that range. Try a different selection.</p></div>`;
    loadMoreContainer.hidden = true; // Hide Load More button
    return;
  }
  const frag = document.createDocumentFragment();
  items.forEach((it, idx) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.tabIndex = 0;

    const isVideo = it.media_type === 'video';
    const thumbSrc = isVideo ? (it.thumbnail_url || `https://img.youtube.com/vi/${extractYouTubeId(it.url)}/hqdefault.jpg`) : (it.url || it.hdurl);

    card.innerHTML = `
      <div class="thumb-wrap">
        <img class="thumb" src="${thumbSrc}" alt="${escapeHtml(it.title)}" loading="lazy">
        <span class="badge">${isVideo ? 'VIDEO' : 'IMAGE'}</span>
        ${isVideo ? '<div class="play">▶</div>' : ''}
      </div>
      <div class="meta">
        <div class="title">${escapeHtml(it.title)}</div>
        <div class="date">${new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(it.date))}</div>
      </div>
    `;

    card.addEventListener('click', () => openModal(it));
    card.addEventListener('keypress', (e) => { if(e.key === 'Enter') openModal(it); });
    frag.appendChild(card);
  });
  gallery.appendChild(frag);
  applyResponsiveCols();
}

// Modal logic
function openModal(item){
  const isVideo = item.media_type === 'video';
  
  // For videos, ensure YouTube URL has proper parameters
  let videoUrl = item.url;
  if (isVideo && videoUrl.includes('youtube.com')) {
    // Add autoplay and other parameters to YouTube URL
    videoUrl = videoUrl + (videoUrl.includes('?') ? '&' : '?') + 'autoplay=1&rel=0';
  }
  
  const media = isVideo
    ? `<iframe class="modal-media" src="${videoUrl}" title="${escapeHtml(item.title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
    : `<img class="modal-media" src="${item.hdurl || item.url}" alt="${escapeHtml(item.title)}">`;

  modalBody.innerHTML = `
    ${media}
    <div class="modal-body">
      <div class="modal-title">${escapeHtml(item.title)}</div>
      <div class="modal-date">${new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(item.date))}</div>
      <div class="modal-expl">${escapeHtml(item.explanation)}</div>
    </div>
  `;
  modal.setAttribute('open', '');
  modal.setAttribute('aria-hidden', 'false');
}

modal.addEventListener('click', (e) => {
  if(e.target.dataset.close !== undefined){
    closeModal();
  }
});
function closeModal(){
  modal.removeAttribute('open');
  modal.setAttribute('aria-hidden', 'true');
}

// Helpers
function extractYouTubeId(url){
  const m = String(url).match(/(?:embed\/|watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
