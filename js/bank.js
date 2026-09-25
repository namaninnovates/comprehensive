/**
 * Comprehensive Exam Quiz System - Question Bank Module
 * Browse and search all 1,455 questions by keyword and page ranges.
 */

window.BankModule = (function () {
  let filteredQuestions = [];
  let currentPage = 1;
  const pageSize = 20;

  function init() {
    const searchInput = document.getElementById('bank-search-input');
    const pageFilterSelect = document.getElementById('bank-page-filter');
    const topicFilterSelect = document.getElementById('bank-topic-filter');

    if (searchInput) {
      searchInput.addEventListener('input', debounce(applyFilter, 250));
    }
    if (pageFilterSelect) {
      pageFilterSelect.addEventListener('change', applyFilter);
    }
    if (topicFilterSelect) {
      topicFilterSelect.addEventListener('change', applyFilter);
    }

    applyFilter();
  }

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function applyFilter() {
    const all = window.COMPREHENSIVE_QUESTIONS || [];
    const searchVal = (document.getElementById('bank-search-input')?.value || '').trim().toLowerCase();
    const rangeVal = document.getElementById('bank-page-filter')?.value || 'all';
    const topicVal = document.getElementById('bank-topic-filter')?.value || 'all';

    let rangeStart = 1;
    let rangeEnd = 400;

    if (rangeVal !== 'all') {
      const parts = rangeVal.split('-');
      rangeStart = parseInt(parts[0], 10);
      rangeEnd = parseInt(parts[1], 10);
    }

    filteredQuestions = all.filter(q => {
      if (q.page < rangeStart || q.page > rangeEnd) return false;
      if (topicVal !== 'all' && q.topic !== topicVal) return false;
      if (!searchVal) return true;

      const inQ = q.question.toLowerCase().includes(searchVal);
      const inOpts = q.options.some(o => o.toLowerCase().includes(searchVal));
      return inQ || inOpts;
    });

    currentPage = 1;
    render();
  }

  function render() {
    const container = document.getElementById('bank-list-container');
    const countIndicator = document.getElementById('bank-count-indicator');
    if (!container) return;

    if (countIndicator) {
      countIndicator.textContent = `Showing ${filteredQuestions.length.toLocaleString()} question${filteredQuestions.length === 1 ? '' : 's'}`;
    }

    if (filteredQuestions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No questions matched your search criteria.</p>
        </div>
      `;
      return;
    }

    // Pagination slice
    const totalPages = Math.ceil(filteredQuestions.length / pageSize);
    const startIdx = (currentPage - 1) * pageSize;
    const items = filteredQuestions.slice(startIdx, startIdx + pageSize);

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    const itemsHtml = items.map((q, idx) => {
      const globalIdx = startIdx + idx + 1;
      const imgHtml = q.image ? `<div class="question-image-wrap"><img src="${q.image}" class="question-image" alt="Diagram"></div>` : '';

      return `
        <div class="card" style="padding: 1.5rem; margin-bottom: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
              #${globalIdx} (ID: ${q.id}) • <span class="badge badge-page">PDF Page: ${q.page}</span>
              ${q.topic ? `<span class="badge badge-topic" style="cursor: pointer;" title="Click to filter by this topic" onclick="BankModule.filterByTopic('${escapeHtml(q.topic)}')">${escapeHtml(q.topic)}</span>` : ''}
            </div>
            <span class="badge" style="background: var(--success-bg); color: var(--success); font-weight: 700;">
              Answer: Option ${letters[q.correctIndex] || q.correctIndex + 1}
            </span>
          </div>

          <div style="font-size: 1.05rem; font-weight: 600; line-height: 1.5; margin-bottom: 1rem;">
            ${formatQuestionText(q.question)}
          </div>

          ${imgHtml}

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.5rem;">
            ${q.options.map((opt, oIdx) => {
              const isCorrect = oIdx === q.correctIndex;
              const bg = isCorrect ? 'var(--success-bg)' : 'var(--bg-surface)';
              const border = isCorrect ? 'var(--success)' : 'var(--border-color)';
              const color = isCorrect ? 'var(--success)' : 'inherit';
              const fw = isCorrect ? '700' : '500';

              return `
                <div style="background: ${bg}; border: 1px solid ${border}; color: ${color}; font-weight: ${fw}; padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); font-size: 0.88rem; display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-weight: 700; width: 20px;">${letters[oIdx] || oIdx + 1}.</span>
                  <span style="flex: 1;">${escapeHtml(opt)}</span>
                  ${isCorrect ? '<span style="font-size:0.75rem;font-weight:700;">correct</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Pagination controls
    const paginationHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <span style="color: var(--text-muted); font-size: 0.88rem;">Page ${currentPage} of ${totalPages}</span>
        <div style="display: flex; gap: 0.5rem;">
          <button class="action-btn" style="padding: 0.45rem 0.85rem;" ${currentPage === 1 ? 'disabled' : ''} onclick="BankModule.changePage(${currentPage - 1})">
            Previous
          </button>
          <button class="action-btn" style="padding: 0.45rem 0.85rem;" ${currentPage === totalPages ? 'disabled' : ''} onclick="BankModule.changePage(${currentPage + 1})">
            Next
          </button>
        </div>
      </div>
    `;

    container.innerHTML = itemsHtml + paginationHtml;
  }

  function changePage(newPage) {
    currentPage = newPage;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function filterByTopic(topicName) {
    const filterSelect = document.getElementById('bank-topic-filter');
    if (filterSelect) {
      filterSelect.value = topicName;
      applyFilter();
    }
  }

  function formatQuestionText(raw) {
    if (!raw) return '';
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

  return {
    init,
    applyFilter,
    filterByTopic,
    changePage
  };
})();
