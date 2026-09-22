/**
 * Comprehensive Exam Quiz System - Test History Module
 * Handles persistence, retrieval, and rendering of test attempts.
 */

window.HistoryModule = (function () {
  const STORAGE_KEY = 'csbs_quiz_history_v1';

  function getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading history from localStorage:', e);
      return [];
    }
  }

  function saveHistory(historyList) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(historyList));
      updateHistoryBadge();
    } catch (e) {
      console.error('Error saving history to localStorage:', e);
    }
  }

  function addTestResult(result) {
    const history = getHistory();
    // Prepend new result
    history.unshift(result);
    saveHistory(history);
  }

  function getTestById(id) {
    const history = getHistory();
    return history.find(item => item.id === id) || null;
  }

  function deleteTest(id) {
    let history = getHistory();
    history = history.filter(item => item.id !== id);
    saveHistory(history);
    renderHistoryTable();
  }

  function clearAll() {
    if (confirm('Are you sure you want to delete all saved test history? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      updateHistoryBadge();
      renderHistoryTable();
    }
  }

  function updateHistoryBadge() {
    const badge = document.getElementById('nav-history-badge');
    if (!badge) return;
    const history = getHistory();
    if (history.length > 0) {
      badge.textContent = history.length;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  function renderHistoryTable() {
    const history = getHistory();
    const tbody = document.getElementById('history-table-body');
    const totalElem = document.getElementById('hist-total-tests');
    const avgElem = document.getElementById('hist-avg-score');
    const qCountElem = document.getElementById('hist-total-questions');
    const bestElem = document.getElementById('hist-best-score');

    if (!tbody) return;

    // Calculate Summary Stats
    const totalTests = history.length;
    let totalScore = 0;
    let totalQuestions = 0;
    let bestScore = 0;

    history.forEach(item => {
      totalScore += item.percentage;
      totalQuestions += item.total;
      if (item.percentage > bestScore) {
        bestScore = item.percentage;
      }
    });

    const avgScore = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;

    if (totalElem) totalElem.textContent = totalTests;
    if (avgElem) avgElem.textContent = `${avgScore}%`;
    if (qCountElem) qCountElem.textContent = totalQuestions;
    if (bestElem) bestElem.textContent = `${bestScore}%`;

    if (history.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
            No tests saved yet. Take a quiz from the <strong>New Quiz</strong> tab to see your results here!
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = history.map((test, idx) => {
      const dateStr = new Date(test.timestamp).toLocaleString([], {
        dateStyle: 'short',
        timeStyle: 'short'
      });

      const badgeColor = test.percentage >= 80 
        ? 'var(--success)' 
        : (test.percentage >= 50 ? 'var(--warning)' : 'var(--danger)');

      return `
        <tr data-test-id="${test.id}">
          <td style="font-weight: 700; color: var(--text-subtle);">${totalTests - idx}</td>
          <td>${dateStr}</td>
          <td><span class="badge badge-page">${test.pageRangeDesc}</span></td>
          <td><span class="badge badge-mode">${test.mode === 'practice' ? 'Practice' : 'Exam'}</span></td>
          <td style="font-weight: 700;">${test.score} / ${test.total}</td>
          <td>
            <span style="font-weight: 800; color: ${badgeColor};">
              ${test.percentage}%
            </span>
          </td>
          <td style="font-family: var(--font-mono); font-size: 0.88rem;">${test.durationFormatted}</td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button class="table-btn" onclick="HistoryModule.reviewPastTest('${test.id}')" title="Review questions and answers">
                Review
              </button>
              <button class="table-btn" onclick="HistoryModule.retakePastTest('${test.id}')" title="Retake this test with same settings">
                Retake
              </button>
              <button class="table-btn btn-delete" onclick="HistoryModule.deleteTest('${test.id}')" title="Delete attempt">
                ✕
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function reviewPastTest(id) {
    const test = getTestById(id);
    if (!test) return;
    if (window.QuizModule) {
      window.QuizModule.displaySavedResult(test);
    }
  }

  function retakePastTest(id) {
    const test = getTestById(id);
    if (!test) return;
    if (window.QuizModule) {
      window.QuizModule.retakeFromSaved(test);
    }
  }

  return {
    addTestResult,
    getHistory,
    getTestById,
    deleteTest,
    clearAll,
    updateHistoryBadge,
    renderHistoryTable,
    reviewPastTest,
    retakePastTest
  };
})();
