const form = document.getElementById('check-form');
const userIdInput = document.getElementById('userId');
const serverIdInput = document.getElementById('serverId');
const submitBtn = document.getElementById('submit-btn');
const cardsEl = document.getElementById('cards');
const skeletonEl = document.getElementById('skeleton');
const idleEl = document.getElementById('state-idle');
const errorEl = document.getElementById('state-error');
const errorText = document.getElementById('error-text');
const playerChip = document.getElementById('player-chip');
const playerSkeleton = document.getElementById('player-skeleton');
const playerName = document.getElementById('player-name');
const playerIds = document.getElementById('player-ids');
const playerAvatar = document.getElementById('player-avatar');
const resultTitle = document.getElementById('result-title');
const retryBtn = document.getElementById('retry-btn');
const cacheNote = document.getElementById('cache-note');

const MOBAPAY_URL = 'https://www.mobapay.com/mlbb';
let lastQuery = null;

const ICON_DIAMOND =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l-2 6 5 12 5-12-2-6"/></svg>';
const ICON_ARROW =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>';

const SKELETON_CARD = `
  <div class="skeleton-card">
    <div class="sk-row">
      <span class="sk sk-icon"></span>
      <span class="sk sk-tag"></span>
    </div>
    <span class="sk sk-title"></span>
    <span class="sk sk-sub"></span>
    <span class="sk sk-price"></span>
    <div class="sk-foot">
      <span class="sk sk-line sk-w-35"></span>
      <span class="sk sk-line sk-w-25"></span>
    </div>
  </div>`;
skeletonEl.innerHTML = SKELETON_CARD.repeat(4);

function setState(state) {
  idleEl.hidden = state !== 'idle';
  errorEl.hidden = state !== 'error';
  skeletonEl.hidden = state !== 'loading';
  playerSkeleton.hidden = state !== 'loading';
  cardsEl.hidden = state !== 'success';
  if (state !== 'success') {
    playerChip.hidden = true;
    cacheNote.hidden = true;
    resultTitle.textContent = 'Paket Diamond Ganda';
  }
}

function showError(message) {
  errorText.textContent = message;
  setState('error');
  document.getElementById('cek').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function makeCard(item, index) {
  const locked = !item.is_available;
  const card = el('article', 'card' + (locked ? ' is-locked' : ''));
  card.style.animationDelay = Math.min(index * 55, 330) + 'ms';

  const top = el('div', 'card-top');
  const icon = el('div', 'diamond-icon');
  icon.innerHTML = ICON_DIAMOND;
  const tag = el('span', 'tag' + (locked ? ' stale' : ''), locked ? 'Limit habis' : 'Tersedia');
  top.append(icon, tag);

  card.append(top);
  card.append(el('h3', 'card-tier', item.tier || item.title || 'Paket'));
  card.append(el('p', 'card-sub', `${item.total_diamonds || 0} diamond total`));

  const priceRow = el('div', 'price-row');
  priceRow.append(el('span', 'price', item.discount_price || '-'));
  if (item.original_price && item.original_price !== item.discount_price) {
    priceRow.append(el('span', 'price-old', item.original_price));
  }
  if (item.discount_percent) {
    priceRow.append(el('span', 'discount', item.discount_percent));
  }
  card.append(priceRow);

  const foot = el('div', 'card-foot');
  foot.append(el('span', 'status-text', item.status || ''));

  if (locked) {
    foot.append(el('span', 'buy-link is-disabled', 'Tidak tersedia'));
  } else {
    const link = el('a', 'buy-link');
    link.href = MOBAPAY_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.innerHTML = 'Beli di Mobapay ' + ICON_ARROW;
    foot.append(link);
  }

  card.append(foot);
  return card;
}

function renderResult(data) {
  playerName.textContent = data.player.name || 'Unknown';
  playerIds.textContent = `${data.player.userId} · ${data.player.serverId}`;
  playerAvatar.textContent = (data.player.name || '?').trim().charAt(0) || '?';
  playerChip.hidden = false;

  if (data.cached) {
    const time = data.cached_at
      ? new Date(data.cached_at).toLocaleString('id-ID')
      : 'sebelumnya';
    cacheNote.textContent = `Mobapay sedang tidak dapat dihubungi. Menampilkan data cache dari ${time}.`;
    cacheNote.hidden = false;
  }

  resultTitle.textContent = data.event.title || 'Paket Diamond Ganda';
  const items = data.diamond_ganda_items || [];

  cardsEl.textContent = '';
  if (!items.length) {
    setState('idle');
    idleEl.querySelector('p').textContent = 'Tidak ada paket yang tersedia untuk akun ini.';
    return;
  }

  items.forEach((item, i) => cardsEl.append(makeCard(item, i)));
  setState('success');
}

async function check(userId, serverId) {
  lastQuery = { userId, serverId };
  submitBtn.classList.add('is-loading');
  submitBtn.querySelector('.btn-label').textContent = 'Mengecek';
  playerChip.hidden = true;
  setState('loading');

  try {
    const res = await fetch(
      `/api/check?userId=${encodeURIComponent(userId)}&serverId=${encodeURIComponent(serverId)}`
    );
    const data = await res.json();

    if (!res.ok || data.status === 'error') {
      throw new Error(data.error || 'Gagal mengecek akun. Coba lagi.');
    }

    renderResult(data);
  } catch (err) {
    showError(err.message);
  } finally {
    submitBtn.classList.remove('is-loading');
    submitBtn.querySelector('.btn-label').textContent = 'Cek sekarang';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const userId = userIdInput.value.trim();
  const serverId = serverIdInput.value.trim();

  if (!/^\d{4,20}$/.test(userId)) {
    userIdInput.focus();
    return showError('User ID harus berupa angka (minimal 4 digit).');
  }
  if (!/^\d{3,20}$/.test(serverId)) {
    serverIdInput.focus();
    return showError('Server ID harus berupa angka (minimal 3 digit).');
  }

  check(userId, serverId);
  document.getElementById('cek').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

retryBtn.addEventListener('click', () => {
  if (lastQuery) check(lastQuery.userId, lastQuery.serverId);
});

const ID_PAIR_RE = /^\s*(\d{4,20})\s*[([{]\s*(\d{3,20})\s*[)\]}]/;

function applyIdPair(text) {
  const match = String(text).match(ID_PAIR_RE);
  if (!match) return false;
  userIdInput.value = match[1];
  serverIdInput.value = match[2];
  return true;
}

[userIdInput, serverIdInput].forEach((input) => {
  input.addEventListener('paste', (event) => {
    const text = (event.clipboardData || window.clipboardData).getData('text');
    if (applyIdPair(text)) event.preventDefault();
  });

  input.addEventListener('input', () => {
    if (applyIdPair(input.value)) return;
    input.value = input.value.replace(/\D/g, '');
  });
});

/* word reveal */
function splitWords(root) {
  let index = 0;

  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!child.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(' ');
          const word = document.createElement('span');
          word.className = 'word';
          word.style.setProperty('--i', index++);
          word.textContent = part;
          frag.append(word);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
        if (child.classList.contains('gradient-text')) {
          child.classList.add('word');
          child.style.setProperty('--i', index++);
          return;
        }
        walk(child);
      }
    });
  };

  walk(root);
}

document.querySelectorAll('.reveal-text').forEach(splitWords);

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px' }
);

document.querySelectorAll('.reveal-text, .reveal-card').forEach((node) => revealObserver.observe(node));

/* parallax */
const parallaxNodes = Array.from(document.querySelectorAll('[data-parallax]'));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let ticking = false;

function applyParallax() {
  const y = window.scrollY;
  parallaxNodes.forEach((node) => {
    const rate = parseFloat(node.dataset.parallax) || 0;
    node.style.transform = `translate3d(0, ${(y * rate).toFixed(1)}px, 0)`;
  });
  ticking = false;
}

window.addEventListener(
  'scroll',
  () => {
    if (reduceMotion.matches || ticking) return;
    ticking = true;
    requestAnimationFrame(applyParallax);
  },
  { passive: true }
);

/* faq accordion */
document.querySelectorAll('.faq-list details').forEach((details) => {
  const summary = details.querySelector('summary');
  const body = details.querySelector('.faq-body');
  if (!summary || !body) return;

  let animating = false;

  summary.addEventListener('click', (event) => {
    event.preventDefault();
    if (animating) return;

    if (reduceMotion.matches) {
      details.open = !details.open;
      details.classList.toggle('is-open', details.open);
      return;
    }

    animating = true;

    if (details.open) {
      details.classList.remove('is-open');
      const height = body.scrollHeight;
      const anim = body.animate(
        [
          { height: `${height}px`, opacity: 1 },
          { height: '0px', opacity: 0 }
        ],
        { duration: 240, easing: 'ease' }
      );
      anim.onfinish = () => {
        details.open = false;
        animating = false;
      };
      anim.oncancel = () => {
        animating = false;
      };
    } else {
      details.open = true;
      details.classList.add('is-open');
      const height = body.scrollHeight;
      body
        .animate(
          [
            { height: '0px', opacity: 0 },
            { height: `${height}px`, opacity: 1 }
          ],
          { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        )
        .addEventListener('finish', () => {
          animating = false;
        });
    }
  });
});
