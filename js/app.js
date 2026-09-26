/**
 * Comprehensive Exam Quiz System - Main Application Orchestrator
 * Connects UI views, theme switching, page chunk multi-select, and keyboard controls.
 */

window.App = (function () {
  // State for question selection mode ('topic' or 'page')
  let selectionType = 'topic';
  const selectedTopics = new Set();

  // State for page chunk selection
  const selectedChunks = new Set([0]); // Default: first chunk (1-50)
  let customRange = null; // null or { start: 1, end: 50 }
  let selectedMode = 'exam';
  let selectedCountLimit = 'all';
  let selectedTimer = 'stopwatch';

  const TOPICS = [
    { id: 'Management & Business Systems', label: 'Management & Business', short: 'MGMT' },
    { id: 'Programming & OOP', label: 'Programming & OOP (C/C++)', short: 'OOP' },
    { id: 'Data Structures & Algorithms', label: 'Data Structures & Algorithms', short: 'DSA' },
    { id: 'Theory of Computation', label: 'Theory of Computation (TOC)', short: 'TOC' },
    { id: 'Computer Networks', label: 'Computer Networks (CN)', short: 'CN' },
    { id: 'Cyber Security & Privacy', label: 'Cyber Security & Privacy', short: 'SEC' },
    { id: 'Database Management Systems', label: 'Database Systems (DBMS)', short: 'DBMS' },
    { id: 'Operating Systems', label: 'Operating Systems (OS)', short: 'OS' },
    { id: 'Computer Architecture & Digital Logic', label: 'Computer Architecture', short: 'ARCH' },
    { id: 'Software Engineering & Testing', label: 'Software Engineering & Testing', short: 'SE' }
  ];

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

  function encodeId(str) {
    return String(str).replace(/[^a-zA-Z0-9]/g, '_');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  const OFFLINE_DB_KEY = 'faceit_offline_db_v1';

  async function ensureQuestionsLoaded() {
    // 1. Check if window.COMPREHENSIVE_QUESTIONS exists from data/questions.js
    if (window.COMPREHENSIVE_QUESTIONS && window.COMPREHENSIVE_QUESTIONS.length > 0) {
      try {
        localStorage.setItem(OFFLINE_DB_KEY, JSON.stringify(window.COMPREHENSIVE_QUESTIONS));
      } catch (e) {}
      return true;
    }

    // 2. Fallback to localStorage offline database backup
    try {
      const cachedDb = localStorage.getItem(OFFLINE_DB_KEY);
      if (cachedDb) {
        window.COMPREHENSIVE_QUESTIONS = JSON.parse(cachedDb);
        console.log(`[OfflineDB] Successfully loaded ${window.COMPREHENSIVE_QUESTIONS.length} questions from offline storage.`);
        return true;
      }
    } catch (e) {
      console.error('Error reading offline question database from localStorage:', e);
    }

    console.error('Question bank not loaded. Ensure data/questions.js is present.');
    return false;
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          console.log('[ServiceWorker] Active & caching for 100% offline access:', reg.scope);
        }).catch((err) => {
          console.warn('[ServiceWorker] Registration failed:', err);
        });
      });
    }
  }

  async function init() {
    registerServiceWorker();
    initTheme();
    setupNavigation();
    setupSettingsControls();
    setupQuizControls();
    setupKeyboardShortcuts();

    // Ensure questions are ready
    await ensureQuestionsLoaded();

    // Default: select all topics
    TOPICS.forEach(t => selectedTopics.add(t.id));

    renderTopicGrid();
    renderChunkGrid();

    // Initialize sub-modules
    if (window.HistoryModule) {
      window.HistoryModule.updateHistoryBadge();
    }
    if (window.BankModule) {
      window.BankModule.init();
    }
    if (window.ReportModule) {
      window.ReportModule.init();
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
      icon.textContent = theme === 'dark' ? 'D' : 'L';
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
     Topic Wise Selection UI
     -------------------------------------------------------------------------- */
  function setSelectionType(type) {
    selectionType = type;

    const tabTopic = document.getElementById('tab-select-topic');
    const tabPage = document.getElementById('tab-select-page');
    const panelTopic = document.getElementById('panel-select-topic');
    const panelPage = document.getElementById('panel-select-page');

    if (type === 'topic') {
      tabTopic?.classList.add('active');
      tabPage?.classList.remove('active');
      if (panelTopic) panelTopic.style.display = 'block';
      if (panelPage) panelPage.style.display = 'none';
    } else {
      tabPage?.classList.add('active');
      tabTopic?.classList.remove('active');
      if (panelPage) panelPage.style.display = 'block';
      if (panelTopic) panelTopic.style.display = 'none';
    }

    updateSelectionSummary();
  }

  function renderTopicGrid() {
    const container = document.getElementById('topic-grid-container');
    if (!container) return;

    const all = window.COMPREHENSIVE_QUESTIONS || [];
    const counts = {};
    all.forEach(q => {
      const t = q.topic || 'Other';
      counts[t] = (counts[t] || 0) + 1;
    });

    container.innerHTML = TOPICS.map(topic => {
      const count = counts[topic.id] || 0;
      const isSelected = selectedTopics.has(topic.id);

      return `
        <button type="button" class="topic-card ${isSelected ? 'selected' : ''}" data-topic-id="${escapeHtml(topic.id)}" id="topic-card-${encodeId(topic.id)}">
          <div class="topic-info">
            <span class="topic-name">${escapeHtml(topic.label)}</span>
            <span class="topic-count">${count} Questions</span>
          </div>
          <span class="topic-check-icon">${isSelected ? '✓' : ''}</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll('.topic-card').forEach(card => {
      card.addEventListener('click', () => {
        const topicId = card.dataset.topicId;
        toggleTopic(topicId);
      });
    });
  }

  function toggleTopic(topicId) {
    if (selectedTopics.has(topicId)) {
      selectedTopics.delete(topicId);
    } else {
      selectedTopics.add(topicId);
    }

    updateTopicPresetChips();
    updateTopicUI();
    updateSelectionSummary();
  }

  function updateTopicUI() {
    TOPICS.forEach(topic => {
      const card = document.getElementById(`topic-card-${encodeId(topic.id)}`);
      if (!card) return;
      const check = card.querySelector('.topic-check-icon');
      if (selectedTopics.has(topic.id)) {
        card.classList.add('selected');
        if (check) check.textContent = '✓';
      } else {
        card.classList.remove('selected');
        if (check) check.textContent = '';
      }
    });
  }

  function updateTopicPresetChips() {
    const chips = document.querySelectorAll('#topic-preset-bar .preset-chip');
    chips.forEach(c => c.classList.remove('active'));

    if (selectedTopics.size === TOPICS.length) {
      document.querySelector('#topic-preset-bar .preset-chip[data-topic-preset="all"]')?.classList.add('active');
    }
  }

  function applyTopicPreset(preset) {
    selectedTopics.clear();
    document.querySelectorAll('#topic-preset-bar .preset-chip').forEach(c => c.classList.remove('active'));
    document.querySelector(`#topic-preset-bar .preset-chip[data-topic-preset="${preset}"]`)?.classList.add('active');

    if (preset === 'all') {
      TOPICS.forEach(t => selectedTopics.add(t.id));
    } else if (preset === 'core-cs') {
      ['Data Structures & Algorithms', 'Operating Systems', 'Computer Networks', 'Database Management Systems', 'Theory of Computation'].forEach(t => selectedTopics.add(t));
    } else if (preset === 'systems') {
      ['Operating Systems', 'Computer Networks', 'Computer Architecture & Digital Logic'].forEach(t => selectedTopics.add(t));
    } else if (preset === 'mgmt') {
      ['Management & Business Systems'].forEach(t => selectedTopics.add(t));
    } else if (preset === 'coding') {
      ['Programming & OOP', 'Software Engineering & Testing'].forEach(t => selectedTopics.add(t));
    }

    updateTopicUI();
    updateSelectionSummary();
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
    // Mode tabs: Select by Topic vs Select by Page Range
    document.getElementById('tab-select-topic')?.addEventListener('click', () => setSelectionType('topic'));
    document.getElementById('tab-select-page')?.addEventListener('click', () => setSelectionType('page'));

    // Topic Presets
    document.querySelectorAll('#topic-preset-bar .preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const preset = chip.dataset.topicPreset;
        applyTopicPreset(preset);
      });
    });

    // Page Range Presets
    document.querySelectorAll('#panel-select-page .preset-chip').forEach(chip => {
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

    // Timer pills
    document.querySelectorAll('#timer-pills .pill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#timer-pills .pill-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedTimer = btn.dataset.timer;
      });
    });

    // Start Simulation Button
    document.getElementById('btn-start-simulation')?.addEventListener('click', startSimulation);

    // Start Quiz Button
    document.getElementById('btn-start-quiz')?.addEventListener('click', handleStartQuiz);
  }

  function startSimulation() {
    const all = window.COMPREHENSIVE_QUESTIONS || [];
    if (!all.length) {
      alert('Question database is loading, please try again in a moment.');
      return;
    }

    const config = {
      selectionType: 'page',
      ranges: [{ start: 1, end: 400 }],
      pageRangeDesc: 'Exam Simulation (100 Questions • 2h)',
      jumbleQuestions: true,
      jumbleOptions: false,
      countLimit: 100,
      mode: 'exam',
      timerType: 'countdown',
      countdownSeconds: 7200, // 2 Hours = 7200 seconds
      isSimulation: true
    };

    if (window.QuizModule) {
      setQuizActive(true);  // arm the exit guard
      window.QuizModule.startQuiz(config);
    }
  }

  function applyPreset(preset) {
    customRange = null;
    const msg = document.getElementById('range-validation-msg');
    if (msg) msg.style.display = 'none';

    selectedChunks.clear();

    document.querySelectorAll('#panel-select-page .preset-chip').forEach(c => c.classList.remove('active'));
    document.querySelector(`#panel-select-page .preset-chip[data-preset="${preset}"]`)?.classList.add('active');

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

    document.querySelectorAll('#panel-select-page .preset-chip').forEach(c => c.classList.remove('active'));
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
    const countSummary = document.getElementById('selection-summary-count');
    const pagesSummary = document.getElementById('selection-summary-pages');
    const startBtn = document.getElementById('btn-start-quiz');

    let matchingQuestions = [];
    let scopeDesc = '';

    if (selectionType === 'topic') {
      if (selectedTopics.size === 0) {
        scopeDesc = 'No topics selected';
        matchingQuestions = [];
      } else {
        const topicSet = selectedTopics;
        matchingQuestions = all.filter(q => topicSet.has(q.topic));
        if (selectedTopics.size === TOPICS.length) {
          scopeDesc = 'All Topics (10 Selected)';
        } else if (selectedTopics.size === 1) {
          const single = Array.from(selectedTopics)[0];
          scopeDesc = `Topic: ${single}`;
        } else {
          scopeDesc = `${selectedTopics.size} Topics Selected`;
        }
      }
    } else {
      const ranges = getActiveRanges();
      matchingQuestions = all.filter(q => {
        return ranges.some(r => q.page >= r.start && q.page <= r.end);
      });
      scopeDesc = `${getPageRangeDescription()} selected`;
    }

    const totalAvailable = matchingQuestions.length;
    if (pagesSummary) pagesSummary.textContent = scopeDesc;

    if (totalAvailable === 0) {
      if (countSummary) {
        countSummary.textContent = selectionType === 'topic' 
          ? '0 questions available (select at least one topic)' 
          : '0 questions available (select at least one page)';
      }
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
      const scopeLabel = selectionType === 'topic' ? 'in selected topics' : 'in range';
      countSummary.innerHTML = `<strong>${willTake}</strong> test questions (${totalAvailable} ${scopeLabel})`;
    }
    if (startBtn) startBtn.disabled = false;
  }

  /* --------------------------------------------------------------------------
     Exit Guard — prevent accidental tab/window close during an active quiz
     -------------------------------------------------------------------------- */
  let _quizActive = false;

  function setQuizActive(active) {
    _quizActive = active;
  }

  window.addEventListener('beforeunload', (e) => {
    if (_quizActive) {
      e.preventDefault();
      // Most browsers show their own generic message; the returnValue is required
      // for older browsers but ignored visually in modern ones.
      e.returnValue = 'Your quiz is in progress. Are you sure you want to leave?';
    }
  });

  function handleStartQuiz() {
    const jumbleQ = document.getElementById('toggle-jumble-questions')?.checked ?? true;
    const jumbleO = document.getElementById('toggle-jumble-options')?.checked ?? false;

    let timerType = 'stopwatch';
    let countdownSecs = null;
    if (selectedTimer === '7200') {
      timerType = 'countdown';
      countdownSecs = 7200;
    } else if (selectedTimer === '3600') {
      timerType = 'countdown';
      countdownSecs = 3600;
    } else if (selectedTimer === 'none') {
      timerType = 'none';
    }

    let config = null;

    if (selectionType === 'topic') {
      if (selectedTopics.size === 0) {
        alert('Please select at least one topic to start the quiz.');
        return;
      }

      let desc = '';
      if (selectedTopics.size === TOPICS.length) {
        desc = 'All Topics';
      } else if (selectedTopics.size === 1) {
        desc = Array.from(selectedTopics)[0];
      } else {
        desc = `${selectedTopics.size} Topics (${Array.from(selectedTopics).map(t => {
          const found = TOPICS.find(tp => tp.id === t);
          return found ? found.short : t.slice(0, 4);
        }).join(', ')})`;
      }

      config = {
        selectionType: 'topic',
        topics: Array.from(selectedTopics),
        pageRangeDesc: desc,
        jumbleQuestions: jumbleQ,
        jumbleOptions: jumbleO,
        countLimit: selectedCountLimit,
        mode: selectedMode,
        timerType: timerType,
        countdownSeconds: countdownSecs
      };
    } else {
      const ranges = getActiveRanges();
      if (ranges.length === 0) {
        alert('Please select at least one page chunk or a custom page range.');
        return;
      }

      config = {
        selectionType: 'page',
        ranges: ranges,
        pageRangeDesc: getPageRangeDescription(),
        jumbleQuestions: jumbleQ,
        jumbleOptions: jumbleO,
        countLimit: selectedCountLimit,
        mode: selectedMode,
        timerType: timerType,
        countdownSeconds: countdownSecs
      };
    }

    if (window.QuizModule) {
      setQuizActive(true);  // arm the exit guard
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

    document.getElementById('btn-report-question')?.addEventListener('click', () => {
      window.QuizModule?.reportCurrentQuestion();
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
    switchView,
    startSimulation,
    setQuizActive   // called by QuizModule when quiz ends/is submitted
  };
})();

// Bootstrap on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
