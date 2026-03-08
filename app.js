// ===== FLASHCARD APP =====
(function () {
  'use strict';

  // ===== STATE =====
  let allWords = [];
  let filteredWords = [];
  let currentIndex = 0;
  let isFlipped = false;
  let mode = 'flashcard'; // 'flashcard' | 'auto' | 'list'
  let knownSet = new Set();
  let animTick = false; // alternates between cardSlideA / cardSlideB

  // Auto-scroll state
  let autoPlaying = false;
  let autoInterval = null;
  let autoSpeed = 3000;
  let autoShowMeaning = true;

  // List state
  let listLang = 'vn'; // 'vn' | 'en'

  // ===== DOM ELEMENTS =====
  const $ = (sel) => document.querySelector(sel);

  // Stats
  const elStatTotal = $('#stat-total');
  const elStatKnown = $('#stat-known');
  const elStatUnknown = $('#stat-unknown');
  const elProgressFill = $('#progress-fill');

  // Tabs
  const elTabFlashcard = $('#tab-flashcard');
  const elTabAuto = $('#tab-auto');
  const elTabList = $('#tab-list');
  const elFlashcardPanel = $('#flashcard-panel');
  const elAutoPanel = $('#auto-panel');
  const elListPanel = $('#list-panel');

  // Toolbar
  const elSearchInput = $('#search-input');
  const elFilterSelect = $('#filter-select');
  const elBtnShuffle = $('#btn-shuffle');

  // Flashcard mode
  const elFlashcard = $('#flashcard');
  const elCardNumber = $('#card-number');
  const elCardWord = $('#card-word');
  const elBackWord = $('#back-word');
  const elCardDef = $('#card-definition');
  const elCardVn = $('#card-vietnamese');
  const elCardExample = $('#card-example');
  const elBtnPrev = $('#btn-prev');
  const elBtnNext = $('#btn-next');
  const elPosCurrent = $('#pos-current');
  const elPosTotal = $('#pos-total');
  const elBtnForgot = $('#btn-forgot');
  const elBtnKnew = $('#btn-knew');

  // Auto mode
  const elBtnPlay = $('#btn-play');
  const elPlayIcon = $('#play-icon');
  const elSpeedButtons = $('#speed-buttons');
  const elAutoShowMeaning = $('#auto-show-meaning');
  const elAutoCard = $('#auto-card');
  const elAutoCardNumber = $('#auto-card-number');
  const elAutoWord = $('#auto-word');
  const elAutoDetails = $('#auto-details');
  const elAutoDef = $('#auto-definition');
  const elAutoVn = $('#auto-vietnamese');
  const elAutoExample = $('#auto-example');
  const elTimerFill = $('#timer-fill');
  const elAutoBtnPrev = $('#auto-btn-prev');
  const elAutoBtnNext = $('#auto-btn-next');
  const elAutoPosCurrent = $('#auto-pos-current');
  const elAutoPosTotal = $('#auto-pos-total');
  const elAutoBtnForgot = $('#auto-btn-forgot');
  const elAutoBtnKnew = $('#auto-btn-knew');

  // List mode
  const elLangBtnVn = $('#lang-btn-vn');
  const elLangBtnEn = $('#lang-btn-en');
  const elVocabTbody = $('#vocab-tbody');
  const elListCount = $('#list-count');
  const elThMeaning = $('#th-meaning');

  // ===== ANIMATION HELPER (flicker-free) =====
  // Alternate between two identical animation names so the browser
  // always sees a new animation name and restarts without reflow.
  function triggerCardAnim(el) {
    animTick = !animTick;
    el.classList.remove('card-anim-a', 'card-anim-b');
    el.classList.add(animTick ? 'card-anim-a' : 'card-anim-b');
  }

  // ===== LOAD DATA =====
  async function loadWords() {
    try {
      const res = await fetch('list1.json');
      allWords = await res.json();
      loadProgress();
      applyFilter();
      updateStats();
      renderCard();
    } catch (err) {
      console.error('Failed to load list1.json:', err);
      elCardWord.textContent = 'Lỗi tải dữ liệu';
    }
  }

  // ===== LOCALSTORAGE =====
  function loadProgress() {
    try {
      const saved = localStorage.getItem('flashcard_known_v1');
      if (saved) knownSet = new Set(JSON.parse(saved));
    } catch (e) { /* ignore */ }
  }

  function saveProgress() {
    try {
      localStorage.setItem('flashcard_known_v1', JSON.stringify([...knownSet]));
    } catch (e) { /* ignore */ }
  }

  // ===== FILTER & SEARCH =====
  function applyFilter() {
    const filter = elFilterSelect.value;
    const search = elSearchInput.value.trim().toLowerCase();

    filteredWords = allWords.filter((w) => {
      if (filter === 'known' && !knownSet.has(w.id)) return false;
      if (filter === 'unknown' && knownSet.has(w.id)) return false;
      if (search) {
        return (
          w.word.toLowerCase().includes(search) ||
          w.vietnamese.toLowerCase().includes(search) ||
          w.definition.toLowerCase().includes(search)
        );
      }
      return true;
    });

    if (currentIndex >= filteredWords.length) {
      currentIndex = Math.max(0, filteredWords.length - 1);
    }
    updatePositionDisplay();
  }

  // ===== STATS =====
  function updateStats() {
    const total = allWords.length;
    const known = knownSet.size;
    const unknown = total - known;
    const pct = total > 0 ? (known / total) * 100 : 0;

    elStatTotal.textContent = total;
    elStatKnown.textContent = known;
    elStatUnknown.textContent = unknown;
    elProgressFill.style.width = pct + '%';
  }

  // ===== RENDER FLASHCARD =====
  function renderCard() {
    if (filteredWords.length === 0) {
      elCardWord.textContent = 'Không có từ nào';
      elCardNumber.textContent = '#0';
      elBackWord.textContent = '';
      elCardDef.textContent = '';
      elCardVn.textContent = '';
      elCardExample.innerHTML = '';
      return;
    }

    const word = filteredWords[currentIndex];
    if (!word) return;

    isFlipped = false;
    elFlashcard.classList.remove('flipped');

    elCardNumber.textContent = `#${word.id}`;
    elCardWord.textContent = word.word;
    elBackWord.textContent = word.word;
    elCardDef.textContent = word.definition;
    elCardVn.textContent = word.vietnamese;
    elCardExample.innerHTML = highlightWord(word.example, word.word);

    triggerCardAnim(elFlashcard);
    updatePositionDisplay();
  }

  // ===== RENDER AUTO CARD =====
  function renderAutoCard() {
    if (filteredWords.length === 0) {
      elAutoWord.textContent = 'Không có từ nào';
      elAutoCardNumber.textContent = '#0';
      elAutoDetails.classList.add('hidden');
      return;
    }

    const word = filteredWords[currentIndex];
    if (!word) return;

    elAutoCardNumber.textContent = `#${word.id}`;
    elAutoWord.textContent = word.word;

    if (autoShowMeaning) {
      elAutoDetails.classList.remove('hidden');
      elAutoDef.textContent = word.definition;
      elAutoVn.textContent = word.vietnamese;
      elAutoExample.innerHTML = highlightWord(word.example, word.word);
    } else {
      elAutoDetails.classList.add('hidden');
    }

    triggerCardAnim(elAutoCard);
    updatePositionDisplay();
  }

  // ===== RENDER LIST =====
  function renderList() {
    const isVn = (listLang === 'vn');
    elThMeaning.textContent = isVn ? 'Nghĩa tiếng Việt' : 'Definition (EN)';
    elListCount.textContent = `${filteredWords.length} từ`;

    // Build rows as a DocumentFragment for performance
    const frag = document.createDocumentFragment();

    filteredWords.forEach((w, idx) => {
      const known = knownSet.has(w.id);
      const meaning = isVn ? w.vietnamese : w.definition;

      const tr = document.createElement('tr');
      tr.dataset.idx = idx;
      if (known) tr.classList.add('is-known');
      if (idx === currentIndex) tr.classList.add('active-row');

      // #id cell
      const tdId = document.createElement('td');
      tdId.textContent = w.id;

      // Word cell
      const tdWord = document.createElement('td');
      tdWord.className = 'td-word';
      tdWord.textContent = w.word;

      // Meaning cell
      const tdMeaning = document.createElement('td');
      tdMeaning.className = `td-meaning${isVn ? ' vn' : ''}`;
      tdMeaning.textContent = meaning;

      // Actions cell — status dot + two mini Phosphor icon buttons
      const tdActions = document.createElement('td');
      tdActions.className = 'td-actions';

      const dotSpan = document.createElement('span');
      dotSpan.className = `status-dot${known ? ' known' : ''}`;

      const btnWrap = document.createElement('div');
      btnWrap.className = 'row-btns';

      const btnKnew = document.createElement('button');
      btnKnew.className = 'row-btn row-btn-knew';
      btnKnew.title = 'Đánh dấu đã nhớ';
      btnKnew.innerHTML = '<i class="ph ph-check-circle"></i>';

      const btnForgot = document.createElement('button');
      btnForgot.className = 'row-btn row-btn-forgot';
      btnForgot.title = 'Chưa nhớ / bỏ đánh dấu';
      btnForgot.innerHTML = '<i class="ph ph-x-circle"></i>';

      // Prevent button click from bubbling to <tr> (which jumps to flashcard)
      btnKnew.addEventListener('click', (e) => {
        e.stopPropagation();
        knownSet.add(w.id);
        saveProgress();
        updateStats();
        tr.classList.add('is-known');
        dotSpan.classList.add('known');
      });

      btnForgot.addEventListener('click', (e) => {
        e.stopPropagation();
        knownSet.delete(w.id);
        saveProgress();
        updateStats();
        tr.classList.remove('is-known');
        dotSpan.classList.remove('known');
      });

      btnWrap.appendChild(btnKnew);
      btnWrap.appendChild(btnForgot);

      // Single flex wrapper keeps dot + buttons on ONE line
      const actionsInner = document.createElement('div');
      actionsInner.className = 'actions-inner';
      actionsInner.appendChild(dotSpan);
      actionsInner.appendChild(btnWrap);
      tdActions.appendChild(actionsInner);

      // Row click → jump to that word in flashcard mode
      tr.addEventListener('click', () => {
        currentIndex = idx;
        switchMode('flashcard');
      });

      tr.appendChild(tdId);
      tr.appendChild(tdWord);
      tr.appendChild(tdMeaning);
      tr.appendChild(tdActions);
      frag.appendChild(tr);
    });

    elVocabTbody.innerHTML = '';
    elVocabTbody.appendChild(frag);

    const activeRow = elVocabTbody.querySelector('.active-row');
    if (activeRow) activeRow.scrollIntoView({ block: 'nearest' });
  }

  // ===== HELPERS =====
  function highlightWord(text, word) {
    if (!text || !word) return text || '';
    const regex = new RegExp(`(${escapeRegex(word)}\\w*)`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function updatePositionDisplay() {
    const total = filteredWords.length;
    const cur = total > 0 ? currentIndex + 1 : 0;

    elPosCurrent.textContent = cur;
    elPosTotal.textContent = total;
    elAutoPosCurrent.textContent = cur;
    elAutoPosTotal.textContent = total;

    elBtnPrev.disabled = total === 0;
    elBtnNext.disabled = total === 0;
    elAutoBtnPrev.disabled = total === 0;
    elAutoBtnNext.disabled = total === 0;
  }

  // ===== NAVIGATION =====
  function goNext() {
    if (filteredWords.length === 0) return;
    currentIndex = (currentIndex + 1) % filteredWords.length;
    if (mode === 'flashcard') renderCard();
    else if (mode === 'auto') renderAutoCard();
  }

  function goPrev() {
    if (filteredWords.length === 0) return;
    currentIndex = (currentIndex - 1 + filteredWords.length) % filteredWords.length;
    if (mode === 'flashcard') renderCard();
    else if (mode === 'auto') renderAutoCard();
  }

  function flipCard() {
    if (filteredWords.length === 0) return;
    isFlipped = !isFlipped;
    elFlashcard.classList.toggle('flipped', isFlipped);
  }

  // ===== MEMORY =====
  function markKnown() {
    if (filteredWords.length === 0) return;
    const word = filteredWords[currentIndex];
    knownSet.add(word.id);
    saveProgress();
    updateStats();
    if (elFilterSelect.value === 'unknown') {
      applyFilter();
      if (currentIndex >= filteredWords.length) currentIndex = 0;
      if (mode === 'flashcard') renderCard();
      else if (mode === 'auto') renderAutoCard();
    } else {
      goNext();
    }
  }

  function markForgot() {
    if (filteredWords.length === 0) return;
    const word = filteredWords[currentIndex];
    knownSet.delete(word.id);
    saveProgress();
    updateStats();
    if (elFilterSelect.value === 'known') {
      applyFilter();
      if (currentIndex >= filteredWords.length) currentIndex = 0;
      if (mode === 'flashcard') renderCard();
      else if (mode === 'auto') renderAutoCard();
    } else {
      goNext();
    }
  }

  // ===== SHUFFLE =====
  function shuffleWords() {
    for (let i = filteredWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filteredWords[i], filteredWords[j]] = [filteredWords[j], filteredWords[i]];
    }
    currentIndex = 0;
    if (mode === 'flashcard') renderCard();
    else if (mode === 'auto') renderAutoCard();
    else renderList();
  }

  // ===== MODE SWITCH =====
  function switchMode(newMode) {
    const prev = mode;
    mode = newMode;

    elTabFlashcard.classList.toggle('active', mode === 'flashcard');
    elTabAuto.classList.toggle('active', mode === 'auto');
    elTabList.classList.toggle('active', mode === 'list');

    elFlashcardPanel.classList.toggle('active', mode === 'flashcard');
    elAutoPanel.classList.toggle('active', mode === 'auto');
    elListPanel.classList.toggle('active', mode === 'list');

    if (mode !== 'auto' && prev === 'auto') stopAutoScroll();

    if (mode === 'flashcard') renderCard();
    else if (mode === 'auto') renderAutoCard();
    else if (mode === 'list') renderList();
  }

  // ===== AUTO-SCROLL =====
  function startAutoScroll() {
    if (filteredWords.length === 0) return;
    autoPlaying = true;
    elBtnPlay.classList.add('playing');
    elPlayIcon.className = 'ph ph-pause';

    renderAutoCard();
    startTimer();

    autoInterval = setInterval(() => {
      goNext();
      startTimer();
    }, autoSpeed);
  }

  function stopAutoScroll() {
    autoPlaying = false;
    elBtnPlay.classList.remove('playing');
    elPlayIcon.className = 'ph ph-play';
    if (autoInterval) { clearInterval(autoInterval); autoInterval = null; }
    elTimerFill.style.transition = 'none';
    elTimerFill.style.width = '0%';
  }

  function toggleAutoScroll() {
    if (autoPlaying) stopAutoScroll();
    else startAutoScroll();
  }

  function startTimer() {
    elTimerFill.style.transition = 'none';
    elTimerFill.style.width = '0%';
    requestAnimationFrame(() => {
      elTimerFill.style.transition = `width ${autoSpeed}ms linear`;
      elTimerFill.style.width = '100%';
    });
  }

  function setSpeed(speed) {
    autoSpeed = speed;
    elSpeedButtons.querySelectorAll('.speed-btn').forEach((btn) => {
      btn.classList.toggle('active', parseInt(btn.dataset.speed) === speed);
    });
    if (autoPlaying) { stopAutoScroll(); startAutoScroll(); }
  }

  // ===== EVENT LISTENERS =====
  elTabFlashcard.addEventListener('click', () => switchMode('flashcard'));
  elTabAuto.addEventListener('click', () => switchMode('auto'));
  elTabList.addEventListener('click', () => switchMode('list'));

  elFlashcard.addEventListener('click', flipCard);

  elBtnPrev.addEventListener('click', goPrev);
  elBtnNext.addEventListener('click', goNext);
  elAutoBtnPrev.addEventListener('click', () => {
    if (autoPlaying) { stopAutoScroll(); startAutoScroll(); }
    goPrev();
  });
  elAutoBtnNext.addEventListener('click', () => {
    if (autoPlaying) { stopAutoScroll(); startAutoScroll(); }
    goNext();
  });

  elBtnKnew.addEventListener('click', markKnown);
  elBtnForgot.addEventListener('click', markForgot);
  elAutoBtnKnew.addEventListener('click', markKnown);
  elAutoBtnForgot.addEventListener('click', markForgot);

  elBtnShuffle.addEventListener('click', shuffleWords);

  let searchTimer;
  elSearchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentIndex = 0;
      applyFilter();
      if (mode === 'flashcard') renderCard();
      else if (mode === 'auto') renderAutoCard();
      else renderList();
    }, 200);
  });

  elFilterSelect.addEventListener('change', () => {
    currentIndex = 0;
    applyFilter();
    if (mode === 'flashcard') renderCard();
    else if (mode === 'auto') renderAutoCard();
    else renderList();
  });

  elBtnPlay.addEventListener('click', toggleAutoScroll);

  elSpeedButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.speed-btn');
    if (btn) setSpeed(parseInt(btn.dataset.speed));
  });

  elAutoShowMeaning.addEventListener('change', () => {
    autoShowMeaning = elAutoShowMeaning.checked;
    renderAutoCard();
  });

  elLangBtnVn.addEventListener('click', () => {
    listLang = 'vn';
    elLangBtnVn.classList.add('active');
    elLangBtnEn.classList.remove('active');
    renderList();
  });

  elLangBtnEn.addEventListener('click', () => {
    listLang = 'en';
    elLangBtnEn.classList.add('active');
    elLangBtnVn.classList.remove('active');
    renderList();
  });

  // ===== KEYBOARD SHORTCUTS =====
  document.addEventListener('keydown', (e) => {
    if (e.target === elSearchInput) return;
    switch (e.key) {
      case ' ':
      case 'Space':
        e.preventDefault();
        if (mode === 'flashcard') flipCard();
        else if (mode === 'auto') toggleAutoScroll();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (mode === 'auto' && autoPlaying) { stopAutoScroll(); startAutoScroll(); }
        goPrev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (mode === 'auto' && autoPlaying) { stopAutoScroll(); startAutoScroll(); }
        goNext();
        break;
      case 'g': case 'G': markKnown(); break;
      case 'r': case 'R': markForgot(); break;
      case 's': case 'S': shuffleWords(); break;
      case 'a': case 'A':
        switchMode(mode === 'flashcard' ? 'auto' : 'flashcard');
        break;
      case 'l': case 'L':
        switchMode(mode === 'list' ? 'flashcard' : 'list');
        break;
    }
  });

  // Touch swipe
  let touchStartX = 0, touchStartY = 0;
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0) goPrev(); else goNext();
    }
  }, { passive: true });

  // ===== INIT =====
  loadWords();
})();
