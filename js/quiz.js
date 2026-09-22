/**
 * Comprehensive Exam Quiz System - Quiz Engine Module
 * Manages active quiz sessions, question randomization, timer, scoring, and review.
 */

window.QuizModule = (function () {
  let session = {
    questions: [], // Active test question items
    currentIndex: 0,
    userAnswers: {}, // { qIndex: selectedOptionIndex }
    flagged: new Set(),
    practiceRevealed: new Set(),
    mode: 'exam', // 'exam' or 'practice'
    timerSeconds: 0,
    timerInterval: null,
    pageRangeDesc: '',
    config: null,
    isCompleted: false
  };

  // Helper: Fisher-Yates Shuffle
  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Format code blocks in question text
  function formatQuestionText(raw) {
    if (!raw) return "";
    
    // Check if question contains code snippet (e.g. #include, int main, braces, struct)
    const codePatterns = [
      /(#include[\s\S]*?(?:main\(\)|{)[\s\S]*)/i,
      /(void\s+main\(\)[\s\S]*)/i,
      /(int\s+main\(\)[\s\S]*)/i,
      /(struct\s+\w+[\s\S]*)/i
    ];

    for (const pattern of codePatterns) {
      const match = raw.match(pattern);
      if (match) {
        const preText = raw.substring(0, match.index).trim();
        const codeSnippet = match[0].trim();
        return `
          ${preText ? `<div>${escapeHtml(preText)}</div>` : ''}
          <pre class="code-block"><code>${escapeHtml(codeSnippet)}</code></pre>
        `;
      }
    }

    return `<div>${escapeHtml(raw)}</div>`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  let activeTimerInterval = null;

  function stopTimer() {
    if (activeTimerInterval) {
      clearInterval(activeTimerInterval);
      activeTimerInterval = null;
    }
  }

  /**
   * Start a new quiz session
   */
  function startQuiz(config) {
    stopTimer(); // Always stop any running timer first

    const allQuestions = window.COMPREHENSIVE_QUESTIONS || [];
    if (!allQuestions.length) {
      alert('Question database is not loaded yet. Please refresh the page.');
      return;
    }

    // Filter questions matching selected page ranges
    let matched = allQuestions.filter(q => {
      return config.ranges.some(r => q.page >= r.start && q.page <= r.end);
    });

    if (matched.length === 0) {
      alert('No questions found for the selected page range.');
      return;
    }

    // Shuffle questions if requested
    if (config.jumbleQuestions) {
      matched = shuffleArray(matched);
    }

    // Option shuffling (if enabled)
    let processedQuestions = matched.map(q => {
      if (!config.jumbleOptions) {
        return { ...q };
      }
      // Shuffle options while updating correctIndex
      const indexedOpts = q.options.map((opt, i) => ({ opt, isCorrect: i === q.correctIndex }));
      const shuffledOpts = shuffleArray(indexedOpts);
      const newCorrectIndex = shuffledOpts.findIndex(o => o.isCorrect);
      return {
        ...q,
        options: shuffledOpts.map(o => o.opt),
        correctIndex: newCorrectIndex,
        correctAnswer: shuffledOpts[newCorrectIndex].opt
      };
    });

    // Limit count if specified
    if (config.countLimit && config.countLimit !== 'all') {
      const limit = parseInt(config.countLimit, 10);
      if (!isNaN(limit) && limit > 0) {
        processedQuestions = processedQuestions.slice(0, limit);
      }
    }

    // Initialize session state
    session = {
      questions: processedQuestions,
      currentIndex: 0,
      userAnswers: {},
      flagged: new Set(),
      practiceRevealed: new Set(),
      mode: config.mode || 'exam',
      timerType: config.timerType || (config.countdownSeconds ? 'countdown' : 'stopwatch'),
      countdownSeconds: config.countdownSeconds || null,
      timerSeconds: 0,
      remainingSeconds: config.countdownSeconds || null,
      startTime: null,
      pageRangeDesc: config.pageRangeDesc || 'Selected Pages',
      config: config,
      isCompleted: false
    };

    // Update Top Badges
    const badgePages = document.getElementById('quiz-badge-pages');
    const badgeMode = document.getElementById('quiz-badge-mode');
    if (badgePages) badgePages.textContent = session.pageRangeDesc;
    if (badgeMode) {
      badgeMode.textContent = session.mode === 'practice' ? 'Practice Mode' : (session.config?.isSimulation ? 'Simulation' : 'Exam Mode');
      badgeMode.className = `badge ${session.mode === 'practice' ? 'badge-page' : 'badge-mode'}`;
    }

    // Start Timer
    startTimer();

    // Render palette
    renderPalette();

    // Render first question
    renderQuestion(0);

    // Switch view to quiz
    if (window.App) {
      window.App.switchView('quiz');
    }
  }

  function startTimer() {
    stopTimer();
    const timerText = document.getElementById('timer-text');
    const timerBox = document.getElementById('quiz-timer-display');
    session.startTime = Date.now();

    if (session.timerType === 'countdown') {
      const initialRemaining = session.countdownSeconds || 7200;
      session.remainingSeconds = initialRemaining;
      session.timerSeconds = 0;
      if (timerText) timerText.textContent = formatTime(initialRemaining);
      if (timerBox) {
        timerBox.style.color = '';
        timerBox.title = 'Time Remaining';
      }

      activeTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
        session.timerSeconds = elapsed;
        const remaining = Math.max(0, initialRemaining - elapsed);
        session.remainingSeconds = remaining;

        if (timerText) {
          timerText.textContent = formatTime(remaining);
        }

        if (remaining <= 300 && timerBox) {
          timerBox.style.color = 'var(--danger)';
        }

        if (remaining <= 0) {
          stopTimer();
          alert('Time is up! Your 2-hour simulated exam is being submitted.');
          submitQuiz();
        }
      }, 1000);
    } else if (session.timerType === 'none') {
      if (timerText) timerText.textContent = 'Untimed';
    } else {
      // Standard count-up stopwatch based on Date.now()
      session.timerSeconds = 0;
      if (timerText) timerText.textContent = '00:00';
      if (timerBox) {
        timerBox.style.color = '';
        timerBox.title = 'Elapsed Time';
      }

      activeTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
        session.timerSeconds = elapsed;
        if (timerText) {
          timerText.textContent = formatTime(elapsed);
        }
      }, 1000);
    }
  }

  /**
   * Render question at index
   */
  function renderQuestion(index) {
    if (index < 0 || index >= session.questions.length) return;
    session.currentIndex = index;

    const q = session.questions[index];
    const total = session.questions.length;

    // Badges & Labels
    const numBadge = document.getElementById('q-number-badge');
    const qPageBadge = document.getElementById('quiz-badge-qpage');
    const statementElem = document.getElementById('q-statement');
    const progressLabel = document.getElementById('quiz-progress-label');
    const progressPercent = document.getElementById('quiz-progress-percent');
    const progressBar = document.getElementById('quiz-progress-bar');
    const flagBtn = document.getElementById('btn-flag-question');
    const flagBtnText = document.getElementById('flag-btn-text');

    if (numBadge) numBadge.textContent = `Question ${index + 1} of ${total}`;
    if (qPageBadge) qPageBadge.textContent = `PDF Page: ${q.page}`;
    if (statementElem) statementElem.innerHTML = formatQuestionText(q.question);

    // Progress updates
    const answeredCount = Object.keys(session.userAnswers).length;
    const pctVal = Math.round(((index + 1) / total) * 100);
    if (progressLabel) progressLabel.textContent = `Question ${index + 1} of ${total} (${answeredCount} answered)`;
    if (progressPercent) progressPercent.textContent = `${pctVal}% Complete`;
    if (progressBar) progressBar.style.width = `${pctVal}%`;

    // Flag status
    const isFlagged = session.flagged.has(index);
    if (flagBtn) {
      flagBtn.className = `btn-flag ${isFlagged ? 'flagged' : ''}`;
      if (flagBtnText) flagBtnText.textContent = isFlagged ? 'Flagged' : 'Flag for Review';
    }

    // Image / Diagram display
    const imgWrap = document.getElementById('q-image-container');
    const imgElem = document.getElementById('q-image');
    if (q.image) {
      imgElem.src = q.image;
      imgWrap.style.display = 'block';
    } else {
      imgWrap.style.display = 'none';
    }

    // Options rendering
    renderOptions(q, index);

    // Prev / Next button state
    const prevBtn = document.getElementById('btn-prev-question');
    const nextBtn = document.getElementById('btn-next-question');
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) {
      if (index === total - 1) {
        nextBtn.innerHTML = `Finish Test <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      } else {
        nextBtn.innerHTML = `Next <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
      }
    }

    // Update Palette Active State
    updatePaletteState();
  }

  function renderOptions(q, qIdx) {
    const container = document.getElementById('q-options-container');
    const feedbackBox = document.getElementById('practice-feedback-box');
    if (!container) return;

    container.innerHTML = '';
    if (feedbackBox) {
      feedbackBox.className = 'practice-feedback';
      feedbackBox.style.display = 'none';
      feedbackBox.innerHTML = '';
    }

    const selectedOptIdx = session.userAnswers[qIdx];
    const isPracticeRevealed = session.mode === 'practice' && session.practiceRevealed.has(qIdx);

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    q.options.forEach((optText, optIdx) => {
      const optItem = document.createElement('div');
      optItem.className = 'option-item';
      optItem.dataset.optIndex = optIdx;

      let extraClass = '';
      if (selectedOptIdx === optIdx) {
        extraClass += ' selected';
      }

      if (isPracticeRevealed) {
        if (optIdx === q.correctIndex) {
          extraClass += ' correct';
        } else if (selectedOptIdx === optIdx) {
          extraClass += ' incorrect';
        }
      }

      optItem.className += extraClass;

      optItem.innerHTML = `
        <span class="option-indicator">${letters[optIdx] || optIdx + 1}</span>
        <span class="option-text">${escapeHtml(optText)}</span>
      `;

      optItem.addEventListener('click', () => {
        selectOption(qIdx, optIdx);
      });

      container.appendChild(optItem);
    });

    // Practice Mode feedback banner
    if (isPracticeRevealed && feedbackBox) {
      const isCorrect = selectedOptIdx === q.correctIndex;
      if (isCorrect) {
        feedbackBox.className = 'practice-feedback show-correct';
        feedbackBox.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <span>Correct! Option ${letters[q.correctIndex]}: "${escapeHtml(q.correctAnswer)}"</span>
        `;
      } else {
        feedbackBox.className = 'practice-feedback show-incorrect';
        feedbackBox.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            <span>Incorrect!</span>
          </div>
          <div style="font-weight: 500; font-size: 0.9rem; color: var(--text-main);">
            Correct Answer: <strong>Option ${letters[q.correctIndex]}: ${escapeHtml(q.correctAnswer)}</strong>
          </div>
        `;
      }
      feedbackBox.style.display = 'flex';
    }
  }

  function selectOption(qIdx, optIdx) {
    session.userAnswers[qIdx] = optIdx;

    if (session.mode === 'practice') {
      session.practiceRevealed.add(qIdx);
    }

    renderOptions(session.questions[qIdx], qIdx);
    updatePaletteState();
  }

  function clearAnswer() {
    delete session.userAnswers[session.currentIndex];
    session.practiceRevealed.delete(session.currentIndex);
    renderOptions(session.questions[session.currentIndex], session.currentIndex);
    updatePaletteState();
  }

  function toggleFlag() {
    const idx = session.currentIndex;
    if (session.flagged.has(idx)) {
      session.flagged.delete(idx);
    } else {
      session.flagged.add(idx);
    }
    const flagBtn = document.getElementById('btn-flag-question');
    const flagBtnText = document.getElementById('flag-btn-text');
    const isFlagged = session.flagged.has(idx);
    if (flagBtn) {
      flagBtn.className = `btn-flag ${isFlagged ? 'flagged' : ''}`;
      if (flagBtnText) flagBtnText.textContent = isFlagged ? 'Flagged' : 'Flag for Review';
    }
    updatePaletteState();
  }

  function nextQuestion() {
    if (session.currentIndex < session.questions.length - 1) {
      renderQuestion(session.currentIndex + 1);
    } else {
      showSubmitModal();
    }
  }

  function prevQuestion() {
    if (session.currentIndex > 0) {
      renderQuestion(session.currentIndex - 1);
    }
  }

  function jumpToQuestion(index) {
    renderQuestion(index);
  }

  function renderPalette() {
    const grid = document.getElementById('palette-grid-items');
    if (!grid) return;
    grid.innerHTML = '';

    session.questions.forEach((_, i) => {
      const item = document.createElement('button');
      item.className = 'pal-item';
      item.id = `pal-btn-${i}`;
      item.textContent = i + 1;
      item.addEventListener('click', () => jumpToQuestion(i));
      grid.appendChild(item);
    });

    updatePaletteState();
  }

  function updatePaletteState() {
    const total = session.questions.length;
    let answeredCount = 0;
    let flaggedCount = session.flagged.size;

    session.questions.forEach((_, i) => {
      const btn = document.getElementById(`pal-btn-${i}`);
      if (!btn) return;

      let cls = 'pal-item';
      if (i === session.currentIndex) {
        cls += ' current';
      }
      if (session.userAnswers.hasOwnProperty(i)) {
        cls += ' answered';
        answeredCount++;
      }
      if (session.flagged.has(i)) {
        cls += ' flagged';
      }
      btn.className = cls;
    });

    const summaryElem = document.getElementById('palette-stats-summary');
    if (summaryElem) {
      summaryElem.textContent = `${answeredCount} / ${total} Answered • ${flaggedCount} Flagged`;
    }
  }

  function showSubmitModal() {
    const answered = Object.keys(session.userAnswers).length;
    const total = session.questions.length;
    const modalSummary = document.getElementById('submit-modal-summary');
    const modal = document.getElementById('submit-confirm-modal');

    if (modalSummary) {
      modalSummary.textContent = `You have answered ${answered} of ${total} questions. Are you sure you want to finish and view your scorecard?`;
    }
    if (modal) {
      modal.classList.add('active');
    }
  }

  function hideSubmitModal() {
    const modal = document.getElementById('submit-confirm-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  /**
   * Finalize and compute test result
   */
  function submitQuiz() {
    hideSubmitModal();
    stopTimer();
    session.isCompleted = true;

    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

    const detailedItems = session.questions.map((q, i) => {
      const userAnsIdx = session.userAnswers.hasOwnProperty(i) ? session.userAnswers[i] : null;
      const isCorrect = userAnsIdx === q.correctIndex;
      const isSkipped = userAnsIdx === null;

      if (isCorrect) correctCount++;
      else if (isSkipped) skippedCount++;
      else incorrectCount++;

      return {
        questionId: q.id,
        page: q.page,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        correctAnswer: q.correctAnswer,
        userIndex: userAnsIdx,
        userAnswer: userAnsIdx !== null ? q.options[userAnsIdx] : null,
        isCorrect: isCorrect,
        isSkipped: isSkipped,
        isFlagged: session.flagged.has(i),
        image: q.image
      };
    });

    const total = session.questions.length;
    const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    const resultRecord = {
      id: 'test_' + Date.now(),
      timestamp: Date.now(),
      pageRangeDesc: session.pageRangeDesc,
      mode: session.mode,
      total: total,
      score: correctCount,
      incorrectCount: incorrectCount,
      skippedCount: skippedCount,
      percentage: percentage,
      durationSeconds: session.timerSeconds,
      durationFormatted: formatTime(session.timerSeconds),
      items: detailedItems,
      config: session.config
    };

    // Save to history
    if (window.HistoryModule) {
      window.HistoryModule.addTestResult(resultRecord);
    }

    // Display results scorecard
    displayResult(resultRecord);
  }

  /**
   * Render Results Screen
   */
  function displayResult(result) {
    const headline = document.getElementById('results-headline');
    const subhead = document.getElementById('results-subheadline');
    const scoreCircle = document.getElementById('score-circle-elem');
    const scorePctText = document.getElementById('score-pct-text');
    const gradeBadge = document.getElementById('score-grade-badge');

    const statCorrect = document.getElementById('stat-correct-count');
    const statIncorrect = document.getElementById('stat-incorrect-count');
    const statSkipped = document.getElementById('stat-skipped-count');
    const statTime = document.getElementById('stat-time-taken');
    const missedCountBtn = document.getElementById('retake-missed-count');

    if (headline) headline.textContent = `Scorecard: ${result.score} / ${result.total}`;
    if (subhead) subhead.textContent = `${result.pageRangeDesc} • ${result.mode === 'practice' ? 'Practice Mode' : 'Exam Mode'}`;

    if (scoreCircle) scoreCircle.style.setProperty('--percent', result.percentage);
    if (scorePctText) scorePctText.textContent = `${result.percentage}%`;

    let grade = 'Needs Practice';
    if (result.percentage >= 90) grade = 'Mastered 🏆';
    else if (result.percentage >= 75) grade = 'Proficient ⭐';
    else if (result.percentage >= 50) grade = 'Passing Score 👍';
    if (gradeBadge) gradeBadge.textContent = grade;

    if (statCorrect) statCorrect.textContent = result.score;
    if (statIncorrect) statIncorrect.textContent = result.incorrectCount;
    if (statSkipped) statSkipped.textContent = result.skippedCount;
    if (statTime) statTime.textContent = result.durationFormatted;

    const missedTotal = result.incorrectCount + result.skippedCount;
    if (missedCountBtn) missedCountBtn.textContent = missedTotal;

    const retakeMissedBtn = document.getElementById('btn-retake-missed');
    if (retakeMissedBtn) {
      retakeMissedBtn.disabled = missedTotal === 0;
    }

    // Render detailed review list
    currentDisplayedResult = result;
    renderReviewQuestions('all');

    // Switch view
    if (window.App) {
      window.App.switchView('results');
    }
  }

  let currentDisplayedResult = null;

  function renderReviewQuestions(filter) {
    if (!currentDisplayedResult) return;
    const container = document.getElementById('review-questions-container');
    if (!container) return;

    let items = currentDisplayedResult.items;

    // Update counts on filter tabs
    const allCount = items.length;
    const wrongCount = items.filter(i => !i.isCorrect && !i.isSkipped).length;
    const rightCount = items.filter(i => i.isCorrect).length;
    const flaggedCount = items.filter(i => i.isFlagged).length;

    const elAll = document.getElementById('rev-filter-all-count');
    const elWrong = document.getElementById('rev-filter-wrong-count');
    const elRight = document.getElementById('rev-filter-right-count');
    const elFlag = document.getElementById('rev-filter-flagged-count');

    if (elAll) elAll.textContent = allCount;
    if (elWrong) elWrong.textContent = wrongCount;
    if (elRight) elRight.textContent = rightCount;
    if (elFlag) elFlag.textContent = flaggedCount;

    if (filter === 'incorrect') {
      items = items.filter(i => !i.isCorrect);
    } else if (filter === 'correct') {
      items = items.filter(i => i.isCorrect);
    } else if (filter === 'flagged') {
      items = items.filter(i => i.isFlagged);
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No questions match the "${filter}" filter.</p>
        </div>
      `;
      return;
    }

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    container.innerHTML = items.map((it, idx) => {
      let statusBadge = '';
      let statusClass = '';

      if (it.isCorrect) {
        statusClass = 'is-correct';
        statusBadge = `<span class="badge" style="background: var(--success-bg); color: var(--success); font-weight:700;">✓ Correct</span>`;
      } else if (it.isSkipped) {
        statusClass = 'is-skipped';
        statusBadge = `<span class="badge" style="background: var(--warning-bg); color: var(--warning); font-weight:700;">— Unanswered</span>`;
      } else {
        statusClass = 'is-incorrect';
        statusBadge = `<span class="badge" style="background: var(--danger-bg); color: var(--danger); font-weight:700;">✕ Incorrect</span>`;
      }

      const imgHtml = it.image ? `<div class="question-image-wrap"><img src="${it.image}" class="question-image" alt="Question Diagram"></div>` : '';

      return `
        <div class="review-item ${statusClass}">
          <div class="review-item-header">
            <div>
              <strong>#${idx + 1}</strong> • <span class="badge badge-page">PDF Page: ${it.page}</span>
              ${it.isFlagged ? '<span class="badge" style="background:var(--warning-bg); color:var(--warning);">★ Flagged</span>' : ''}
            </div>
            <div>${statusBadge}</div>
          </div>

          <div class="question-text" style="font-size: 1.05rem; margin-bottom: 0.85rem;">
            ${formatQuestionText(it.question)}
          </div>

          ${imgHtml}

          <div style="display: flex; flex-direction: column; gap: 0.45rem; margin-top: 0.85rem;">
            ${it.options.map((opt, oIdx) => {
              let optStyle = 'padding: 0.6rem 1rem; border-radius: var(--radius-sm); font-size: 0.92rem; display: flex; align-items: center; gap: 0.75rem; border: 1px solid var(--border-color);';
              let optLetterCls = 'option-indicator';

              if (oIdx === it.correctIndex) {
                optStyle += ' background: var(--success-bg); border-color: var(--success); color: var(--success); font-weight: 600;';
              } else if (oIdx === it.userIndex && !it.isCorrect) {
                optStyle += ' background: var(--danger-bg); border-color: var(--danger); color: var(--danger); font-weight: 600;';
              } else {
                optStyle += ' background: var(--bg-surface); opacity: 0.85;';
              }

              let marker = '';
              if (oIdx === it.correctIndex) marker = ' (Correct Answer)';
              if (oIdx === it.userIndex && !it.isCorrect) marker = ' (Your Answer)';
              if (oIdx === it.userIndex && it.isCorrect) marker = ' (Your Answer ✓)';

              return `
                <div style="${optStyle}">
                  <span style="font-weight: 700; width: 20px;">${letters[oIdx] || oIdx + 1}.</span>
                  <span style="flex: 1;">${escapeHtml(opt)}${marker}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  function retakeEntire() {
    if (session.config) {
      startQuiz(session.config);
    }
  }

  function retakeMissed() {
    if (!currentDisplayedResult) return;
    const missed = currentDisplayedResult.items.filter(i => !i.isCorrect);
    if (missed.length === 0) return;

    // Convert missed items to questions
    const missedQuestions = missed.map(m => {
      return {
        id: m.questionId,
        page: m.page,
        question: m.question,
        options: m.options,
        correctIndex: m.correctIndex,
        correctAnswer: m.correctAnswer,
        image: m.image
      };
    });

    session = {
      questions: missedQuestions,
      currentIndex: 0,
      userAnswers: {},
      flagged: new Set(),
      practiceRevealed: new Set(),
      mode: session.mode,
      timerSeconds: 0,
      timerInterval: null,
      pageRangeDesc: `Retake Missed (${session.pageRangeDesc})`,
      config: session.config,
      isCompleted: false
    };

    const badgePages = document.getElementById('quiz-badge-pages');
    if (badgePages) badgePages.textContent = session.pageRangeDesc;

    startTimer();
    renderPalette();
    renderQuestion(0);

    if (window.App) {
      window.App.switchView('quiz');
    }
  }

  function displaySavedResult(savedTest) {
    currentDisplayedResult = savedTest;
    displayResult(savedTest);
  }

  function retakeFromSaved(savedTest) {
    if (savedTest.config) {
      startQuiz(savedTest.config);
    } else {
      // Fallback recreate config from items
      const pages = savedTest.items.map(i => i.page);
      startQuiz({
        ranges: [{ start: Math.min(...pages), end: Math.max(...pages) }],
        jumbleQuestions: true,
        jumbleOptions: false,
        countLimit: savedTest.total,
        mode: savedTest.mode,
        pageRangeDesc: savedTest.pageRangeDesc
      });
    }
  }

  return {
    startQuiz,
    renderQuestion,
    selectOption,
    clearAnswer,
    toggleFlag,
    nextQuestion,
    prevQuestion,
    jumpToQuestion,
    showSubmitModal,
    hideSubmitModal,
    submitQuiz,
    renderReviewQuestions,
    retakeEntire,
    retakeMissed,
    displaySavedResult,
    retakeFromSaved
  };
})();
