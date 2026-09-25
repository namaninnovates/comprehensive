/**
 * Comprehensive Exam Quiz System - Report Question Module
 * Handles reporting question issues across Test/Practice, Review, and Question Bank.
 * Supports LocalStorage collection, GitHub Issue pre-fill, Clipboard copy, & Webhook dispatch.
 */

window.ReportModule = (function () {
  const STORAGE_KEY = 'faceit_question_reports';
  const WEBHOOK_KEY = 'faceit_webhook_url';
  let activeQuestion = null;

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
    if (!badge) return;
    const reports = getReports();
    if (reports.length > 0) {
      badge.textContent = reports.length;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

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
    const repoUrl = 'https://github.com/namaninnovates/comprehensive';
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
     Report Manager Drawer / Modal (Admin View)
     -------------------------------------------------------------------------- */
  function openReportManagerModal() {
    const modal = document.getElementById('report-manager-modal');
    if (!modal) return;
    renderReportManagerList();
    
    // Fill webhook input
    const webhookInput = document.getElementById('report-webhook-input');
    if (webhookInput) webhookInput.value = getWebhookUrl();

    modal.classList.add('active');
  }

  function closeReportManagerModal() {
    const modal = document.getElementById('report-manager-modal');
    if (modal) modal.classList.remove('active');
  }

  function renderReportManagerList() {
    const container = document.getElementById('report-manager-list');
    if (!container) return;

    const reports = getReports();
    if (reports.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No questions have been reported yet.</p>
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

  function deleteReport(reportId) {
    let reports = getReports();
    reports = reports.filter(r => r.id !== reportId);
    saveReports(reports);
    renderReportManagerList();
  }

  function clearAllReports() {
    if (confirm('Are you sure you want to clear all reported questions data?')) {
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
    updateReportBadge();
  }

  return {
    init,
    getReports,
    openReportModal,
    openReportModalById,
    closeReportModal,
    submitReport,
    openGitHubIssue,
    copyReportToClipboard,
    openReportManagerModal,
    closeReportManagerModal,
    deleteReport,
    clearAllReports,
    saveWebhookSetting,
    exportReports
  };
})();
