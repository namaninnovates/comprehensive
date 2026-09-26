/**
 * Comprehensive Exam Quiz System - Report Question Module
 * Handles reporting question issues across Test/Practice, Review, and Question Bank.
 * Supports LocalStorage collection, Webhooks, and LIVE Reading/Writing from GitHub Issues API.
 */

window.ReportModule = (function () {
  const STORAGE_KEY = 'faceit_question_reports';
  const WEBHOOK_KEY = 'faceit_webhook_url';
  const GITHUB_REPO = 'namaninnovates/comprehensive';
  const GITHUB_CACHE_KEY = 'faceit_github_issues_cache';

  let activeQuestion = null;
  let githubIssues = [];
  let githubIssuesMap = {}; // qId -> array of issues
  let currentGhFilter = 'open';
  let activeTab = 'github';

  /* --------------------------------------------------------------------------
     Local Reports Management
     -------------------------------------------------------------------------- */
  function getReports() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading reports from localStorage:', e);
      return [];
    }
  }

  function saveReports(reports) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
      updateReportBadge();
    } catch (e) {
      console.error('Error saving reports to localStorage:', e);
    }
  }

  function getWebhookUrl() {
    try {
      return localStorage.getItem(WEBHOOK_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setWebhookUrl(url) {
    try {
      localStorage.setItem(WEBHOOK_KEY, url);
    } catch (e) {}
  }

  function updateReportBadge() {
    const badge = document.getElementById('nav-reports-badge');
    const ghTabBadge = document.getElementById('gh-issues-tab-badge');
    
    const localCount = getReports().length;
    const ghOpenCount = githubIssues.filter(i => i.state === 'open').length;
    const totalCount = localCount + ghOpenCount;

    if (badge) {
      if (totalCount > 0) {
        badge.textContent = totalCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    if (ghTabBadge) {
      ghTabBadge.textContent = ghOpenCount;
    }
  }

  /* --------------------------------------------------------------------------
     GitHub Issues API Integration (READING FROM GITHUB)
     -------------------------------------------------------------------------- */
  function loadCachedGitHubIssues() {
    try {
      const cached = localStorage.getItem(GITHUB_CACHE_KEY);
      if (cached) {
        githubIssues = JSON.parse(cached);
        buildGitHubIssuesMap();
        updateReportBadge();
      }
    } catch (e) {}
  }

  async function fetchGitHubIssues() {
    loadCachedGitHubIssues();
    const statusText = document.getElementById('github-issues-status');
    if (statusText) statusText.textContent = `Syncing with github.com/${GITHUB_REPO}...`;

    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/issues?state=all&per_page=100`;
    try {
      const res = await fetch(apiUrl, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
      const data = await res.json();
      
      // Filter out PRs if any
      githubIssues = data.filter(item => !item.pull_request).map(issue => {
        const parsedQId = parseQuestionIdFromIssue(issue);
        const parsedCategory = parseCategoryFromIssue(issue);
        const parsedNotes = parseNotesFromIssue(issue);
        return {
          id: issue.id,
          number: issue.number,
          title: issue.title,
          state: issue.state,
          htmlUrl: issue.html_url,
          user: issue.user ? issue.user.login : 'anonymous',
          userAvatar: issue.user ? issue.user.avatar_url : '',
          createdAt: issue.created_at,
          dateFormatted: new Date(issue.created_at).toLocaleDateString(),
          comments: issue.comments,
          body: issue.body || '',
          questionId: parsedQId,
          category: parsedCategory,
          notes: parsedNotes
        };
      });

      localStorage.setItem(GITHUB_CACHE_KEY, JSON.stringify(githubIssues));
      buildGitHubIssuesMap();
      updateReportBadge();
      
      if (document.getElementById('github-issues-list')) {
        renderGitHubIssuesList();
      }

      // Refresh Question Bank / Review list badges if rendered
      if (window.BankModule && window.BankModule.applyFilter) {
        window.BankModule.applyFilter();
      }
    } catch (e) {
      console.warn('Could not fetch GitHub issues:', e);
      if (statusText) {
        statusText.textContent = `Using cached issues (${githubIssues.length} issues loaded offline).`;
      }
    }
  }

  function parseQuestionIdFromIssue(issue) {
    // 1. Title match: e.g. "[Question Report] Issue in Question #1223 (Page 341)"
    const titleMatch = issue.title.match(/Question\s*#?(\d+)/i);
    if (titleMatch) return titleMatch[1];
    
    // 2. Body match: e.g. "- **Question ID:** #1223"
    if (issue.body) {
      const bodyMatch = issue.body.match(/Question\s*ID:?\s*\*?\*?\s*#?(\d+)/i);
      if (bodyMatch) return bodyMatch[1];
    }
    return null;
  }

  function parseCategoryFromIssue(issue) {
    if (!issue.body) return 'Reported Issue';
    const match = issue.body.match(/Report\s*Category:?\s*\*?\*?\s*([^\n\r]+)/i);
    return match ? match[1].replace(/<!--.*-->/, '').trim() : 'Reported Issue';
  }

  function parseNotesFromIssue(issue) {
    if (!issue.body) return '';
    const match = issue.body.match(/###\s*Description[^\n]*\n+([\s\S]*?)(?:\n---|\n###|$)/i);
    return match ? match[1].trim() : '';
  }

  function buildGitHubIssuesMap() {
    githubIssuesMap = {};
    githubIssues.forEach(issue => {
      if (issue.questionId) {
        const qId = String(issue.questionId);
        if (!githubIssuesMap[qId]) githubIssuesMap[qId] = [];
        githubIssuesMap[qId].push(issue);
      }
    });
  }

  function getQuestionGitHubIssues(qId) {
    return githubIssuesMap[String(qId)] || [];
  }

  function getGitHubIssues() {
    return githubIssues;
  }

  /* --------------------------------------------------------------------------
     Report Submission Logic (WRITING TO GITHUB ISSUES)
     -------------------------------------------------------------------------- */
  function findQuestionById(qId) {
    const all = window.COMPREHENSIVE_QUESTIONS || [];
    return all.find(q => String(q.id) === String(qId)) || null;
  }

  function openReportModalById(qId) {
    const q = findQuestionById(qId);
    if (q) {
      openReportModal(q);
    } else {
      alert('Question data not found.');
    }
  }

  function openReportModal(q) {
    if (!q) return;
    activeQuestion = q;

    const modal = document.getElementById('report-question-modal');
    if (!modal) return;

    // Populate modal fields
    const qIdElem = document.getElementById('report-modal-qid');
    const qPageElem = document.getElementById('report-modal-qpage');
    const qTopicElem = document.getElementById('report-modal-qtopic');
    const qPreviewElem = document.getElementById('report-modal-qpreview');
    const reasonSelect = document.getElementById('report-modal-reason');
    const detailsTextarea = document.getElementById('report-modal-details');
    const statusMsg = document.getElementById('report-modal-status');

    if (qIdElem) qIdElem.textContent = `#${q.id}`;
    if (qPageElem) qPageElem.textContent = `Page ${q.page}`;
    if (qTopicElem) qTopicElem.textContent = q.topic || 'General';

    if (qPreviewElem) {
      const snippet = q.question.length > 120 ? q.question.substring(0, 120) + '...' : q.question;
      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      const ansLetter = letters[q.correctIndex] || (q.correctIndex + 1);
      qPreviewElem.innerHTML = `
        <div style="font-size: 0.88rem; color: var(--text); font-weight: 500; margin-bottom: 0.35rem;">
          "${escapeHtml(snippet)}"
        </div>
        <div style="font-size: 0.78rem; color: var(--success); font-weight: 600;">
          Current Stated Answer: Option ${ansLetter} — ${escapeHtml(q.correctAnswer || q.options[q.correctIndex] || '')}
        </div>
      `;
    }

    if (reasonSelect) reasonSelect.selectedIndex = 0;
    if (detailsTextarea) detailsTextarea.value = '';
    if (statusMsg) {
      statusMsg.style.display = 'none';
      statusMsg.textContent = '';
    }

    modal.classList.add('active');
  }

  function closeReportModal() {
    const modal = document.getElementById('report-question-modal');
    if (modal) modal.classList.remove('active');
    activeQuestion = null;
  }

  function formatReportPayload() {
    if (!activeQuestion) return null;
    const reasonSelect = document.getElementById('report-modal-reason');
    const detailsTextarea = document.getElementById('report-modal-details');
    const userEmailInput = document.getElementById('report-modal-email');

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const ansLetter = letters[activeQuestion.correctIndex] || (activeQuestion.correctIndex + 1);

    const reasonVal = reasonSelect ? reasonSelect.value : 'incorrect_answer';
    const reasonText = reasonSelect ? reasonSelect.options[reasonSelect.selectedIndex].text : 'Incorrect Answer Key';
    const details = detailsTextarea ? detailsTextarea.value.trim() : '';
    const email = userEmailInput ? userEmailInput.value.trim() : '';

    return {
      id: 'report_' + Date.now() + '_' + activeQuestion.id,
      timestamp: Date.now(),
      dateFormatted: new Date().toLocaleString(),
      questionId: activeQuestion.id,
      page: activeQuestion.page,
      topic: activeQuestion.topic || 'General',
      questionSnippet: activeQuestion.question,
      correctIndex: activeQuestion.correctIndex,
      correctAnswerLetter: ansLetter,
      correctAnswerText: activeQuestion.correctAnswer || activeQuestion.options[activeQuestion.correctIndex],
      reason: reasonVal,
      reasonText: reasonText,
      details: details,
      userEmail: email
    };
  }

  async function submitReport() {
    const payload = formatReportPayload();
    if (!payload) return;

    // 1. Store locally
    const reports = getReports();
    reports.push(payload);
    saveReports(reports);

    // 2. Dispatch Webhook if configured
    const webhookUrl = getWebhookUrl();
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚨 **New Question Report Submitted**\n` +
              `**Question ID:** #${payload.questionId} (PDF Page ${payload.page})\n` +
              `**Topic:** ${payload.topic}\n` +
              `**Reason:** ${payload.reasonText}\n` +
              `**Current Stated Answer:** Option ${payload.correctAnswerLetter}\n` +
              `**Details:** ${payload.details || 'None provided'}\n` +
              `**User Email:** ${payload.userEmail || 'N/A'}`
          })
        });
      } catch (err) {
        console.warn('Webhook dispatch failed:', err);
      }
    }

    const statusMsg = document.getElementById('report-modal-status');
    if (statusMsg) {
      statusMsg.style.display = 'block';
      statusMsg.className = 'status-msg success';
      statusMsg.textContent = 'Report saved successfully! Thank you for helping improve quality.';
    }

    setTimeout(() => {
      closeReportModal();
    }, 1200);
  }

  async function openGitHubIssue() {
    if (!activeQuestion) return;
    const payload = formatReportPayload();
    if (!payload) return;

    // 1. Save locally in report history
    const reports = getReports();
    reports.push(payload);
    saveReports(reports);

    // 2. Dispatch Webhook if configured
    const webhookUrl = getWebhookUrl();
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚨 **New Question Report Submitted (via GitHub Issues)**\n` +
              `**Question ID:** #${payload.questionId} (PDF Page ${payload.page})\n` +
              `**Topic:** ${payload.topic}\n` +
              `**Reason:** ${payload.reasonText}\n` +
              `**Current Stated Answer:** Option ${payload.correctAnswerLetter}\n` +
              `**Details:** ${payload.details || 'None provided'}`
          })
        });
      } catch (err) {
        console.warn('Webhook dispatch failed:', err);
      }
    }

    // 3. Construct GitHub Issue URL
    const repoUrl = `https://github.com/${GITHUB_REPO}`;
    const issueTitle = `[Question Report] Issue in Question #${payload.questionId} (Page ${payload.page})`;
    
    const issueBody = `### Question Issue Report
- **Question ID:** #${payload.questionId}
- **PDF Page:** ${payload.page}
- **Topic:** ${payload.topic}
- **Report Category:** ${payload.reasonText}
- **Current Stated Answer:** Option ${payload.correctAnswerLetter} — ${payload.correctAnswerText}

### Question Text:
\`\`\`text
${payload.questionSnippet}
\`\`\`

### Description / User Notes:
${payload.details || 'No additional details provided.'}

---
*Reported via fACE-it Exam Practice Platform*`;

    const fullUrl = `${repoUrl}/issues/new?title=${encodeURIComponent(issueTitle)}&labels=question-report,bug&body=${encodeURIComponent(issueBody)}`;
    
    window.open(fullUrl, '_blank', 'noopener,noreferrer');

    const statusMsg = document.getElementById('report-modal-status');
    if (statusMsg) {
      statusMsg.style.display = 'block';
      statusMsg.className = 'status-msg success';
      statusMsg.textContent = 'Opened GitHub Issue page in new tab! Report also saved to local history.';
    }

    setTimeout(() => {
      closeReportModal();
      // Re-fetch GitHub issues after 3 seconds in case user submitted it
      setTimeout(fetchGitHubIssues, 3000);
    }, 1500);
  }

  function copyReportToClipboard() {
    if (!activeQuestion) return;
    const payload = formatReportPayload();
    if (!payload) return;

    const text = `[Question #${payload.questionId} Report]
Page: ${payload.page} | Topic: ${payload.topic}
Reason: ${payload.reasonText}
Current Answer: Option ${payload.correctAnswerLetter} (${payload.correctAnswerText})
Question: ${payload.questionSnippet}
User Notes: ${payload.details || 'None'}`;

    navigator.clipboard.writeText(text).then(() => {
      const statusMsg = document.getElementById('report-modal-status');
      if (statusMsg) {
        statusMsg.style.display = 'block';
        statusMsg.className = 'status-msg info';
        statusMsg.textContent = 'Report copied to clipboard!';
      }
    }).catch(err => {
      alert('Failed to copy to clipboard: ' + err);
    });
  }

  /* --------------------------------------------------------------------------
     Report Manager Modal & Renderers
     -------------------------------------------------------------------------- */
  function openReportManagerModal() {
    const modal = document.getElementById('report-manager-modal');
    if (!modal) return;
    
    switchReportTab(activeTab);
    fetchGitHubIssues();

    // Fill webhook input
    const webhookInput = document.getElementById('report-webhook-input');
    if (webhookInput) webhookInput.value = getWebhookUrl();

    modal.classList.add('active');
  }

  function closeReportManagerModal() {
    const modal = document.getElementById('report-manager-modal');
    if (modal) modal.classList.remove('active');
  }

  function switchReportTab(tabName) {
    activeTab = tabName;
    const tabGh = document.getElementById('tab-report-github');
    const tabLocal = document.getElementById('tab-report-local');
    const panelGh = document.getElementById('panel-report-github');
    const panelLocal = document.getElementById('panel-report-local');

    if (tabName === 'github') {
      if (tabGh) tabGh.classList.add('active');
      if (tabLocal) tabLocal.classList.remove('active');
      if (panelGh) panelGh.style.display = 'block';
      if (panelLocal) panelLocal.style.display = 'none';
      renderGitHubIssuesList();
    } else {
      if (tabLocal) tabLocal.classList.add('active');
      if (tabGh) tabGh.classList.remove('active');
      if (panelLocal) panelLocal.style.display = 'block';
      if (panelGh) panelGh.style.display = 'none';
      renderReportManagerList();
    }
  }

  function filterGitHubIssues(state) {
    currentGhFilter = state;
    ['open', 'closed', 'all'].forEach(s => {
      const chip = document.getElementById(`gh-chip-${s}`);
      if (chip) {
        if (s === state) chip.classList.add('active');
        else chip.classList.remove('active');
      }
    });
    renderGitHubIssuesList();
  }

  function renderGitHubIssuesList() {
    const container = document.getElementById('github-issues-list');
    const statusText = document.getElementById('github-issues-status');
    if (!container) return;

    let items = githubIssues;

    if (currentGhFilter === 'open') {
      items = items.filter(i => i.state === 'open');
    } else if (currentGhFilter === 'closed') {
      items = items.filter(i => i.state === 'closed');
    }

    const searchVal = (document.getElementById('github-issues-search')?.value || '').trim().toLowerCase();

    if (searchVal) {
      items = items.filter(i => {
        const matchTitle = i.title.toLowerCase().includes(searchVal);
        const matchQId = i.questionId && String(i.questionId).includes(searchVal);
        const matchBody = i.body.toLowerCase().includes(searchVal);
        const matchUser = i.user.toLowerCase().includes(searchVal);
        return matchTitle || matchQId || matchBody || matchUser;
      });
    }

    if (statusText) {
      const openCount = githubIssues.filter(i => i.state === 'open').length;
      statusText.innerHTML = `Synced with <a href="https://github.com/${GITHUB_REPO}/issues" target="_blank" rel="noopener noreferrer" style="color:var(--primary); font-weight:600;">github.com/${GITHUB_REPO}</a> • <strong>${openCount} Open Issue${openCount === 1 ? '' : 's'}</strong> (${githubIssues.length} total)`;
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No GitHub issues found matching "${currentGhFilter}" filter.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(issue => {
      const isOpen = issue.state === 'open';
      const stateBadge = isOpen
        ? `<span class="badge" style="background: var(--success-bg); color: var(--success); font-weight: 700;">🟢 Open #${issue.number}</span>`
        : `<span class="badge" style="background: var(--danger-bg); color: var(--danger); font-weight: 700;">🔴 Closed #${issue.number}</span>`;

      return `
        <div class="card" style="padding: 1rem; margin-bottom: 0.75rem; border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
              ${stateBadge}
              ${issue.questionId ? `<span class="badge badge-topic" style="cursor: pointer;" onclick="ReportModule.showQuestionInBank('${issue.questionId}')" title="Click to view Question #${issue.questionId} in Question Bank">Question #${issue.questionId}</span>` : ''}
              <a href="${issue.htmlUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--text); text-decoration: none; font-weight: 700;">
                ${escapeHtml(issue.title)}
              </a>
            </div>
            <a href="${issue.htmlUrl}" target="_blank" rel="noopener noreferrer" class="action-btn" style="padding: 0.25rem 0.65rem; font-size: 0.78rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.3rem;">
              <span>View & Reply on GitHub</span> ↗
            </a>
          </div>

          ${issue.notes ? `
            <div style="background: var(--bg-surface); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.84rem; margin-bottom: 0.5rem; border-left: 3px solid var(--warning); white-space: pre-line;">
              <strong>User Notes:</strong> ${escapeHtml(issue.notes)}
            </div>
          ` : ''}

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: var(--text-muted); flex-wrap: wrap; gap: 0.5rem;">
            <span>Reported by <strong>@${escapeHtml(issue.user)}</strong> on ${issue.dateFormatted}</span>
            <span>${issue.comments} comment${issue.comments === 1 ? '' : 's'}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderReportManagerList() {
    const container = document.getElementById('report-manager-list');
    if (!container) return;

    const reports = getReports();
    if (reports.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No local browser reports saved.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = reports.map((r, i) => {
      return `
        <div class="card" style="padding: 1rem; margin-bottom: 0.75rem; border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="font-weight: 700; font-size: 0.95rem;">
              #${i + 1} — Question #${r.questionId} <span class="badge badge-page">Page ${r.page}</span>
              <span class="badge badge-topic">${escapeHtml(r.topic)}</span>
            </div>
            <span class="badge" style="background: var(--warning-bg); color: var(--warning); font-weight: 700;">
              ${escapeHtml(r.reasonText)}
            </span>
          </div>

          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
            "${escapeHtml(r.questionSnippet.length > 100 ? r.questionSnippet.substring(0, 100) + '...' : r.questionSnippet)}"
          </div>

          ${r.details ? `
            <div style="background: var(--bg-surface); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.84rem; margin-bottom: 0.5rem; border-left: 3px solid var(--warning);">
              <strong>Notes:</strong> ${escapeHtml(r.details)}
            </div>
          ` : ''}

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: var(--text-muted); flex-wrap: wrap; gap: 0.5rem;">
            <span>Reported on: ${r.dateFormatted} ${r.userEmail ? `• By: ${escapeHtml(r.userEmail)}` : ''}</span>
            <button class="action-btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; color: var(--danger); border-color: rgba(239, 68, 68, 0.3);" onclick="ReportModule.deleteReport('${r.id}')">
              Delete
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function showQuestionInBank(qId) {
    closeReportManagerModal();
    if (window.App && window.App.switchView) {
      window.App.switchView('bank');
    }
    const searchInput = document.getElementById('bank-search-input');
    if (searchInput) {
      searchInput.value = `ID: ${qId}`;
      if (window.BankModule && window.BankModule.applyFilter) {
        window.BankModule.applyFilter();
      }
    }
  }

  function deleteReport(reportId) {
    let reports = getReports();
    reports = reports.filter(r => r.id !== reportId);
    saveReports(reports);
    renderReportManagerList();
  }

  function clearAllReports() {
    if (confirm('Are you sure you want to clear all local saved reports?')) {
      saveReports([]);
      renderReportManagerList();
    }
  }

  function saveWebhookSetting() {
    const input = document.getElementById('report-webhook-input');
    if (!input) return;
    const url = input.value.trim();
    setWebhookUrl(url);
    alert(url ? 'Webhook URL saved! Future reports will be dispatched to this endpoint.' : 'Webhook URL cleared.');
  }

  function exportReports(format) {
    const reports = getReports();
    if (reports.length === 0) {
      alert('No reports to export.');
      return;
    }

    let content = '';
    let filename = `faceit_question_reports_${Date.now()}`;
    let mimeType = '';

    if (format === 'json') {
      content = JSON.stringify(reports, null, 2);
      filename += '.json';
      mimeType = 'application/json';
    } else if (format === 'csv') {
      const headers = ['Report ID', 'Timestamp', 'Question ID', 'Page', 'Topic', 'Reason', 'Question Text', 'Stated Answer', 'User Notes', 'User Email'];
      const rows = reports.map(r => [
        `"${r.id}"`,
        `"${r.dateFormatted}"`,
        `"${r.questionId}"`,
        `"${r.page}"`,
        `"${r.topic}"`,
        `"${r.reasonText}"`,
        `"${(r.questionSnippet || '').replace(/"/g, '""')}"`,
        `"${(r.correctAnswerText || '').replace(/"/g, '""')}"`,
        `"${(r.details || '').replace(/"/g, '""')}"`,
        `"${(r.userEmail || '').replace(/"/g, '""')}"`
      ]);
      content = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      filename += '.csv';
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    loadCachedGitHubIssues();
    updateReportBadge();
    fetchGitHubIssues();
  }

  return {
    init,
    getReports,
    getGitHubIssues,
    getQuestionGitHubIssues,
    fetchGitHubIssues,
    openReportModal,
    openReportModalById,
    closeReportModal,
    submitReport,
    openGitHubIssue,
    copyReportToClipboard,
    openReportManagerModal,
    closeReportManagerModal,
    switchReportTab,
    filterGitHubIssues,
    renderGitHubIssuesList,
    showQuestionInBank,
    deleteReport,
    clearAllReports,
    saveWebhookSetting,
    exportReports
  };
})();
