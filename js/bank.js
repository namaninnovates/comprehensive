/**
 * Comprehensive Exam Quiz System - Question Bank Module
 * Browse and search all questions by keyword, ID, topic, and page ranges
 * with instant case-insensitive finder, edge-case symbol normalization, & term highlighting.
 */

window.BankModule = (function () {
  let filteredQuestions = [];
  let currentPage = 1;
  const pageSize = 20;

  const TOPIC_ABBRS = {
    'dsa': 'data structures & algorithms',
    'toc': 'theory of computation',
    'cn': 'computer networks',
    'dbms': 'database management systems',
    'os': 'operating systems',
    'sec': 'cyber security & privacy',
    'security': 'cyber security & privacy',
    'crypto': 'cyber security & privacy',
    'oop': 'programming & oop',
    'cpp': 'programming & oop',
    'c++': 'programming & oop',
    'arch': 'computer architecture & digital logic',
    'se': 'software engineering & testing',
    'mgmt': 'management & business systems'
  };

  function init() {
    const searchInput = document.getElementById('bank-search-input');
    const pageFilterSelect = document.getElementById('bank-page-filter');
    const topicFilterSelect = document.getElementById('bank-topic-filter');

    if (searchInput) {
      searchInput.addEventListener('input', applyFilter);
    }
    if (pageFilterSelect) {
      pageFilterSelect.addEventListener('change', applyFilter);
    }
    if (topicFilterSelect) {
      topicFilterSelect.addEventListener('change', applyFilter);
    }

    applyFilter();
  }

  function escapeRegExp(string) {
    if (!string) return '';
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeSymbols(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/<=/g, '≤')
      .replace(/>=/g, '≥')
      .replace(/!=/g, '≠')
      .replace(/->/g, '→');
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function highlightMatch(text, query) {
    if (!text) return '';
    if (!query) return escapeHtml(text);
    const cleanQuery = query.trim();
    if (!cleanQuery) return escapeHtml(text);

    // Escape HTML first
    const safeText = escapeHtml(text);

    // Extract search tokens for highlighting
    const tokens = cleanQuery.split(/\s+/).filter(tok => tok.length > 0);
    if (tokens.length === 0) return safeText;

    let highlighted = safeText;
    tokens.forEach(tok => {
      const safeTok = escapeHtml(tok);
      const pattern = escapeRegExp(safeTok);
      if (pattern) {
        try {
          const regex = new RegExp(`(${pattern})`, 'gi');
          highlighted = highlighted.replace(regex, '<mark class="search-highlight">$1</mark>');
        } catch (e) {}
      }
    });

    return highlighted;
  }

  function formatQuestionTextWithHighlight(raw, query) {
    if (!raw) return "";
    
    // Check if question contains code snippet
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
          ${preText ? `<div>${highlightMatch(preText, query)}</div>` : ''}
          <pre class="code-block"><code>${highlightMatch(codeSnippet, query)}</code></pre>
        `;
      }
    }

    return `<div>${highlightMatch(raw, query)}</div>`;
  }

  function applyFilter() {
    const all = window.COMPREHENSIVE_QUESTIONS || [];
    let searchVal = (document.getElementById('bank-search-input')?.value || '').trim();
    const rangeVal = document.getElementById('bank-page-filter')?.value || 'all';
    const topicVal = document.getElementById('bank-topic-filter')?.value || 'all';

    let rangeStart = 1;
    let rangeEnd = 400;

    if (rangeVal !== 'all') {
      const parts = rangeVal.split('-');
      rangeStart = parseInt(parts[0], 10);
      rangeEnd = parseInt(parts[1], 10);
    }

    const normQuery = normalizeSymbols(searchVal);

    // Check Question ID specific patterns (e.g. #529, id: 529, ID 529)
    let idMatch = normQuery.match(/^(?:id:?\s*|#\s*)?(\d+)$/);
    let targetId = idMatch ? parseInt(idMatch[1], 10) : null;

    // Check Page specific patterns (e.g. page 140, pg 140, p.140, p 140)
    let pageMatch = normQuery.match(/^(?:page|pg|p\.?)\s*(\d+)$/);
    let targetPage = pageMatch ? parseInt(pageMatch[1], 10) : null;

    // Check Topic abbreviation match (e.g. dsa, toc, cn, oop, sec, os)
    let targetTopicAbbr = TOPIC_ABBRS[normQuery] || null;

    // Split multi-word query tokens
    const tokens = normQuery.split(/\s+/).filter(Boolean);

    filteredQuestions = all.filter(q => {
      // 1. Page Range filter
      if (q.page < rangeStart || q.page > rangeEnd) return false;

      // 2. Topic Dropdown filter
      if (topicVal !== 'all' && q.topic !== topicVal) return false;

      if (!normQuery) return true;

      // 3. Match Question ID
      if (targetId !== null && q.id === targetId) return true;

      // 4. Match Page Number
      if (targetPage !== null && q.page === targetPage) return true;

      // 5. Match Topic Abbreviation
      if (targetTopicAbbr && q.topic && q.topic.toLowerCase().includes(targetTopicAbbr)) return true;

      // 6. Tokenized multi-word search across all fields
      const content = normalizeSymbols([
        `#${q.id}`,
        `id:${q.id}`,
        `page ${q.page}`,
        `p.${q.page}`,
        q.topic || '',
        q.question || '',
        ...(q.options || []),
        q.correctAnswer || ''
      ].join(' '));

      return tokens.every(tok => content.includes(tok));
    });

    currentPage = 1;
    render();
  }

  function filterByTopic(topicName) {
    const topicFilterSelect = document.getElementById('bank-topic-filter');
    if (topicFilterSelect) {
      topicFilterSelect.value = topicName;
      applyFilter();
    }
  }

  function changePage(newPage) {
    const totalPages = Math.ceil(filteredQuestions.length / pageSize);
    if (newPage >= 1 && newPage <= totalPages) {
      currentPage = newPage;
      render();
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {}
    }
  }

  function render() {
    const container = document.getElementById('bank-list-container');
    const countIndicator = document.getElementById('bank-count-indicator');
    const searchVal = (document.getElementById('bank-search-input')?.value || '').trim();
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
      const ghIssues = window.ReportModule ? window.ReportModule.getQuestionGitHubIssues(q.id) : [];
      const ghBadgeHtml = ghIssues.map(issue => `
        <a href="${issue.htmlUrl}" target="_blank" rel="noopener noreferrer" class="badge" style="background: rgba(239, 68, 68, 0.15); color: var(--danger); font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;" title="View GitHub Issue #${issue.number}">
          <span>🚨 GitHub Issue #${issue.number} (${issue.state})</span>
        </a>
      `).join('');

      return `
        <div class="card" style="padding: 1.5rem; margin-bottom: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
              #${globalIdx} (ID: ${q.id}) • <span class="badge badge-page">PDF Page: ${q.page}</span>
              ${q.topic ? `<span class="badge badge-topic" style="cursor: pointer;" title="Click to filter by this topic" onclick="BankModule.filterByTopic('${escapeHtml(q.topic)}')">${escapeHtml(q.topic)}</span>` : ''}
              ${ghBadgeHtml}
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <button class="btn-report" onclick="ReportModule.openReportModalById('${q.id}')" title="Report issue with question #${q.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <span>Report</span>
              </button>
              <span class="badge" style="background: var(--success-bg); color: var(--success); font-weight: 700;">
                Answer: Option ${letters[q.correctIndex] || q.correctIndex + 1}
              </span>
            </div>
          </div>

          <div style="font-size: 1.05rem; font-weight: 600; line-height: 1.5; margin-bottom: 1rem;">
            ${formatQuestionTextWithHighlight(q.question, searchVal)}
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
                  <span style="flex: 1;">${highlightMatch(opt, searchVal)}</span>
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

  return {
    init,
    applyFilter,
    filterByTopic,
    changePage
  };
})();
