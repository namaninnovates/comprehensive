/**
 * Comprehensive Exam Quiz System - Main Application Orchestrator
 * Connects UI views, theme switching, page chunk multi-select, and keyboard controls.
 */

window.App = (function () {
  // State for page chunk selection
  const selectedChunks = new Set([0]); // Default: first chunk (1-50)
  let customRange = null; // null or { start: 1, end: 50 }
  let selectedMode = 'exam';
  let selectedCountLimit = 'all';
  let selectedTimer = 'stopwatch';

  const CHUNKS = [
    { start: 1, end: 50, label: '1 – 50' },
    { start: 51, end: 100, label: '51 – 100' },
    { start: 101, end: 150, label: '101 – 150' },
    { start: 151, end: 200, label: '151 – 200' },
    { start: 201, end: 250, label: '201 – 250' },
    { start: 251, end: 300, label: '251 – 300' },
    { start: 301, end: 350, label: '301 – 350' },
    { start: 351, end: 400, label: '351 – 400' }
  ];

  async function ensureQuestionsLoaded() {
    if (window.COMPREHENSIVE_QUESTIONS && window.COMPREHENSIVE_QUESTIONS.length > 0) {
      return true;
    }
    // Fallback to fetch questions.json
    try {
      const resp = await fetch('data/questions.json');
      if (resp.ok) {
        window.COMPREHENSIVE_QUESTIONS = await resp.json();
        return true;
      }
    } catch (e) {
      console.warn('Could not fetch questions.json:', e);
    }
    return false;
  }

  async function init() {
    initTheme();
    setupNavigation();
    setupSettingsControls();
    setupQuizControls();
    setupKeyboardShortcuts();

    // Ensure questions are ready
    await ensureQuestionsLoaded();

    renderChunkGrid();

    // Initialize sub-modules
    if (window.HistoryModule) {
      window.HistoryModule.updateHistoryBadge();
    }
    if (window.BankModule) {
      window.BankModule.init();
    }

    updateSelectionSummary();
  }

  /* --------------------------------------------------------------------------
     Theme Management
     -------------------------------------------------------------------------- */
  function initTheme() {
    let saved = 'dark';
    try {
      saved = localStorage.getItem('csbs_theme') || 'dark';
    } catch (e) {
      saved = 'dark';
    }
    setTheme(saved);

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        setTheme(next);
      });
    }
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('csbs_theme', theme);
    } catch (e) {}

    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
  }

  /* --------------------------------------------------------------------------
     Navigation & View Switching
     -------------------------------------------------------------------------- */
  function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-links .nav-btn').forEach(btn => btn.classList.remove('active'));

    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    const navBtn = document.getElementById(`nav-btn-${viewName}`);
    if (navBtn) {
      navBtn.classList.add('active');
    }

    if (viewName === 'history' && window.HistoryModule) {
      window.HistoryModule.renderHistoryTable();
    } else if (viewName === 'bank' && window.BankModule) {
      window.BankModule.applyFilter();
    }

    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {}
  }

  function setupNavigation() {
    document.getElementById('nav-logo-home')?.addEventListener('click', () => switchView('setup'));
    document.getElementById('nav-btn-setup')?.addEventListener('click', () => switchView('setup'));
    document.getElementById('nav-btn-history')?.addEventListener('click', () => switchView('history'));
    document.getElementById('nav-btn-bank')?.addEventListener('click', () => switchView('bank'));

    document.getElementById('btn-new-quiz-setup')?.addEventListener('click', () => switchView('setup'));
    document.getElementById('btn-history-new-quiz')?.addEventListener('click', () => switchView('setup'));

    document.getElementById('btn-clear-all-history')?.addEventListener('click', () => {
      if (window.HistoryModule) {
        window.HistoryModule.clearAll();
      }
    });
  }

  /* --------------------------------------------------------------------------
     Page Chunks (Multiples of 50) & Selection UI
     -------------------------------------------------------------------------- */
  function renderChunkGrid() {
    const container = document.getElementById('chunk-grid-container');
    if (!container) return;

    const all = window.COMPREHENSIVE_QUESTIONS || [];

    container.innerHTML = CHUNKS.map((chunk, idx) => {
      const count = all.filter(q => q.page >= chunk.start && q.page <= chunk.end).length;
      const isSelected = selectedChunks.has(idx);

      return `
        <button class="chunk-btn ${isSelected ? 'selected' : ''}" data-chunk-idx="${idx}" id="chunk-card-${idx}">
          <span class="chunk-pages">Pages ${chunk.label}</span>
          <span class="chunk-count">${count} Questions</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll('.chunk-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.chunkIdx, 10);
        toggleChunk(idx);
      });
    });
  }

  function toggleChunk(idx) {
    customRange = null;
    const msg = document.getElementById('range-validation-msg');
    if (msg) msg.style.display = 'none';

    if (selectedChunks.has(idx)) {
      selectedChunks.delete(idx);
    } else {
      selectedChunks.add(idx);
    }

    updateChunkUI();
    updateSelectionSummary();
  }

  function updateChunkUI() {
    CHUNKS.forEach((_, idx) => {
      const btn = document.getElementById(`chunk-card-${idx}`);
      if (!btn) return;
      if (selectedChunks.has(idx)) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  function setupSettingsControls() {
    // Presets
    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const preset = chip.dataset.preset;
        applyPreset(preset);
      });
    });

    // Custom Range Apply
    document.getElementById('btn-apply-custom-range')?.addEventListener('click', applyCustomRange);

    // Mode pills
    document.querySelectorAll('#mode-pills .pill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#mode-pills .pill-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMode = btn.dataset.mode;
      });
    });

    // Count pills
    document.querySelectorAll('#count-pills .pill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#count-pills .pill-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCountLimit = btn.dataset.count;
        updateSelectionSummary();
      });
    });

    // Start Quiz Button
    document.getElementById('btn-start-quiz')?.addEventListener('click', handleStartQuiz);
  }

  function applyPreset(preset) {
    customRange = null;
    const msg = document.getElementById('range-validation-msg');
    if (msg) msg.style.display = 'none';

    selectedChunks.clear();

    document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
    document.querySelector(`.preset-chip[data-preset="${preset}"]`)?.classList.add('active');

    if (preset === '1-50') {
      selectedChunks.add(0);
    } else if (preset === '1-100') {
      selectedChunks.add(0);
      selectedChunks.add(1);
    } else if (preset === '101-200') {
      selectedChunks.add(2);
      selectedChunks.add(3);
    } else if (preset === '201-300') {
      selectedChunks.add(4);
      selectedChunks.add(5);
    } else if (preset === '301-400') {
      selectedChunks.add(6);
      selectedChunks.add(7);
    } else if (preset === '101-400') {
      [2, 3, 4, 5, 6, 7].forEach(i => selectedChunks.add(i));
    } else if (preset === 'all') {
      CHUNKS.forEach((_, i) => selectedChunks.add(i));
    }

    updateChunkUI();
    updateSelectionSummary();
  }

  function applyCustomRange() {
    const startInp = document.getElementById('input-custom-start');
    const endInp = document.getElementById('input-custom-end');
    const msg = document.getElementById('range-validation-msg');

    const start = parseInt(startInp?.value, 10);
    const end = parseInt(endInp?.value, 10);

    if (isNaN(start) || isNaN(end) || start < 1 || end > 400 || start > end) {
      if (msg) {
        msg.textContent = 'Please enter a valid page range between 1 and 400.';
        msg.style.display = 'inline-block';
      }
      return;
    }

    if (msg) msg.style.display = 'none';
    customRange = { start, end };
    selectedChunks.clear();
    updateChunkUI();

    document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
    updateSelectionSummary();
  }

  function getActiveRanges() {
    if (customRange) {
      return [{ start: customRange.start, end: customRange.end }];
    }
    const ranges = [];
    selectedChunks.forEach(idx => {
      ranges.push({ start: CHUNKS[idx].start, end: CHUNKS[idx].end });
    });
    return ranges;
  }

  function getPageRangeDescription() {
    if (customRange) {
      return `Pages ${customRange.start} – ${customRange.end}`;
    }
    if (selectedChunks.size === 0) return 'None Selected';
    if (selectedChunks.size === CHUNKS.length) return 'All Pages (1 – 400)';

    const sorted = Array.from(selectedChunks).sort((a, b) => a - b);
    return sorted.map(i => CHUNKS[i].label).join(', ');
  }

  function updateSelectionSummary() {
    const all = window.COMPREHENSIVE_QUESTIONS || [];
    const ranges = getActiveRanges();
    const countSummary = document.getElementById('selection-summary-count');
    const pagesSummary = document.getElementById('selection-summary-pages');
    const startBtn = document.getElementById('btn-start-quiz');

    let matchingQuestions = all.filter(q => {
      return ranges.some(r => q.page >= r.start && q.page <= r.end);
    });

    const totalAvailable = matchingQuestions.length;
    const pageDesc = getPageRangeDescription();

    if (pagesSummary) pagesSummary.textContent = `${pageDesc} selected`;

    if (totalAvailable === 0) {
      if (countSummary) countSummary.textContent = '0 questions available';
      if (startBtn) startBtn.disabled = true;
      return;
    }

    let willTake = totalAvailable;
    if (selectedCountLimit !== 'all') {
      const limit = parseInt(selectedCountLimit, 10);
      if (!isNaN(limit) && limit < totalAvailable) {
        willTake = limit;
      }
    }

    if (countSummary) {
      countSummary.innerHTML = `<strong>${willTake}</strong> test questions (${totalAvailable} in range)`;
    }
    if (startBtn) startBtn.disabled = false;
  }

  function handleStartQuiz() {
    const ranges = getActiveRanges();
    if (ranges.length === 0) {
      alert('Please select at least one page chunk or a custom page range.');
      return;
    }

    const jumbleQ = document.getElementById('toggle-jumble-questions')?.checked ?? true;
    const jumbleO = document.getElementById('toggle-jumble-options')?.checked ?? false;

    const config = {
      ranges: ranges,
      pageRangeDesc: getPageRangeDescription(),
      jumbleQuestions: jumbleQ,
      jumbleOptions: jumbleO,
      countLimit: selectedCountLimit,
      mode: selectedMode
    };

    if (window.QuizModule) {
      window.QuizModule.startQuiz(config);
    }
  }

  /* --------------------------------------------------------------------------
     Active Quiz & Result Action Bindings
     -------------------------------------------------------------------------- */
  function setupQuizControls() {
    document.getElementById('btn-next-question')?.addEventListener('click', () => {
      window.QuizModule?.nextQuestion();
    });

    document.getElementById('btn-prev-question')?.addEventListener('click', () => {
      window.QuizModule?.prevQuestion();
    });

    document.getElementById('btn-clear-answer')?.addEventListener('click', () => {
      window.QuizModule?.clearAnswer();
    });

    document.getElementById('btn-flag-question')?.addEventListener('click', () => {
      window.QuizModule?.toggleFlag();
    });

    document.getElementById('btn-submit-exam')?.addEventListener('click', () => {
      window.QuizModule?.showSubmitModal();
    });

    document.getElementById('btn-cancel-submit')?.addEventListener('click', () => {
      window.QuizModule?.hideSubmitModal();
    });

    document.getElementById('btn-confirm-submit')?.addEventListener('click', () => {
      window.QuizModule?.submitQuiz();
    });

    // Scorecard Results Buttons
    document.getElementById('btn-retake-entire')?.addEventListener('click', () => {
      window.QuizModule?.retakeEntire();
    });

    document.getElementById('btn-retake-missed')?.addEventListener('click', () => {
      window.QuizModule?.retakeMissed();
    });

    // Result filter buttons
    document.querySelectorAll('.rev-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.rev-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.QuizModule?.renderReviewQuestions(btn.dataset.filter);
      });
    });
  }

  /* --------------------------------------------------------------------------
     Keyboard Shortcuts
     -------------------------------------------------------------------------- */
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const quizView = document.getElementById('view-quiz');
      if (!quizView || !quizView.classList.contains('active')) return;

      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const key = e.key.toUpperCase();
      const keyMap = { '1': 0, 'A': 0, '2': 1, 'B': 1, '3': 2, 'C': 2, '4': 3, 'D': 3 };

      if (keyMap.hasOwnProperty(key)) {
        const optBtn = document.querySelector(`.option-item[data-opt-index="${keyMap[key]}"]`);
        if (optBtn) optBtn.click();
      } else if (e.key === 'ArrowRight') {
        window.QuizModule?.nextQuestion();
      } else if (e.key === 'ArrowLeft') {
        window.QuizModule?.prevQuestion();
      } else if (e.key === 'f' || e.key === 'F') {
        window.QuizModule?.toggleFlag();
      }
    });
  }

  return {
    init,
    switchView
  };
})();

// Bootstrap on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
