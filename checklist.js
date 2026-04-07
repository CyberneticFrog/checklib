let reportData = JSON.parse(localStorage.getItem('reportData') || '[]');
let archiveData = JSON.parse(localStorage.getItem('archiveData') || '[]');
let reportCount = parseInt(localStorage.getItem('reportCount') || '0', 10);
let checklistMetadata = {};
let customChecklistCache = {};

const STAGES = ['setup', 'section', 'issues', 'final'];
const STAGE_LABELS = {
  setup: 'Setup',
  section: 'Section Runner',
  issues: 'Issues Review',
  final: 'Final Review'
};
const PDF_META_FIELDS = ['date', 'supervisor', 'cleaner', 'unit'];
const PDF_LABELS = { date: 'Date', supervisor: 'Supervisor', cleaner: 'Team member', unit: 'Unit' };
const PROGRESS_STORAGE_KEY = 'checklistProgress';
const DEFAULTS_STORAGE_KEY = 'checklistDefaults';
const ISSUE_MODEL_VERSION = 1;
const BUILDER_DB_NAME = 'checklib_builder_db';
const BUILDER_DB_VERSION = 2;
const BUILDER_STORE_NAME = 'custom_checklists';

const appState = {
  checklistId: '',
  checklistSource: 'built-in',
  metadata: { date: '', supervisor: '', cleanerTeam: '', unitArea: '' },
  sections: [],
  currentSectionIndex: 0,
  sectionFilterUnanswered: false,
  answers: {},
  comments: {},
  issuesById: {},
  issueIdByTask: {},
  issueCount: 0,
  completionCount: 0,
  runnerStage: 'setup'
};

function openBuilderDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BUILDER_DB_NAME, BUILDER_DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(BUILDER_STORE_NAME)) {
        const store = db.createObjectStore(BUILDER_STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('title', 'title', { unique: false });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onblocked = () => reject(new Error('Builder database open blocked.'));
    request.onerror = () => reject(request.error);
  });
}

async function getCustomChecklists() {
  let db = null;

  try {
    db = await openBuilderDb();

    if (!db.objectStoreNames.contains(BUILDER_STORE_NAME)) {
      console.warn('Custom checklist store not found in builder database.');
      db.close();
      return [];
    }

    const results = await new Promise((resolve, reject) => {
      const tx = db.transaction(BUILDER_STORE_NAME, 'readonly');
      const store = tx.objectStore(BUILDER_STORE_NAME);
      const request = store.getAll();

      tx.onabort = () => reject(tx.error || new Error('Custom checklist transaction aborted.'));
      tx.onerror = () => reject(tx.error || new Error('Custom checklist transaction failed.'));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return results;
  } catch (error) {
    if (db) {
      try { db.close(); } catch {}
    }
    console.warn('Custom checklist load failed:', error);
    return [];
  }
}

function convertCustomChecklistToRows(record) {
  const rows = [];

  (record.sections || []).forEach(section => {
    (section.tasks || []).forEach(task => {
      rows.push({
        section: section.section || '',
        task: task.task || ''
      });
    });
  });

  return rows;
}

document.addEventListener('DOMContentLoaded', () => {
  const els = {
    form: document.getElementById('checklist-form'),
    checklistSelect: document.getElementById('checklist-select'),
    selectedChecklistPreview: document.getElementById('selected-checklist-preview'),
    checklistTitle: document.getElementById('checklist-title'),
    checklistContainer: document.getElementById('checklist-container'),
    addToReport: document.getElementById('add-to-report'),
    reportItems: document.getElementById('report-items'),
    archiveItems: document.getElementById('archive-items'),
    archiveCount: document.getElementById('archive-count'),
    queueSearch: document.getElementById('queue-search'),
    queueFilter: document.getElementById('queue-filter'),
    queueFilterStrip: document.getElementById('queue-filter-strip'),
    queueFilterSummary: document.getElementById('queue-filter-summary'),
    archiveSearch: document.getElementById('archive-search'),
    archiveFilter: document.getElementById('archive-filter'),
    archiveFilterStrip: document.getElementById('archive-filter-strip'),
    archiveFilterSummary: document.getElementById('archive-filter-summary'),
    exportQueueCsv: document.getElementById('export-queue-csv'),
    exportArchiveCsv: document.getElementById('export-archive-csv'),
    queueTileCount: document.getElementById('queue-tile-count'),
    queueTileIssues: document.getElementById('queue-tile-issues'),
    queueTileSigned: document.getElementById('queue-tile-signed'),
    queueTileClear: document.getElementById('queue-tile-clear'),
    queueDashboardTiles: document.getElementById('queue-dashboard-tiles'),
    archiveTileCount: document.getElementById('archive-tile-count'),
    archiveTileIssues: document.getElementById('archive-tile-issues'),
    archiveTileSigned: document.getElementById('archive-tile-signed'),
    archiveTileClear: document.getElementById('archive-tile-clear'),
    archiveDashboardTiles: document.getElementById('archive-dashboard-tiles'),
    exportReport: document.getElementById('export-report'),
    exportOptions: document.getElementById('export-options'),
    clearReports: document.getElementById('clear-reports'),
    checkAllYes: document.getElementById('check-all-yes'),
    clearForm: document.getElementById('clear-form'),
    saveProgress: document.getElementById('save-progress'),
    loadProgress: document.getElementById('load-progress'),
    shareReports: document.getElementById('share-reports'),
    checkUpdate: document.getElementById('check-update'),
    updateBanner: document.getElementById('update-banner'),
    updateNow: document.getElementById('update-now'),
    updateLater: document.getElementById('update-later'),
    resumeBanner: document.getElementById('resume-banner'),
    resumeBannerTitle: document.getElementById('resume-banner-title'),
    resumeBannerMeta: document.getElementById('resume-banner-meta'),
    resumeDraft: document.getElementById('resume-draft'),
    dismissDraft: document.getElementById('dismiss-draft'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.querySelector('.progress-text'),
    signatureModal: document.getElementById('signature-modal'),
    signaturePadCanvas: document.getElementById('signature-pad'),
    clearSignature: document.getElementById('clear-signature'),
    confirmSignature: document.getElementById('confirm-signature'),
    cancelSignature: document.getElementById('cancel-signature'),
    signatureError: document.getElementById('signature-error'),
    confirmModal: document.getElementById('confirm-modal'),
    confirmModalTitle: document.getElementById('confirm-modal-title'),
    confirmModalMessage: document.getElementById('confirm-modal-message'),
    confirmModalCancel: document.getElementById('confirm-modal-cancel'),
    confirmModalConfirm: document.getElementById('confirm-modal-confirm'),
    exportDecisionModal: document.getElementById('export-decision-modal'),
    exportModalTitle: document.getElementById('export-modal-title'),
    exportModalContext: document.getElementById('export-modal-context'),
    exportContentMode: document.getElementById('export-content-mode'),
    exportAfterMode: document.getElementById('export-after-mode'),
    exportCancel: document.getElementById('export-cancel'),
    exportRun: document.getElementById('export-run'),
    reportDetailModal: document.getElementById('report-detail-modal'),
    reportDetailTitle: document.getElementById('report-detail-title'),
    reportDetailContext: document.getElementById('report-detail-context'),
    reportDetailSummary: document.getElementById('report-detail-summary'),
    reportDetailSections: document.getElementById('report-detail-sections'),
    reportDetailIssues: document.getElementById('report-detail-issues'),
    reportDetailClose: document.getElementById('report-detail-close'),
    themeToggle: document.getElementById('theme-toggle'),
    offlineMessage: document.getElementById('offline-message'),
    startRunner: document.getElementById('start-runner'),
    openSectionDrawer: document.getElementById('open-section-drawer'),
    sectionPrev: document.getElementById('section-prev'),
    sectionNext: document.getElementById('section-next'),
    sectionReview: document.getElementById('section-review'),
    sectionPrevSticky: document.getElementById('section-prev-sticky'),
    sectionNextSticky: document.getElementById('section-next-sticky'),
    sectionReviewSticky: document.getElementById('section-review-sticky'),
    sectionSaveSticky: document.getElementById('section-save-sticky'),
    issuesBack: document.getElementById('issues-back'),
    issuesNext: document.getElementById('issues-next'),
    finalBack: document.getElementById('final-back'),
    issuesReview: document.getElementById('issues-review-container'),
    finalReview: document.getElementById('final-review-container'),
    sectionKicker: document.getElementById('section-kicker'),
    sectionTitle: document.getElementById('section-title'),
    sectionMeta: document.getElementById('section-meta'),
    sectionGuidanceBanner: document.getElementById('section-guidance-banner'),
    sectionGuidanceText: document.getElementById('section-guidance-text'),
    sectionShowUnanswered: document.getElementById('section-show-unanswered'),
    mobileChecklistTitle: document.getElementById('runner-mobile-checklist-title'),
    questionProgress: document.getElementById('runner-question-progress'),
    answeredCount: document.getElementById('runner-answered-count'),
    sectionIssues: document.getElementById('runner-section-issues'),
    issueBadge: document.getElementById('runner-issue-badge'),
    issuesSummary: document.getElementById('issues-summary-text'),
    finalSummary: document.getElementById('final-summary-text'),
    finalValidationSummary: document.getElementById('final-validation-summary'),
    finalSaveDraft: document.getElementById('final-save-draft'),
    finalProceedSignature: document.getElementById('final-proceed-signature'),
    sectionDrawer: document.getElementById('section-drawer'),
    sectionDrawerClose: document.getElementById('section-drawer-close'),
    sectionDrawerDismiss: document.getElementById('section-drawer-dismiss'),
    sectionDrawerList: document.getElementById('section-drawer-list'),
    summarySection: document.getElementById('runner-summary-section'),
    summaryCompletion: document.getElementById('runner-summary-completion'),
    summaryIssues: document.getElementById('runner-summary-issues'),
    autosaveStatus: document.getElementById('runner-autosave-status')
  };

  if (!els.form || !els.checklistSelect || !els.checklistContainer) return;

  let currentStepIndex = 0;
  let deferredInstallPrompt;
  let pendingAction = null;
  let swRegistration = null;
  let signaturePad = null;
  let confirmState = null;
  let autosaveEnabled = false;
  let pendingExportOptions = {
    contentMode: 'full',
    afterMode: 'keep'
  };
  let pendingExportContext = {
    scope: 'all',
    source: 'queue',
    instance: null
  };
  let pendingDetailContext = {
    source: 'queue',
    instance: null
  };
  let queueViewState = {
    search: '',
    filter: 'all'
  };
  let archiveViewState = {
    search: '',
    filter: 'all'
  };

  try {
    signaturePad = new SignaturePad(els.signaturePadCanvas, {
      penColor: 'black',
      backgroundColor: 'rgb(255,255,255)',
      minWidth: 1,
      maxWidth: 2.5
    });
  } catch (error) {
    console.warn('SignaturePad init failed:', error);
  }

  const metaFieldMap = [
    ['checklist-date', 'date'],
    ['supervisor', 'supervisor'],
    ['cleaner-team', 'cleanerTeam'],
    ['unit-area', 'unitArea']
  ];

  const syncMetadataFromInputs = () => {
    metaFieldMap.forEach(([id, key]) => { appState.metadata[key] = document.getElementById(id).value || ''; });
  };

  const syncInputsFromState = () => {
    metaFieldMap.forEach(([id, key]) => { document.getElementById(id).value = appState.metadata[key] || ''; });
  };

  const loadRememberedDefaults = () => {
    try {
      return JSON.parse(localStorage.getItem(DEFAULTS_STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  };

  const saveRememberedDefaults = () => {
    syncMetadataFromInputs();
    const defaults = {
      supervisor: appState.metadata.supervisor || '',
      cleanerTeam: appState.metadata.cleanerTeam || '',
      unitArea: appState.metadata.unitArea || '',
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(DEFAULTS_STORAGE_KEY, JSON.stringify(defaults));
  };

  const applyRememberedDefaults = () => {
    const defaults = loadRememberedDefaults();
    if (!appState.metadata.supervisor && defaults.supervisor) appState.metadata.supervisor = defaults.supervisor;
    if (!appState.metadata.cleanerTeam && defaults.cleanerTeam) appState.metadata.cleanerTeam = defaults.cleanerTeam;
    if (!appState.metadata.unitArea && defaults.unitArea) appState.metadata.unitArea = defaults.unitArea;
    syncInputsFromState();
  };

  const getSavedDraft = () => {
    try {
      const saved = localStorage.getItem(PROGRESS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const formatDraftTimestamp = timestamp => {
    if (!timestamp) return 'Saved previously on this checklist.';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Saved previously on this checklist.';
    return `Saved ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
  };

  const escapeAttr = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');

  const updateAutosaveStatus = (timestamp, prefix = 'Autosave') => {
    if (!els.autosaveStatus) return;
    if (!timestamp) {
      els.autosaveStatus.textContent = 'Autosave: not yet saved.';
      return;
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      els.autosaveStatus.textContent = 'Autosave: not yet saved.';
      return;
    }
    els.autosaveStatus.textContent = `${prefix}: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const updateResumeBanner = () => {
    const saved = getSavedDraft();
    if (!saved || saved.checklistId !== appState.checklistId) {
      els.resumeBanner.classList.add('hidden');
      updateAutosaveStatus(null);
      return;
    }
    const rawSectionIndex = Number.parseInt(saved.currentSectionIndex, 10);
    const sectionCount = Array.isArray(appState.sections) ? appState.sections.length : 0;
    const safeSection = Number.isInteger(rawSectionIndex) && sectionCount
      ? Math.min(Math.max(rawSectionIndex, 0), sectionCount - 1) + 1
      : 1;
    const stageLabel = STAGE_LABELS[saved.stage] || 'Section Runner';
    els.resumeBannerTitle.textContent = 'Draft ready to continue';
    els.resumeBannerMeta.textContent = `${formatDraftTimestamp(saved.savedAt)} Last view: ${stageLabel}, Section ${safeSection}.`;
    els.resumeBanner.classList.remove('hidden');
    updateAutosaveStatus(saved.savedAt);
  };

  const flattenTasks = () => appState.sections.flatMap(section => section.items);

  const recalcCounts = () => {
    const items = flattenTasks();
    appState.completionCount = items.filter(item => appState.answers[item.id]).length;
    appState.issueCount = items.filter(item => appState.answers[item.id] === 'N').length;
  };

  const showToast = (message, duration = 3000) => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
  };

  const lockModalViewport = () => {
    document.body.classList.add('modal-open');
  };

  const unlockModalViewport = () => {
    if (document.querySelector('.modal:not(.hidden)')) return;
    document.body.classList.remove('modal-open');
  };

  const openModal = modalEl => {
    if (!modalEl) return;

    modalEl.classList.remove('hidden');
    lockModalViewport();
    modalEl.scrollTop = 0;

    const modalContent = modalEl.querySelector('.modal-content');
    if (modalContent) {
      modalContent.scrollTop = 0;
    }

    requestAnimationFrame(() => {
      const focusTarget = modalEl.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus({ preventScroll: true });
      }
    });
  };

  const closeModal = modalEl => {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    unlockModalViewport();
  };

  const openConfirmModal = ({ title = 'Please Confirm', message = 'Are you sure?', confirmLabel = 'Confirm', onConfirm }) => {
    confirmState = onConfirm;
    els.confirmModalTitle.textContent = title;
    els.confirmModalMessage.textContent = message;
    els.confirmModalConfirm.textContent = confirmLabel;
    openModal(els.confirmModal);
  };

  const closeConfirmModal = () => {
    confirmState = null;
    closeModal(els.confirmModal);
  };

  const openQueueExportFlow = () => {
    if (!reportData.length) {
      showToast('No reports available for export.', 3000);
      return;
    }
    openExportOptionsModal({ scope: 'all', source: 'queue', instance: null });
  };

  const openExportOptionsModal = (context = { scope: 'all', source: 'queue', instance: null }) => {
    if (!els.exportDecisionModal) return;
    pendingExportContext = {
      scope: context.scope || 'all',
      source: context.source || 'queue',
      instance: context.instance || null
    };

    let targetRows = [];
    if (pendingExportContext.scope === 'single' && pendingExportContext.instance) {
      targetRows = getRowsByInstance(
        pendingExportContext.source === 'archive' ? archiveData : reportData,
        pendingExportContext.instance
      );
    } else {
      targetRows = reportData;
    }

    const sample = targetRows[0] || {};
    const label = getExportContextLabel(pendingExportContext);

    if (els.exportModalTitle) {
      els.exportModalTitle.textContent = label;
    }

    if (els.exportModalContext) {
      if (pendingExportContext.scope === 'single' && sample.checklistName) {
        els.exportModalContext.textContent = `${sample.checklistName} | ${sample.unit || 'No unit'} | ${sample.date || 'No date'}`;
      } else {
        const total = getInstances(reportData).length;
        els.exportModalContext.textContent = `${total} report${total === 1 ? '' : 's'} currently in queue`;
      }
    }

    els.exportContentMode.value = pendingExportOptions.contentMode;
    els.exportAfterMode.value = pendingExportOptions.afterMode;

    if (pendingExportContext.source === 'archive') {
      els.exportAfterMode.value = 'keep';
      els.exportAfterMode.disabled = true;
    } else {
      els.exportAfterMode.disabled = false;
    }

    openModal(els.exportDecisionModal);
  };

  const closeExportOptionsModal = () => {
    closeModal(els.exportDecisionModal);
  };

  const closeReportDetailModal = () => {
    closeModal(els.reportDetailModal);
  };

  const openReportDetailModal = ({ source = 'queue', instance }) => {
    if (!els.reportDetailModal || !instance) return;

    pendingDetailContext = { source, instance };

    const rows = getRowsByInstance(source === 'archive' ? archiveData : reportData, instance);
    if (!rows.length) {
      showToast('Report detail not found.', 3000);
      return;
    }

    const { sample, issueCount, signed, exportedDate, createdAtDisplay } = getInstanceCardMeta(rows);
    const sections = getSectionBreakdown(rows);
    const issueRows = getIssueRows(rows);

    els.reportDetailTitle.textContent = sample.checklistName || 'Report Detail';
    els.reportDetailContext.textContent = `${source === 'archive' ? 'Archive' : 'Queue'} | ${sample.unit || 'No unit'} | ${sample.date || 'No date'}`;

    els.reportDetailSummary.innerHTML = `
      <div class="report-detail-summary-grid">
        <div class="report-detail-stat">
          <span class="report-detail-label">Date</span>
          <strong>${escapeHtml(exportedDate)}</strong>
        </div>
        <div class="report-detail-stat">
          <span class="report-detail-label">Unit</span>
          <strong>${escapeHtml(sample.unit || 'Not set')}</strong>
        </div>
        <div class="report-detail-stat">
          <span class="report-detail-label">Supervisor</span>
          <strong>${escapeHtml(sample.supervisor || 'Not set')}</strong>
        </div>
        <div class="report-detail-stat">
          <span class="report-detail-label">Status</span>
          <strong>${signed ? 'Signed' : 'Unsigned'}</strong>
        </div>
        <div class="report-detail-stat">
          <span class="report-detail-label">Saved</span>
          <strong>${escapeHtml(createdAtDisplay)}</strong>
        </div>
        <div class="report-detail-stat">
          <span class="report-detail-label">Issues</span>
          <strong>${issueCount}</strong>
        </div>
      </div>
    `;

    els.reportDetailSections.innerHTML = `
      <div class="report-detail-block">
        <h4>Section Breakdown</h4>
        <div class="report-detail-section-list">
          ${sections.map(section => `
            <div class="report-detail-section-card">
              <div class="report-detail-section-top">
                <strong>${escapeHtml(section.section)}</strong>
                <span class="report-queue-badge ${section.issues ? 'has-issues' : 'clear'}">${section.issues ? `${section.issues} issue${section.issues === 1 ? '' : 's'}` : 'Clear'}</span>
              </div>
              <div class="report-detail-section-meta">
                <span>Answered: ${section.answered} / ${section.total}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    els.reportDetailIssues.innerHTML = `
      <div class="report-detail-block">
        <h4>Issues Logged</h4>
        ${issueRows.length ? `
          <div class="report-detail-issue-list">
            ${issueRows.map((row, index) => `
              <div class="report-detail-issue-card">
                <div class="report-detail-issue-top">
                  <strong>Issue ${index + 1}</strong>
                  <span class="issue-status-badge ${row.issueActionRequired ? (row.issueResponsible && row.issueDueDate ? 'action' : 'blocked') : 'logged'}">
                    ${row.issueActionRequired ? (row.issueResponsible && row.issueDueDate ? 'Action Set' : 'Action Needed') : 'Logged'}
                  </span>
                </div>
                <p><strong>Section:</strong> ${escapeHtml(row.section || 'Not set')}</p>
                <p><strong>Task:</strong> ${escapeHtml(row.task || 'Not set')}</p>
                <p><strong>Comment:</strong> ${escapeHtml(row.comment || 'No comment provided')}</p>
                <p><strong>Severity:</strong> ${escapeHtml(row.issueSeverity || 'Not set')}</p>
                <p><strong>Responsible:</strong> ${escapeHtml(row.issueResponsible || 'Not set')}</p>
                <p><strong>Due date:</strong> ${escapeHtml(row.issueDueDate || 'Not set')}</p>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="empty-review">No issues logged for this report.</div>
        `}
      </div>
    `;

    openModal(els.reportDetailModal);
  };

  const clearValidationErrors = () => {
    document.querySelectorAll('.error-message').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.error-highlight').forEach(el => el.classList.remove('error-highlight'));
  };

  const renderProgress = () => {
    const total = flattenTasks().length;
    const pct = total ? Math.round((appState.completionCount / total) * 100) : 0;
    els.progressBar.style.setProperty('--progress-width', `${pct}%`);
    els.progressBar.classList.remove('red', 'amber', 'green');
    if (pct <= 49) els.progressBar.classList.add('red');
    else if (pct <= 80) els.progressBar.classList.add('amber');
    else els.progressBar.classList.add('green');
    if (els.progressText) els.progressText.textContent = `${pct}% Progress`;
  };

  const renderRunnerSummary = () => {
    const totalTasks = flattenTasks().length;
    els.summarySection.textContent = appState.sections.length ? `${appState.currentSectionIndex + 1} / ${appState.sections.length}` : '0 / 0';
    els.summaryCompletion.textContent = `${appState.completionCount} / ${totalTasks}`;
    els.summaryIssues.textContent = String(appState.issueCount);
    renderProgress();
  };

  const getCurrentSection = () => appState.sections[appState.currentSectionIndex] || null;
  const getUnansweredInCurrentSection = () => {
    const section = getCurrentSection();
    if (!section) return [];
    return section.items.filter(item => !appState.answers[item.id]);
  };

  const focusSectionItem = itemId => {
    const item = els.checklistContainer.querySelector(`[data-task-id="${itemId}"]`);
    if (!item) return;
    item.classList.add('section-item-focus');
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => item.classList.remove('section-item-focus'), 1200);
  };

  const setSectionUnansweredFilter = enabled => {
    appState.sectionFilterUnanswered = enabled;
    const checklist = els.checklistContainer.querySelector('.section-checklist');
    if (checklist) checklist.classList.toggle('filter-unanswered', enabled);
    const unansweredCount = getUnansweredInCurrentSection().length;
    if (els.sectionShowUnanswered) {
      els.sectionShowUnanswered.textContent = enabled ? 'Show all items' : `Show unanswered (${unansweredCount})`;
      els.sectionShowUnanswered.disabled = unansweredCount === 0 && !enabled;
      els.sectionShowUnanswered.style.display = unansweredCount > 0 || enabled ? 'inline-flex' : 'none';
    }
  };

  const renderSectionGuidance = ({ answered, total, issues, unanswered }) => {
    if (!els.sectionGuidanceBanner || !els.sectionGuidanceText) return;
    const banner = els.sectionGuidanceBanner;
    banner.classList.remove('is-complete', 'is-warning');
    if (unanswered === 0) {
      banner.classList.add('is-complete');
      els.sectionGuidanceText.textContent = `Section complete: all ${total} questions answered.`;
    } else {
      banner.classList.add('is-warning');
      els.sectionGuidanceText.textContent = `${unanswered} unanswered item${unanswered === 1 ? '' : 's'} in this section. Answer before moving on to reduce missed content.`;
    }
    const prompt = unanswered > 0
      ? `Answered ${answered} of ${total}. ${issues} issue${issues === 1 ? '' : 's'} flagged.`
      : `Answered ${answered} of ${total}. ${issues} issue${issues === 1 ? '' : 's'} flagged for review.`;
    banner.setAttribute('aria-label', prompt);
    setSectionUnansweredFilter(appState.sectionFilterUnanswered);
  };

  const confirmSectionExitIfNeeded = onConfirm => {
    const unanswered = getUnansweredInCurrentSection();
    if (!unanswered.length) {
      onConfirm();
      return;
    }
    showToast(`${unanswered.length} unanswered item${unanswered.length === 1 ? '' : 's'} in this section.`, 2500);
    openConfirmModal({
      title: 'Leave section with unanswered items?',
      message: `${unanswered.length} question${unanswered.length === 1 ? ' is' : 's are'} still unanswered. You can stay to finish or leave now and review later.`,
      confirmLabel: 'Leave Section',
      onConfirm: () => {
        appState.sectionFilterUnanswered = false;
        onConfirm();
      }
    });
  };

  const getTaskById = itemId => flattenTasks().find(item => item.id === itemId) || null;

  const createIssueId = () => {
    const rand = Math.random().toString(36).slice(2, 8);
    return `iss_${Date.now().toString(36)}_${rand}`;
  };

  const getIssueRecordByTaskId = itemId => {
    const issueId = appState.issueIdByTask[itemId];
    if (!issueId) return null;
    return appState.issuesById[issueId] || null;
  };

  const ensureIssueRecord = (itemId, { create = true } = {}) => {
    const existing = getIssueRecordByTaskId(itemId);
    if (existing || !create) return existing;
    const task = getTaskById(itemId);
    const now = new Date().toISOString();
    const id = createIssueId();
    const record = {
      id,
      modelVersion: ISSUE_MODEL_VERSION,
      itemId,
      task: task?.task || '',
      section: task?.section || '',
      actionRequired: false,
      severity: '',
      responsible: '',
      dueDate: '',
      createdAt: now,
      updatedAt: now
    };
    appState.issuesById[id] = record;
    appState.issueIdByTask[itemId] = id;
    return record;
  };

  const clearIssueForTask = itemId => {
    const issueId = appState.issueIdByTask[itemId];
    if (!issueId) return;
    delete appState.issueIdByTask[itemId];
    delete appState.issuesById[issueId];
  };

  const getIssueMeta = itemId => {
    const raw = getIssueRecordByTaskId(itemId);
    return {
      severity: raw?.severity || '',
      actionRequired: Boolean(raw?.actionRequired),
      responsible: raw?.responsible || '',
      dueDate: raw?.dueDate || ''
    };
  };

  const setIssueMeta = (itemId, partial) => {
    const record = ensureIssueRecord(itemId, { create: appState.answers[itemId] === 'N' || Boolean(partial.actionRequired || partial.severity || partial.responsible || partial.dueDate) });
    if (!record) return;
    const next = {
      ...record,
      ...partial
    };
    next.actionRequired = Boolean(next.actionRequired);
    next.severity = next.severity || '';
    next.responsible = next.responsible || '';
    next.dueDate = next.dueDate || '';
    next.updatedAt = new Date().toISOString();
    appState.issuesById[record.id] = next;
  };

  const getIssueStatus = itemId => {
    const answer = appState.answers[itemId];
    if (answer !== 'N') return { label: 'Clear', tone: 'clear' };
    const comment = appState.comments[itemId] || '';
    const meta = getIssueMeta(itemId);
    if (meta.actionRequired && (!meta.responsible.trim() || !meta.dueDate)) {
      return { label: 'Action Needed', tone: 'blocked' };
    }
    if (meta.actionRequired && meta.responsible.trim() && meta.dueDate) {
      return { label: 'Action Set', tone: 'action' };
    }
    if (comment.trim() || meta.severity) {
      return { label: 'Logged', tone: 'logged' };
    }
    return { label: 'Details Missing', tone: 'blocked' };
  };

  const refreshIssueStatusUI = itemId => {
    const status = getIssueStatus(itemId);
    document.querySelectorAll(`[data-issue-status="${itemId}"]`).forEach(el => {
      el.textContent = status.label;
      el.classList.remove('clear', 'blocked', 'action', 'logged');
      el.classList.add(status.tone);
    });
    const meta = getIssueMeta(itemId);
    document.querySelectorAll(`[data-issue-responsible="${itemId}"], [data-issue-due-date="${itemId}"]`).forEach(input => {
      input.disabled = !meta.actionRequired;
    });
  };

  const getSectionStatus = section => {
    const total = section.items.length;
    const answered = section.items.filter(item => appState.answers[item.id]).length;
    const issues = section.items.filter(item => appState.answers[item.id] === 'N').length;
    let state = 'not started';
    let tone = 'not-started';
    if (issues > 0) {
      state = 'has issue';
      tone = 'issue';
    } else if (answered === 0) {
      state = 'not started';
      tone = 'not-started';
    } else if (answered === total) {
      state = 'complete';
      tone = 'complete';
    } else {
      state = 'in progress';
      tone = 'progress';
    }
    return { total, answered, issues, state, tone };
  };

  const renderSectionNavigator = () => {
    els.sectionDrawerList.innerHTML = appState.sections.map((section, index) => {
      const status = getSectionStatus(section);
      const classes = ['section-jump-card', status.tone];
      if (status.issues > 0) classes.push('has-issue');
      if (status.answered === status.total && status.total > 0 && status.issues === 0) classes.push('is-complete');
      if (status.answered === 0) classes.push('not-started');
      if (index === appState.currentSectionIndex) classes.push('is-active');
      return `
        <button type="button" class="${classes.join(' ')}" data-jump-section="${index}">
          <div class="section-jump-top">
            <div>
              <span class="runner-kicker">Section ${index + 1}</span>
              <span class="section-jump-title">${section.title}</span>
            </div>
            <span class="section-jump-state ${status.tone}">${status.state}</span>
          </div>
          <div class="section-jump-stats">
            <div class="section-jump-stat">
              <span class="section-jump-stat-label">Total</span>
              <strong>${status.total}</strong>
            </div>
            <div class="section-jump-stat">
              <span class="section-jump-stat-label">Answered</span>
              <strong>${status.answered}</strong>
            </div>
            <div class="section-jump-stat">
              <span class="section-jump-stat-label">Issues</span>
              <strong>${status.issues}</strong>
            </div>
          </div>
        </button>
      `;
    }).join('');
  };

  const openSectionDrawer = () => {
    renderSectionNavigator();
    els.sectionDrawer.classList.remove('hidden');
    els.sectionDrawer.setAttribute('aria-hidden', 'false');
  };

  const closeSectionDrawer = () => {
    els.sectionDrawer.classList.add('hidden');
    els.sectionDrawer.setAttribute('aria-hidden', 'true');
  };

  const renderChecklistItem = (item, itemIndex) => {
    const value = appState.answers[item.id] || '';
    const comment = appState.comments[item.id] || '';
    const commentRequired = value === 'N';
    const missingComment = commentRequired && !comment.trim();
    const issueMeta = getIssueMeta(item.id);
    const issueStatus = getIssueStatus(item.id);
    const issueRecord = getIssueRecordByTaskId(item.id);
    const classes = ['checklist-item'];
    let statusLabel = 'Incomplete';
    if (value === 'N') {
      classes.push('is-issue');
      if (missingComment) classes.push('needs-comment');
      statusLabel = 'Issue';
    } else if (value) {
      classes.push('is-complete');
      statusLabel = 'Answered';
    } else {
      classes.push('is-incomplete');
    }
    return `
      <div class="${classes.join(' ')}" data-task-id="${item.id}">
        <div class="checklist-item-head">
          <div class="checklist-item-head-main">
            <span class="task-number">Item ${itemIndex + 1}</span>
            <span class="task-description">${item.task}</span>
          </div>
          <div class="checklist-item-statuses">
            ${value === 'N' ? `<span class="issue-status-badge ${issueStatus.tone}" data-issue-status="${item.id}">${issueStatus.label}</span>` : ''}
            <span class="item-status">${statusLabel}</span>
          </div>
        </div>
        <div class="answer-segmented" role="radiogroup" aria-label="${item.task}">
          <label class="answer-chip ${value === 'Y' ? 'selected yes' : ''}">
            <input type="radio" name="${item.id}" value="Y" ${value === 'Y' ? 'checked' : ''}>
            <span>Yes</span>
          </label>
          <label class="answer-chip ${value === 'N' ? 'selected no' : ''}">
            <input type="radio" name="${item.id}" value="N" ${value === 'N' ? 'checked' : ''}>
            <span>No</span>
          </label>
          <label class="answer-chip ${value === 'NA' ? 'selected na' : ''}">
            <input type="radio" name="${item.id}" value="NA" ${value === 'NA' ? 'checked' : ''}>
            <span>N/A</span>
          </label>
        </div>
        <div class="comments-container ${commentRequired ? '' : 'hidden'}">
          <span class="comment-required ${commentRequired ? '' : 'hidden'}">Please Explain</span>
          ${issueRecord ? `<p class="issue-reference">Issue ID ${issueRecord.id} | Created ${new Date(issueRecord.createdAt).toLocaleString()}</p>` : ''}
          <textarea class="comments-input" name="comment_${item.id}" ${commentRequired ? '' : 'disabled'}>${comment}</textarea>
          <div class="issue-meta-grid">
            <label class="issue-meta-field">
              <span>Severity</span>
              <select class="issue-meta-input" data-issue-severity="${item.id}">
                <option value="">Select severity</option>
                <option value="Low" ${issueMeta.severity === 'Low' ? 'selected' : ''}>Low</option>
                <option value="Medium" ${issueMeta.severity === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="High" ${issueMeta.severity === 'High' ? 'selected' : ''}>High</option>
                <option value="Critical" ${issueMeta.severity === 'Critical' ? 'selected' : ''}>Critical</option>
              </select>
            </label>
            <label class="issue-meta-toggle">
              <input type="checkbox" data-issue-action-required="${item.id}" ${issueMeta.actionRequired ? 'checked' : ''}>
              <span>Action required</span>
            </label>
            <label class="issue-meta-field">
              <span>Responsible</span>
              <input type="text" class="issue-meta-input" data-issue-responsible="${item.id}" value="${escapeAttr(issueMeta.responsible)}" placeholder="Optional name" ${issueMeta.actionRequired ? '' : 'disabled'}>
            </label>
            <label class="issue-meta-field">
              <span>Due date</span>
              <input type="date" class="issue-meta-input" data-issue-due-date="${item.id}" value="${escapeAttr(issueMeta.dueDate)}" ${issueMeta.actionRequired ? '' : 'disabled'}>
            </label>
          </div>
        </div>
      </div>
    `;
  };

  const renderSectionStage = () => {
    const section = getCurrentSection();
    if (!section) {
      els.checklistContainer.innerHTML = '<div class="empty-review">No checklist loaded.</div>';
      return;
    }
    const answered = section.items.filter(item => appState.answers[item.id]).length;
    const issueCount = section.items.filter(item => appState.answers[item.id] === 'N').length;
    const unansweredCount = section.items.length - answered;
    if (unansweredCount === 0 && appState.sectionFilterUnanswered) appState.sectionFilterUnanswered = false;
    const checklistName = checklistMetadata[appState.checklistId]?.title || appState.checklistId || 'Checklist';
    els.sectionKicker.textContent = `Section ${appState.currentSectionIndex + 1} of ${appState.sections.length}`;
    els.sectionTitle.textContent = section.title;
    els.sectionMeta.textContent = `${answered} of ${section.items.length} answered${unansweredCount ? ` (${unansweredCount} unanswered)` : ''}`;
    els.mobileChecklistTitle.textContent = checklistName;
    els.questionProgress.textContent = `${answered} / ${section.items.length}`;
    els.answeredCount.textContent = String(appState.completionCount);
    els.sectionIssues.textContent = String(issueCount);
    els.issueBadge.textContent = `${appState.issueCount} issue${appState.issueCount === 1 ? '' : 's'}`;
    els.issueBadge.classList.toggle('is-clear', appState.issueCount === 0);
    els.checklistContainer.innerHTML = `<div class="section-checklist ${appState.sectionFilterUnanswered ? 'filter-unanswered' : ''}">${section.items.map((item, index) => renderChecklistItem(item, index)).join('')}</div>`;
    els.sectionPrev.disabled = appState.currentSectionIndex === 0;
    els.sectionNext.textContent = appState.currentSectionIndex === appState.sections.length - 1 ? 'Finish Sections' : 'Next Section';
    els.sectionPrevSticky.disabled = els.sectionPrev.disabled;
    els.sectionNextSticky.textContent = appState.currentSectionIndex === appState.sections.length - 1 ? 'Finish' : 'Next';
    renderSectionGuidance({
      answered,
      total: section.items.length,
      issues: issueCount,
      unanswered: unansweredCount
    });
    renderSectionNavigator();
  };

  const renderIssuesStage = () => {
    const issues = flattenTasks().filter(item => appState.answers[item.id] === 'N');
    const unresolved = issues.filter(item => !(appState.comments[item.id] || '').trim()).length;
    const actionsRequired = issues.filter(item => getIssueMeta(item.id).actionRequired).length;
    els.issuesSummary.textContent = issues.length
      ? `${issues.length} issue${issues.length === 1 ? '' : 's'} need review. ${actionsRequired} action-required. ${unresolved ? `${unresolved} missing comment${unresolved === 1 ? '' : 's'}.` : 'All issue comments captured.'}`
      : 'No issues recorded.';
    els.issuesReview.innerHTML = issues.length ? issues.map(item => {
      const sectionIndex = appState.sections.findIndex(section => section.title === item.section);
      const comment = appState.comments[item.id] || '';
      const hasComment = Boolean(comment.trim());
      const issueMeta = getIssueMeta(item.id);
      const issueStatus = getIssueStatus(item.id);
      const issueRecord = getIssueRecordByTaskId(item.id);
      return `
        <article class="review-card issue-review-card ${hasComment ? '' : 'issue-review-card-warning'}" data-issue-item="${item.id}">
          <div class="issue-review-head">
            <h4>${item.section}</h4>
            <span class="issue-status-badge ${issueStatus.tone}" data-issue-status="${item.id}">${issueStatus.label}</span>
          </div>
          ${issueRecord ? `<p class="issue-reference">Issue ID ${issueRecord.id} | Created ${new Date(issueRecord.createdAt).toLocaleString()}</p>` : ''}
          <p>${item.task}</p>
          <p class="review-answer issue">Answer: ${appState.answers[item.id]}</p>
          <label class="issue-review-label" for="issue-comment-${item.id}">Issue comment</label>
          <textarea id="issue-comment-${item.id}" class="issue-review-input" data-issue-comment="${item.id}">${comment}</textarea>
          <div class="issue-review-meta-grid">
            <label class="issue-meta-field">
              <span>Severity</span>
              <select class="issue-meta-input" data-issue-severity="${item.id}">
                <option value="">Select severity</option>
                <option value="Low" ${issueMeta.severity === 'Low' ? 'selected' : ''}>Low</option>
                <option value="Medium" ${issueMeta.severity === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="High" ${issueMeta.severity === 'High' ? 'selected' : ''}>High</option>
                <option value="Critical" ${issueMeta.severity === 'Critical' ? 'selected' : ''}>Critical</option>
              </select>
            </label>
            <label class="issue-meta-toggle">
              <input type="checkbox" data-issue-action-required="${item.id}" ${issueMeta.actionRequired ? 'checked' : ''}>
              <span>Action required</span>
            </label>
            <label class="issue-meta-field">
              <span>Responsible</span>
              <input type="text" class="issue-meta-input" data-issue-responsible="${item.id}" value="${escapeAttr(issueMeta.responsible)}" placeholder="Optional name" ${issueMeta.actionRequired ? '' : 'disabled'}>
            </label>
            <label class="issue-meta-field">
              <span>Due date</span>
              <input type="date" class="issue-meta-input" data-issue-due-date="${item.id}" value="${escapeAttr(issueMeta.dueDate)}" ${issueMeta.actionRequired ? '' : 'disabled'}>
            </label>
          </div>
          <p class="issue-review-warning ${hasComment ? 'hidden' : ''}" data-issue-warning="${item.id}">Comment required before final review.</p>
          <div class="issue-review-actions">
            <button type="button" class="review-jump" data-section-index="${sectionIndex}" data-item-id="${item.id}">Open Item</button>
            <button type="button" class="review-jump" data-section-index="${sectionIndex}" data-item-id="${item.id}" data-focus-comment="true">Edit In Section</button>
          </div>
        </article>
      `;
    }).join('') : '<div class="empty-review">No issues recorded. You can continue to final review.</div>';
  };

  const getFinalReviewStatus = () => {
    syncMetadataFromInputs();
    const metadataLabels = {
      date: 'Date',
      supervisor: 'Team Leader / Manager',
      cleanerTeam: 'Team Member Leading Task',
      unitArea: 'Unit/Area'
    };
    const missingMetadata = Object.entries(appState.metadata)
      .filter(([, value]) => !String(value || '').trim())
      .map(([key]) => metadataLabels[key] || key);
    const unansweredItems = flattenTasks().filter(item => !appState.answers[item.id]);
    const missingCommentItems = flattenTasks().filter(item => appState.answers[item.id] === 'N' && !(appState.comments[item.id] || '').trim());
    const sectionSummaries = appState.sections.map((section, index) => {
      const answered = section.items.filter(item => appState.answers[item.id]).length;
      const unanswered = section.items.length - answered;
      const issues = section.items.filter(item => appState.answers[item.id] === 'N').length;
      const missingIssueComments = section.items.filter(
        item => appState.answers[item.id] === 'N' && !(appState.comments[item.id] || '').trim()
      ).length;
      const issuesRequiringAction = section.items.filter(
        item => appState.answers[item.id] === 'N' && getIssueMeta(item.id).actionRequired
      ).length;
      const ready = unanswered === 0 && missingIssueComments === 0;
      return {
        index,
        title: section.title,
        total: section.items.length,
        answered,
        unanswered,
        issues,
        missingIssueComments,
        issuesRequiringAction,
        ready
      };
    });
    const sectionsReadyCount = sectionSummaries.filter(section => section.ready).length;
    const sectionsNeedingActionCount = sectionSummaries.length - sectionsReadyCount;
    const issuesRequiringActionCount = sectionSummaries.reduce((sum, section) => sum + section.issuesRequiringAction, 0);
    return {
      missingMetadata,
      unansweredCount: unansweredItems.length,
      missingCommentCount: missingCommentItems.length,
      unresolvedCount: unansweredItems.length + missingCommentItems.length,
      issueCount: appState.issueCount,
      sectionSummaries,
      sectionsReadyCount,
      sectionsNeedingActionCount,
      issuesRequiringActionCount,
      ready: missingMetadata.length === 0 && unansweredItems.length === 0 && missingCommentItems.length === 0
    };
  };

  const renderFinalStage = () => {
    const checklistName = checklistMetadata[appState.checklistId]?.title || appState.checklistId || 'Checklist';
    const status = getFinalReviewStatus();
    const totalItems = flattenTasks().length;
    els.finalSummary.textContent = `${checklistName}: ${appState.completionCount} of ${totalItems} answered, ${status.sectionsNeedingActionCount} section${status.sectionsNeedingActionCount === 1 ? '' : 's'} need action.`;
    els.finalValidationSummary.innerHTML = `
      <article class="review-card final-status-card final-readiness-panel ${status.ready ? 'is-ready' : 'is-blocked'}">
        <div class="final-readiness-top">
          <h4>Readiness Control Panel</h4>
          <span class="final-readiness-badge ${status.ready ? 'ready' : 'blocked'}">${status.ready ? 'Ready' : 'Blocked'}</span>
        </div>
        <div class="final-readiness-metrics">
          <div class="final-metric">
            <span class="final-metric-label">Sections Ready</span>
            <strong>${status.sectionsReadyCount} / ${appState.sections.length}</strong>
          </div>
          <div class="final-metric">
            <span class="final-metric-label">Unanswered Items</span>
            <strong>${status.unansweredCount}</strong>
          </div>
          <div class="final-metric">
            <span class="final-metric-label">Issues Flagged</span>
            <strong>${status.issueCount}</strong>
          </div>
          <div class="final-metric">
            <span class="final-metric-label">Issues Requiring Action</span>
            <strong>${status.issuesRequiringActionCount}</strong>
          </div>
        </div>
        <p class="final-status-text ${status.ready ? 'ready' : 'blocked'}">${status.ready ? 'Ready for signature and report queue.' : 'Signature blocked until unanswered items, action items, and required fields are cleared.'}</p>
        <p>Missing required fields: ${status.missingMetadata.length ? status.missingMetadata.join(', ') : 'None'}</p>
        <p>Missing issue comments: ${status.missingCommentCount}</p>
      </article>
    `;
    const renderSectionCard = section => `
      <article class="review-card section-review-card ${section.ready ? 'is-ready' : 'is-blocked'}">
        <h4>${section.index + 1}. ${section.title}</h4>
        <p>Answered: ${section.answered} / ${section.total}</p>
        <p>Unanswered: ${section.unanswered}</p>
        <p>Issues: ${section.issues}</p>
        <p>Missing issue comments: ${section.missingIssueComments}</p>
        <p>Issues requiring action: ${section.issuesRequiringAction}</p>
        <button type="button" class="review-jump" data-section-index="${section.index}">${section.ready ? 'View Section' : 'Fix Section'}</button>
      </article>
    `;
    const actionSections = status.sectionSummaries.filter(section => !section.ready);
    const readySections = status.sectionSummaries.filter(section => section.ready);
    const metadataCard = `
      <article class="review-card">
        <h4>Checklist Details</h4>
        <p>Date: ${appState.metadata.date || 'Not set'}</p>
        <p>Team Leader / Manager: ${appState.metadata.supervisor || 'Not set'}</p>
        <p>Team Member Leading Task: ${appState.metadata.cleanerTeam || 'Not set'}</p>
        <p>Unit/Area: ${appState.metadata.unitArea || 'Not set'}</p>
      </article>
    `;
    const sectionGroups = `
      <details class="final-summary-disclosure final-section-group final-section-group-action">
        <summary>
          <span>Sections Needing Action</span>
          <span class="final-summary-count">${actionSections.length}</span>
        </summary>
        <div class="final-summary-panel">
          ${actionSections.length ? actionSections.map(renderSectionCard).join('') : '<div class="empty-review">No sections need action.</div>'}
        </div>
      </details>
      <details class="final-summary-disclosure final-section-group final-section-group-ready">
        <summary>
          <span>Ready Sections</span>
          <span class="final-summary-count">${readySections.length}</span>
        </summary>
        <div class="final-summary-panel">
          ${readySections.length ? readySections.map(renderSectionCard).join('') : '<div class="empty-review">No sections are fully ready yet.</div>'}
        </div>
      </details>
    `;
    els.finalReview.innerHTML = metadataCard + sectionGroups;
    els.finalProceedSignature.disabled = !status.ready;
  };

  const updateViewportOffsets = () => {
    const progressBar = document.querySelector('.progress-container');
    const progressOffset = progressBar ? progressBar.offsetHeight : 44;
    document.documentElement.style.setProperty('--progress-offset', `${progressOffset}px`);
    return progressOffset;
  };

  const scrollRunnerViewportToTop = () => {
    const progressOffset = updateViewportOffsets();

    const anchor = document.getElementById('runner-scroll-anchor');
    if (!anchor) return;

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }

    const stickyHeader = document.querySelector('.runner-mobile-header');
    const stickyHeaderHeight = stickyHeader ? stickyHeader.offsetHeight : 0;
    const extraGap = 10;

    const anchorTop = anchor.getBoundingClientRect().top + window.pageYOffset;
    const targetTop = Math.max(0, anchorTop - progressOffset - stickyHeaderHeight - extraGap);

    window.scrollTo(0, targetTop);
  };

  const setRunnerStage = (stage, { persist = true } = {}) => {
    const previousStage = appState.runnerStage;
    appState.runnerStage = stage;
    if (stage === 'section' && previousStage !== 'section') appState.sectionFilterUnanswered = false;
    if (stage !== 'section') closeSectionDrawer();
    document.querySelectorAll('[data-stage-panel]').forEach(panel => {
      panel.classList.toggle('hidden', panel.dataset.stagePanel !== stage);
    });
    document.querySelectorAll('[data-stage-chip]').forEach(chip => {
      const i = STAGES.indexOf(chip.dataset.stageChip);
      const current = STAGES.indexOf(stage);
      chip.classList.toggle('active', chip.dataset.stageChip === stage);
      chip.classList.toggle('complete', i < current);
    });
    renderRunnerSummary();
    if (stage === 'section') renderSectionStage();
    if (stage === 'issues') renderIssuesStage();
    if (stage === 'final') renderFinalStage();
    if (persist && autosaveEnabled && previousStage !== stage) saveProgress({ silent: true });

    if (stage === 'section' || stage === 'issues' || stage === 'final') {
      requestAnimationFrame(() => {
        scrollRunnerViewportToTop();
      });
    }
  };

  const renderFromState = () => {
    recalcCounts();
    renderRunnerSummary();
    if (appState.runnerStage === 'section') renderSectionStage();
    if (appState.runnerStage === 'issues') renderIssuesStage();
    if (appState.runnerStage === 'final') renderFinalStage();
  };

  const validateMetadata = () => {
    clearValidationErrors();
    for (const [id] of metaFieldMap) {
      const field = document.getElementById(id);
      const error = document.getElementById(`error-${id}`);
      if (!field.value.trim()) {
        field.classList.add('error-highlight');
        if (error) {
          error.textContent = `${field.labels[0].textContent} is required.`;
          error.classList.remove('hidden');
        }
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        field.focus();
        return false;
      }
    }
    return true;
  };

  const validateAnswers = () => {
    if (!validateMetadata()) return false;
    const incomplete = flattenTasks().find(item => !appState.answers[item.id]);
    if (incomplete) {
      appState.currentSectionIndex = appState.sections.findIndex(section => section.title === incomplete.section);
      setRunnerStage('section');
      const el = els.checklistContainer.querySelector(`[data-task-id="${incomplete.id}"]`);
      if (el) {
        el.classList.add('error-highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }
    const missingComment = flattenTasks().find(item => appState.answers[item.id] === 'N' && !(appState.comments[item.id] || '').trim());
    if (missingComment) {
      appState.currentSectionIndex = appState.sections.findIndex(section => section.title === missingComment.section);
      setRunnerStage('section');
      const el = els.checklistContainer.querySelector(`[name="comment_${missingComment.id}"]`);
      if (el) {
        el.classList.add('error-highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
      return false;
    }
    return true;
  };

  const resizeCanvas = () => {
    if (!signaturePad) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    els.signaturePadCanvas.width = els.signaturePadCanvas.offsetWidth * ratio;
    els.signaturePadCanvas.height = els.signaturePadCanvas.offsetHeight * ratio;
    els.signaturePadCanvas.getContext('2d').scale(ratio, ratio);
    signaturePad.clear();
  };

  const openSignatureModal = () => {
    els.signatureError.classList.add('hidden');
    els.signaturePadCanvas.classList.remove('error-highlight');
    openModal(els.signatureModal);
    resizeCanvas();
  };

  const closeSignatureModal = () => {
    closeModal(els.signatureModal);
    if (signaturePad) signaturePad.clear();
  };

  const updateChecklistTitle = id => {
    const title = checklistMetadata[id]?.title || 'Unknown Checklist';
    els.checklistTitle.textContent = title;
    if (els.selectedChecklistPreview) {
      els.selectedChecklistPreview.textContent = title;
    }
  };

  const parseChecklistData = rows => {
    const sections = [];
    let current = null;
    let taskIndex = 0;

    rows.forEach((row, rowIndex) => {
      const sectionName = (row.section || '').trim();
      const task = (row.task || '').trim();
      if (!sectionName || !task) return;

      if (!current || current.title !== sectionName) {
        current = {
          id: `section_${sections.length}`,
          title: sectionName,
          sectionOrder: sections.length,
          items: []
        };
        sections.push(current);
      }

      current.items.push({
        id: `task_${taskIndex}`,
        task,
        section: sectionName,
        csvOrder: rowIndex
      });

      taskIndex += 1;
    });

    sections.forEach(section => {
      section.items.sort((a, b) => a.csvOrder - b.csvOrder);
    });

    return sections;
  };

  const loadChecklist = id => {
    appState.checklistId = id;
    appState.checklistSource = checklistMetadata[id]?.source || 'built-in';
    updateChecklistTitle(id);

    const applyLoadedRows = rows => {
      appState.sections = parseChecklistData(rows || []);
      appState.answers = {};
      appState.comments = {};
      appState.issuesById = {};
      appState.issueIdByTask = {};
      appState.currentSectionIndex = 0;
      recalcCounts();
      applyRememberedDefaults();
      setRunnerStage('setup');
      updateResumeBanner();
    };

    if (appState.checklistSource === 'custom') {
      const record = customChecklistCache[id];

      if (!record) {
        console.error('Custom checklist missing:', id);
        appState.sections = [];
        appState.answers = {};
        appState.comments = {};
        appState.issuesById = {};
        appState.issueIdByTask = {};
        renderFromState();
        els.checklistContainer.innerHTML = '<div class="empty-review">Could not load custom checklist.</div>';
        return;
      }

      applyLoadedRows(convertCustomChecklistToRows(record));
      return;
    }

    fetch(`checks/${id}.csv`)
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.text();
      })
      .then(txt => {
        Papa.parse(txt, {
          header: true,
          complete: result => {
            applyLoadedRows(result.data || []);
          }
        });
      })
      .catch(error => {
        console.error('Load error:', error);
        appState.sections = [];
        appState.answers = {};
        appState.comments = {};
        appState.issuesById = {};
        appState.issueIdByTask = {};
        renderFromState();
        els.checklistContainer.innerHTML = '<div class="empty-review">Could not load checklist.</div>';
      });
  };

  const collectReportRows = signatureDataUrl => {
    const checklistId = appState.checklistId;
    const checklistName = checklistMetadata[checklistId]?.title || checklistId;
    const instance = new Date().toISOString().replace(/[:\-]/g, '').replace(/\..+$/, '');
    return flattenTasks().map(item => ({
      checklistId,
      checklistName,
      instance,
      date: appState.metadata.date,
      supervisor: appState.metadata.supervisor,
      cleaner: appState.metadata.cleanerTeam,
      unit: appState.metadata.unitArea,
      section: item.section,
      task: item.task,
      value: appState.answers[item.id] || '',
      comment: appState.comments[item.id] || '',
      exportSchemaVersion: ISSUE_MODEL_VERSION,
      issue: (() => {
        const issue = getIssueRecordByTaskId(item.id);
        return issue ? {
          id: issue.id,
          itemId: issue.itemId,
          section: issue.section,
          task: issue.task,
          actionRequired: Boolean(issue.actionRequired),
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
          severity: issue.severity || '',
          responsible: issue.responsible || '',
          dueDate: issue.dueDate || ''
        } : null;
      })(),
      issueSeverity: getIssueMeta(item.id).severity,
      issueActionRequired: getIssueMeta(item.id).actionRequired,
      issueResponsible: getIssueMeta(item.id).responsible,
      issueDueDate: getIssueMeta(item.id).dueDate,
      signatureDataUrl
    }));
  };

  const getInstances = rows => Array.from(new Set(rows.map(r => r.instance)));

  const getRowsByInstance = (rows, instance) => rows.filter(r => r.instance === instance);

  const sortInstancesNewestFirst = instances => [...instances].sort((a, b) => String(b).localeCompare(String(a)));

  const getExportContextLabel = context => {
    if (context.source === 'archive' && context.scope === 'single') return 'Archived report export';
    if (context.source === 'queue' && context.scope === 'single') return 'Single report export';
    return 'Export queue';
  };

  const getSectionBreakdown = rows => {
    const sectionMap = {};
    rows.forEach(row => {
      if (!sectionMap[row.section]) {
        sectionMap[row.section] = {
          total: 0,
          issues: 0,
          answered: 0
        };
      }
      sectionMap[row.section].total += 1;
      if (row.value) sectionMap[row.section].answered += 1;
      if (row.value === 'N') sectionMap[row.section].issues += 1;
    });
    return Object.entries(sectionMap).map(([section, stats]) => ({
      section,
      ...stats
    }));
  };

  const getIssueRows = rows => rows.filter(row => row.value === 'N');

  const getInstanceSummary = rows => {
    const sample = rows[0] || {};
    const issueCount = rows.filter(r => r.value === 'N').length;
    const signed = rows.some(r => r.signatureDataUrl);
    return {
      sample,
      issueCount,
      signed,
      isClear: issueCount === 0
    };
  };

  const matchesReportFilter = (summary, filterValue) => {
    if (filterValue === 'issues') return summary.issueCount > 0;
    if (filterValue === 'clear') return summary.issueCount === 0;
    if (filterValue === 'signed') return summary.signed;
    if (filterValue === 'unsigned') return !summary.signed;
    return true;
  };

  const matchesReportSearch = (summary, searchValue) => {
    const needle = String(searchValue || '').trim().toLowerCase();
    if (!needle) return true;
    const haystack = [
      summary.sample.checklistName,
      summary.sample.unit,
      summary.sample.supervisor,
      summary.sample.date
    ].join(' ').toLowerCase();
    return haystack.includes(needle);
  };

  const getFilterLabel = (scope, state) => {
    const base = scope === 'archive' ? 'archived reports' : 'queue reports';
    const filterMap = {
      all: `All ${base}`,
      issues: 'Issues only',
      clear: 'Clear only',
      signed: 'Signed only',
      unsigned: 'Unsigned only'
    };

    const filterText = filterMap[state.filter || 'all'] || `All ${base}`;
    const searchText = String(state.search || '').trim();

    return searchText ? `${filterText} | Search: ${searchText}` : filterText;
  };

  const updateFilterStripSummary = (scope) => {
    if (scope === 'archive') {
      if (els.archiveFilterSummary) {
        els.archiveFilterSummary.textContent = getFilterLabel('archive', archiveViewState);
      }
      return;
    }

    if (els.queueFilterSummary) {
      els.queueFilterSummary.textContent = getFilterLabel('queue', queueViewState);
    }
  };

  const getFilteredInstances = (rows, state) => {
    return sortInstancesNewestFirst(getInstances(rows)).filter(instance => {
      const summary = getInstanceSummary(getRowsByInstance(rows, instance));
      return matchesReportFilter(summary, state.filter) && matchesReportSearch(summary, state.search);
    });
  };

  const escapeHtml = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const syncTileActiveState = (scope, activeFilter) => {
    const root = scope === 'archive' ? els.archiveDashboardTiles : els.queueDashboardTiles;
    if (!root) return;
    root.querySelectorAll('[data-filter-value]').forEach(tile => {
      tile.classList.toggle('is-active', tile.dataset.filterValue === activeFilter);
    });
  };

  const applyReportTileFilter = (scope, filterValue = 'all') => {
    if (scope === 'archive') {
      archiveViewState.filter = filterValue;
      if (els.archiveFilter) els.archiveFilter.value = filterValue;
      syncTileActiveState('archive', filterValue);
      updateFilterStripSummary('archive');
      renderArchiveList();
      return;
    }

    queueViewState.filter = filterValue;
    if (els.queueFilter) els.queueFilter.value = filterValue;
    syncTileActiveState('queue', filterValue);
    updateFilterStripSummary('queue');
    renderReportList();
  };

  const updateDashboardTiles = () => {
    const queueInstances = getInstances(reportData);
    const archiveInstances = getInstances(archiveData);

    const queueSummaries = queueInstances.map(instance => getInstanceSummary(getRowsByInstance(reportData, instance)));
    const archiveSummaries = archiveInstances.map(instance => getInstanceSummary(getRowsByInstance(archiveData, instance)));

    if (els.queueTileCount) els.queueTileCount.textContent = String(queueSummaries.length);
    if (els.queueTileIssues) els.queueTileIssues.textContent = String(queueSummaries.reduce((sum, item) => sum + item.issueCount, 0));
    if (els.queueTileSigned) els.queueTileSigned.textContent = String(queueSummaries.filter(item => item.signed).length);
    if (els.queueTileClear) els.queueTileClear.textContent = String(queueSummaries.filter(item => item.isClear).length);

    if (els.archiveTileCount) els.archiveTileCount.textContent = String(archiveSummaries.length);
    if (els.archiveTileIssues) els.archiveTileIssues.textContent = String(archiveSummaries.reduce((sum, item) => sum + item.issueCount, 0));
    if (els.archiveTileSigned) els.archiveTileSigned.textContent = String(archiveSummaries.filter(item => item.signed).length);
    if (els.archiveTileClear) els.archiveTileClear.textContent = String(archiveSummaries.filter(item => item.isClear).length);

    syncTileActiveState('queue', queueViewState.filter);
    syncTileActiveState('archive', archiveViewState.filter);
  };

  const buildCsvSummaryRows = (rows, sourceLabel) => {
    return sortInstancesNewestFirst(getInstances(rows)).map(instance => {
      const instanceRows = getRowsByInstance(rows, instance);
      const summary = getInstanceSummary(instanceRows);
      return {
        source: sourceLabel,
        instance,
        checklist: summary.sample.checklistName || '',
        date: summary.sample.date || '',
        unit: summary.sample.unit || '',
        supervisor: summary.sample.supervisor || '',
        team_member: summary.sample.cleaner || '',
        total_items: instanceRows.length,
        issue_count: summary.issueCount,
        signed: summary.signed ? 'Yes' : 'No',
        status: summary.issueCount ? 'Issues' : 'Clear',
        saved_at: getInstanceCardMeta(instanceRows).createdAtDisplay
      };
    });
  };

  const downloadCsvFile = (rows, fileNamePrefix) => {
    if (!rows.length) {
      showToast('No report data available for CSV export.', 3000);
      return;
    }
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:\-]/g, '').replace(/\..+$/, '');
    link.href = url;
    link.download = `${fileNamePrefix}_${ts}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportQueueCsvSummary = () => {
    downloadCsvFile(buildCsvSummaryRows(reportData, 'Queue'), 'checklib_queue_summary');
  };

  const exportArchiveCsvSummary = () => {
    downloadCsvFile(buildCsvSummaryRows(archiveData, 'Archive'), 'checklib_archive_summary');
  };

  const saveQueueState = () => {
    reportCount = getInstances(reportData).length;
    localStorage.setItem('reportData', JSON.stringify(reportData));
    localStorage.setItem('reportCount', String(reportCount));
    updateReportCountUI();
    updateDashboardTiles();
    renderReportList();
  };

  const saveArchiveState = () => {
    localStorage.setItem('archiveData', JSON.stringify(archiveData));
    updateDashboardTiles();
    renderArchiveList();
  };

  const formatCardDateTime = value => {
    if (!value) return 'Not set';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getInstanceCardMeta = rows => {
    const sample = rows[0] || {};
    const issueCount = rows.filter(r => r.value === 'N').length;
    const signed = rows.some(r => r.signatureDataUrl);
    const createdAt = rows[0]?.instance || '';
    const createdAtDisplay = createdAt
      ? `${createdAt.slice(0, 4)}-${createdAt.slice(4, 6)}-${createdAt.slice(6, 8)} ${createdAt.slice(9, 11) || '00'}:${createdAt.slice(11, 13) || '00'}`
      : 'Not set';

    return {
      sample,
      issueCount,
      signed,
      exportedDate: formatCardDateTime(sample.date),
      instanceStamp: createdAt,
      createdAtDisplay
    };
  };

  const updateReportCountUI = () => {
    document.getElementById('report-count').textContent = reportCount;
  };

  const renderArchiveList = () => {
    if (!els.archiveItems || !els.archiveCount) return;

    const allInstances = sortInstancesNewestFirst(getInstances(archiveData));
    const instances = getFilteredInstances(archiveData, archiveViewState);
    els.archiveCount.textContent = String(allInstances.length);

    const archiveKicker = document.querySelector('#archive-list .control-subpanel-kicker');
    if (archiveKicker) {
      archiveKicker.textContent = instances.length
        ? `${instances.length} shown of ${allInstances.length}`
        : allInstances.length
          ? 'No archive matches current filter'
          : 'No archive items yet';
    }

    if (!instances.length) {
      els.archiveItems.innerHTML = `<li class="empty-archive">${allInstances.length ? 'No archived reports match the current search or filter.' : 'No archived reports yet.'}</li>`;
      return;
    }

    els.archiveItems.innerHTML = instances.map((inst, idx) => {
      const rows = getRowsByInstance(archiveData, inst);
      const { sample, issueCount, signed, exportedDate, createdAtDisplay } = getInstanceCardMeta(rows);

      return `
        <li class="report-queue-card muted report-history-card ${issueCount ? 'has-issues' : 'is-clear'}">
          <div class="report-queue-card-main">
            <div class="report-queue-card-top">
              <span class="report-queue-index">${idx + 1}</span>
              <strong class="report-queue-title">${sample.checklistName}</strong>
              <span class="report-queue-badge ${issueCount ? 'has-issues' : 'clear'}">${issueCount ? `${issueCount} issue${issueCount === 1 ? '' : 's'}` : 'Clear'}</span>
            </div>
            <div class="report-queue-meta report-queue-meta-grid">
              <span><strong>Date:</strong> ${exportedDate}</span>
              <span><strong>Unit:</strong> ${sample.unit || 'Not set'}</span>
              <span><strong>Supervisor:</strong> ${sample.supervisor || 'Not set'}</span>
              <span><strong>Status:</strong> ${signed ? 'Signed' : 'Unsigned'}</span>
              <span><strong>Saved:</strong> ${createdAtDisplay}</span>
              <span><strong>Source:</strong> Archive</span>
            </div>
          </div>
          <div class="report-card-actions">
            <button type="button" class="card-action-button" data-view-instance="${inst}" data-source="archive">View</button>
            <button type="button" class="card-action-button" data-export-instance="${inst}" data-source="archive">Re-export</button>
            <button type="button" class="card-action-button" data-restore-instance="${inst}">Restore</button>
            <button type="button" class="card-action-button danger" data-delete-archive="${inst}">Delete</button>
          </div>
        </li>
      `;
    }).join('');
  };

  const renderReportList = () => {
    const allInstances = sortInstancesNewestFirst(getInstances(reportData));
    const instances = getFilteredInstances(reportData, queueViewState);
    els.reportItems.innerHTML = '';

    const queueKicker = document.querySelector('#report-list .control-subpanel-kicker');
    if (queueKicker) {
      queueKicker.textContent = instances.length
        ? `${instances.length} shown of ${allInstances.length}`
        : allInstances.length
          ? 'No queue matches current filter'
          : 'Ready for export';
    }

    if (!instances.length) {
      els.reportItems.innerHTML = `<li class="empty-archive">${allInstances.length ? 'No queue reports match the current search or filter.' : 'No reports in queue.'}</li>`;
      return;
    }

    instances.forEach((inst, idx) => {
      const rows = getRowsByInstance(reportData, inst);
      const { sample, issueCount, signed, exportedDate, createdAtDisplay } = getInstanceCardMeta(rows);
      const li = document.createElement('li');
      li.className = `report-queue-card report-history-card ${issueCount ? 'has-issues' : 'is-clear'}`;
      li.innerHTML = `
        <div class="report-queue-card-main">
          <div class="report-queue-card-top">
            <span class="report-queue-index">${idx + 1}</span>
            <strong class="report-queue-title">${sample.checklistName}</strong>
            <span class="report-queue-badge ${issueCount ? 'has-issues' : 'clear'}">${issueCount ? `${issueCount} issue${issueCount === 1 ? '' : 's'}` : 'Clear'}</span>
          </div>
          <div class="report-queue-meta report-queue-meta-grid">
            <span><strong>Date:</strong> ${exportedDate}</span>
            <span><strong>Unit:</strong> ${sample.unit || 'Not set'}</span>
            <span><strong>Supervisor:</strong> ${sample.supervisor || 'Not set'}</span>
            <span><strong>Status:</strong> ${signed ? 'Signed' : 'Unsigned'}</span>
            <span><strong>Saved:</strong> ${createdAtDisplay}</span>
            <span><strong>Source:</strong> Queue</span>
          </div>
        </div>
        <div class="report-card-actions">
          <button type="button" class="card-action-button" data-view-instance="${inst}" data-source="queue">View</button>
          <button type="button" class="card-action-button" data-export-instance="${inst}" data-source="queue">Export</button>
          <button type="button" class="card-action-button" data-archive-instance="${inst}">Archive</button>
          <button type="button" class="card-action-button danger" data-delete-report="${inst}">Delete</button>
        </div>
      `;
      els.reportItems.appendChild(li);
    });
  };

  const clearForm = () => {
    appState.metadata = { date: '', supervisor: '', cleanerTeam: '', unitArea: '' };
    appState.answers = {};
    appState.comments = {};
    appState.issuesById = {};
    appState.issueIdByTask = {};
    appState.currentSectionIndex = 0;
    autosaveEnabled = false;
    syncInputsFromState();
    clearValidationErrors();
    recalcCounts();
    setRunnerStage('setup');
    applyRememberedDefaults();
    updateResumeBanner();
    showToast('Form cleared.');
  };

  const requestClearForm = () => {
    const hasContent = Object.values(appState.metadata).some(value => String(value || '').trim())
      || Object.keys(appState.answers).length
      || Object.keys(appState.comments).length;
    if (!hasContent) {
      clearForm();
      return;
    }
    const answeredCount = Object.keys(appState.answers).length;
    const commentCount = Object.keys(appState.comments).filter(key => String(appState.comments[key] || '').trim()).length;
    openConfirmModal({
      title: 'Clear Current Checklist?',
      message: `This draft has ${answeredCount} answered item${answeredCount === 1 ? '' : 's'} and ${commentCount} comment${commentCount === 1 ? '' : 's'}. Continue to final confirmation.`,
      confirmLabel: 'Continue',
      onConfirm: () => openConfirmModal({
        title: 'Final Confirmation',
        message: 'Clear this in-progress checklist now? You can still resume from your last saved draft.',
        confirmLabel: 'Clear Form',
        onConfirm: () => clearForm()
      })
    });
  };

  const saveProgress = ({ silent = false } = {}) => {
    syncMetadataFromInputs();
    const currentSection = getCurrentSection();
    const savedAt = new Date().toISOString();
    const payload = {
      schemaVersion: ISSUE_MODEL_VERSION,
      checklistId: appState.checklistId,
      date: appState.metadata.date,
      supervisor: appState.metadata.supervisor,
      cleanerTeam: appState.metadata.cleanerTeam,
      unit: appState.metadata.unitArea,
      stage: appState.runnerStage,
      currentSectionIndex: appState.currentSectionIndex,
      currentSectionId: currentSection?.id || '',
      currentSectionTitle: currentSection?.title || '',
      savedAt,
      issues: Object.values(appState.issuesById).map(issue => ({
        id: issue.id,
        modelVersion: issue.modelVersion || ISSUE_MODEL_VERSION,
        itemId: issue.itemId,
        task: issue.task || '',
        section: issue.section || '',
        actionRequired: Boolean(issue.actionRequired),
        createdAt: issue.createdAt || savedAt,
        updatedAt: issue.updatedAt || savedAt,
        severity: issue.severity || '',
        responsible: issue.responsible || '',
        dueDate: issue.dueDate || ''
      })),
      checklist: flattenTasks().map(item => ({
        itemId: item.id,
        task: item.task,
        value: appState.answers[item.id] || '',
        comment: appState.comments[item.id] || ''
      }))
    };
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(payload));
    saveRememberedDefaults();
    updateResumeBanner();
    updateAutosaveStatus(savedAt, silent ? 'Autosaved' : 'Saved');
    if (!silent) {
      showToast('Progress saved successfully!');
      if (!navigator.onLine) showToast('Offline: saved locally.');
    }
  };

  const loadProgress = (data = getSavedDraft(), { silent = false } = {}) => {
    if (!data) return showToast('No saved progress found.', 3500);
    if (data.checklistId !== appState.checklistId) return showToast('Saved data is for a different checklist.', 4000);
    appState.metadata = {
      date: data.date || '',
      supervisor: data.supervisor || '',
      cleanerTeam: data.cleanerTeam || '',
      unitArea: data.unit || ''
    };
    syncInputsFromState();
    appState.answers = {};
    appState.comments = {};
    appState.issuesById = {};
    appState.issueIdByTask = {};
    flattenTasks().forEach(item => {
      const entry = (data.checklist || []).find(e => e.itemId === item.id) || (data.checklist || []).find(e => e.task === item.task);
      if (!entry) return;
      if (entry.value) appState.answers[item.id] = entry.value;
      if (entry.comment) appState.comments[item.id] = entry.comment;
      if (entry.issueMeta && typeof entry.issueMeta === 'object') {
        setIssueMeta(item.id, entry.issueMeta);
      }
    });
    if (Array.isArray(data.issues)) {
      data.issues.forEach(raw => {
        if (!raw || typeof raw !== 'object') return;
        const itemId = raw.itemId || '';
        if (!itemId) return;
        const task = getTaskById(itemId);
        const id = raw.id || createIssueId();
        const createdAt = raw.createdAt || data.savedAt || new Date().toISOString();
        appState.issuesById[id] = {
          id,
          modelVersion: raw.modelVersion || ISSUE_MODEL_VERSION,
          itemId,
          task: raw.task || task?.task || '',
          section: raw.section || task?.section || '',
          actionRequired: Boolean(raw.actionRequired),
          createdAt,
          updatedAt: raw.updatedAt || createdAt,
          severity: raw.severity || '',
          responsible: raw.responsible || '',
          dueDate: raw.dueDate || ''
        };
        appState.issueIdByTask[itemId] = id;
      });
    }
    flattenTasks().forEach(item => {
      if (appState.answers[item.id] === 'N') ensureIssueRecord(item.id);
    });
    const maxSectionIndex = Math.max(appState.sections.length - 1, 0);
    const fallbackIndex = Number.parseInt(data.currentSectionIndex, 10);
    let restoredSectionIndex = Number.isInteger(fallbackIndex)
      ? Math.min(Math.max(fallbackIndex, 0), maxSectionIndex)
      : 0;
    if (data.currentSectionId) {
      const idMatch = appState.sections.findIndex(section => section.id === data.currentSectionId);
      if (idMatch >= 0) restoredSectionIndex = idMatch;
    } else if (data.currentSectionTitle) {
      const titleMatch = appState.sections.findIndex(section => section.title === data.currentSectionTitle);
      if (titleMatch >= 0) restoredSectionIndex = titleMatch;
    }
    appState.currentSectionIndex = restoredSectionIndex;
    recalcCounts();
    setRunnerStage(STAGES.includes(data.stage) ? data.stage : 'section', { persist: false });
    autosaveEnabled = true;
    updateResumeBanner();
    updateAutosaveStatus(data.savedAt, 'Restored');
    if (!silent) showToast('Progress loaded successfully!');
  };

  const exportGroupedPDFs = (sourceRows = reportData, options = {}, skipLargePdfConfirm = false, fileNamePrefix = 'checklib_combined_report') => {
    if (!sourceRows.length) return showToast('No reports to export. Click "Add to Report" first.', 4000);
    if (!window.jspdf) return showToast('PDF export unavailable (library not loaded).', 4000);

    const { jsPDF } = window.jspdf;
    const exportOptions = {
      contentMode: options.contentMode || 'full'
    };
    const brand = {
      primary: [33, 38, 44],
      dark: [33, 38, 44],
      muted: [110, 116, 123],
      line: [222, 226, 230],
      success: [47, 125, 75],
      warning: [192, 139, 47],
      error: [185, 48, 48],
      soft: [245, 247, 249]
    };

    const typeOrder = [];
    const groups = {};

    sourceRows.forEach(row => {
      const { checklistId, instance } = row;
      if (!groups[checklistId]) {
        groups[checklistId] = { instanceOrder: [], byInstance: {} };
        typeOrder.push(checklistId);
      }
      if (!groups[checklistId].byInstance[instance]) {
        groups[checklistId].byInstance[instance] = [];
        groups[checklistId].instanceOrder.push(instance);
      }
      groups[checklistId].byInstance[instance].push(row);
    });

    const estimatePageCount = rows => {
      const issues = rows.filter(row => row.value === 'N');
      const sectionCount = new Set(rows.map(row => row.section)).size || 1;
      return 3 + Math.ceil(issues.length / 5) + Math.ceil(rows.length / 18) + Math.ceil(sectionCount / 5);
    };

    const combinedTitle = 'CheckLib Combined Report';
    const footerText = '© 2026 CheckLib';

    const estimatedPages = typeOrder.reduce((sum, checklistId) => {
      const { byInstance, instanceOrder } = groups[checklistId];
      return sum + instanceOrder.reduce((subSum, inst) => subSum + estimatePageCount(byInstance[inst]), 0);
    }, 1);

    if (estimatedPages > 30 && !skipLargePdfConfirm) {
      openConfirmModal({
        title: 'Large PDF Export',
        message: `This combined PDF will be approximately ${estimatedPages} pages. Continue?`,
        confirmLabel: 'Export PDF',
        onConfirm: () => exportGroupedPDFs(sourceRows, exportOptions, true, fileNamePrefix)
      });
      return;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = width - (margin * 2);
    const footerY = height - 8;
    const headerBandHeight = 12;
    const tocEntries = [];

      const setFont = (size = 10, style = 'normal', color = brand.dark) => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
      };

      const drawHeader = (docTitle, subTitle = '') => {
        doc.setFillColor(brand.primary[0], brand.primary[1], brand.primary[2]);
        doc.rect(0, 0, width, headerBandHeight, 'F');

        // ADD THIS LINE
        doc.setDrawColor(255, 255, 255);
        doc.line(0, headerBandHeight, width, headerBandHeight);

        const maxTitleWidth = width - (margin * 2) - 60;
        const titleLines = doc.splitTextToSize(docTitle, maxTitleWidth);

        setFont(12, 'bold', [255, 255, 255]);
        doc.text(titleLines, margin, 7.5);

        if (subTitle) {
          setFont(8, 'normal', [255, 255, 255]);
          doc.text(subTitle, width - margin, 7.5, { align: 'right' });
        }
      };

      const drawFooter = () => {
        doc.setDrawColor(brand.line[0], brand.line[1], brand.line[2]);
        doc.line(margin, footerY - 3, width - margin, footerY - 3);

        const pageText = `Page ${doc.getCurrentPageInfo().pageNumber}`;
        const pageWidth = doc.getTextWidth(pageText);

        const footerMaxWidth = width - (margin * 2) - pageWidth - 6;
        const footerLines = doc.splitTextToSize(footerText, footerMaxWidth);

        setFont(8, 'normal', brand.muted);
        doc.text(footerLines, margin, footerY);

        doc.text(pageText, width - margin, footerY, { align: 'right' });
      };

      const addPageShell = (docTitle, subTitle = '') => {
        drawHeader(docTitle, subTitle);
        drawFooter();
        return 22;
      };

      const addNewPage = (docTitle, subTitle = '') => {
        doc.addPage();
        return addPageShell(docTitle, subTitle);
      };

      const ensureSpace = (y, required, docTitle, subTitle = '') => {
        if (y + required > footerY - 5) {
          return addNewPage(docTitle, subTitle);
        }
        return y;
      };

      const drawSectionTitle = (y, text) => {
        doc.setFillColor(brand.soft[0], brand.soft[1], brand.soft[2]);
        doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');
        setFont(11, 'bold', brand.dark);
        doc.text(text, margin + 3, y + 5.5);
        return y + 11;
      };

      const drawKeyValueGrid = (y, items) => {
        const boxGap = 4;
        const colWidth = (contentWidth - boxGap) / 2;
        const rowHeight = 15;

        for (let i = 0; i < items.length; i += 2) {
          const left = items[i];
          const right = items[i + 1];
          const rowY = y + ((i / 2) * (rowHeight + 3));

          doc.setFillColor(brand.soft[0], brand.soft[1], brand.soft[2]);
          doc.setDrawColor(brand.line[0], brand.line[1], brand.line[2]);
          doc.roundedRect(margin, rowY, colWidth, rowHeight, 2, 2, 'FD');
          setFont(7, 'bold', brand.muted);
          doc.text(left.label.toUpperCase(), margin + 3, rowY + 4);
          setFont(10, 'bold', brand.dark);
          doc.text(String(left.value || 'Not set'), margin + 3, rowY + 10);

          if (right) {
            doc.setFillColor(brand.soft[0], brand.soft[1], brand.soft[2]);
            doc.setDrawColor(brand.line[0], brand.line[1], brand.line[2]);
            doc.roundedRect(margin + colWidth + boxGap, rowY, colWidth, rowHeight, 2, 2, 'FD');
            setFont(7, 'bold', brand.muted);
            doc.text(right.label.toUpperCase(), margin + colWidth + boxGap + 3, rowY + 4);
            setFont(10, 'bold', brand.dark);
            doc.text(String(right.value || 'Not set'), margin + colWidth + boxGap + 3, rowY + 10);
          }
        }

        return y + (Math.ceil(items.length / 2) * (rowHeight + 3));
      };

      const groupBySection = rows => {
        const map = {};
        rows.forEach(row => {
          if (!map[row.section]) map[row.section] = [];
          map[row.section].push(row);
        });
        return map;
      };

      const getChecklistStats = rows => {
        const total = rows.length;
        const issues = rows.filter(row => row.value === 'N').length;
        const answered = rows.filter(row => row.value).length;
        const clear = rows.filter(row => row.value === 'Y').length;
        const na = rows.filter(row => row.value === 'NA').length;
        return { total, issues, answered, clear, na };
      };

      const getIssueTone = row => {
        if (row.issueActionRequired && (!row.issueResponsible || !row.issueDueDate)) return brand.error;
        if (row.issueActionRequired && row.issueResponsible && row.issueDueDate) return brand.warning;
        return brand.dark;
      };

      const drawIssueCard = (y, row, itemNumber, sectionTitle, pageTitle) => {
        const commentText = row.comment || 'No issue comment provided.';
        const metaLines = [
          `Severity: ${row.issueSeverity || 'Not set'}`,
          `Action Required: ${row.issueActionRequired ? 'Yes' : 'No'}`,
          `Responsible: ${row.issueResponsible || 'Not set'}`,
          `Due Date: ${row.issueDueDate || 'Not set'}`
        ];

        const taskLines = doc.splitTextToSize(`Item ${itemNumber} - ${row.task}`, contentWidth - 8);
        const commentLines = doc.splitTextToSize(`Comment: ${commentText}`, contentWidth - 8);
        const metaWrap = metaLines.map(line => doc.splitTextToSize(line, contentWidth - 8)).flat();
        const cardHeight = 8 + (taskLines.length * 5) + 4 + (commentLines.length * 4.5) + 4 + (metaWrap.length * 4.5) + 5;

        y = ensureSpace(y, cardHeight + 2, pageTitle, sectionTitle);

        const tone = getIssueTone(row);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(tone[0], tone[1], tone[2]);
        doc.setLineWidth(0.6);
        doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, 'FD');

        let lineY = y + 5;
        setFont(10, 'bold', tone);
        doc.text(taskLines, margin + 4, lineY);
        lineY += taskLines.length * 5 + 1;

        setFont(9, 'normal', brand.dark);
        doc.text(commentLines, margin + 4, lineY);
        lineY += commentLines.length * 4.5 + 1;

        setFont(8.5, 'normal', brand.muted);
        doc.text(metaWrap, margin + 4, lineY);

        return y + cardHeight + 4;
      };

      const drawChecklistTableHeader = y => {
        doc.setFillColor(brand.soft[0], brand.soft[1], brand.soft[2]);
        doc.rect(margin, y, contentWidth, 7, 'F');
        setFont(8, 'bold', brand.dark);
        doc.text('#', margin + 2, y + 4.7);
        doc.text('Task', margin + 12, y + 4.7);
        doc.text('Answer', width - margin - 18, y + 4.7, { align: 'right' });
        return y + 9;
      };

      const drawChecklistRow = (y, row, itemNumber, pageTitle, sectionTitle) => {
        const taskLines = doc.splitTextToSize(row.task, contentWidth - 34);
        const rowHeight = Math.max(7, taskLines.length * 4.5 + 2);
        y = ensureSpace(y, rowHeight + 1, pageTitle, sectionTitle);

        doc.setDrawColor(brand.line[0], brand.line[1], brand.line[2]);
        doc.line(margin, y + rowHeight, width - margin, y + rowHeight);

        setFont(8.5, 'bold', brand.muted);
        doc.text(String(itemNumber), margin + 2, y + 4.8);

        setFont(9, 'normal', brand.dark);
        doc.text(taskLines, margin + 12, y + 4.8);

        const valueText = row.value || '-';
        let valueColor = brand.dark;
        if (valueText === 'Y') valueColor = brand.success;
        if (valueText === 'N') valueColor = brand.error;
        if (valueText === 'NA') valueColor = brand.warning;

        setFont(9, 'bold', valueColor);
        doc.text(valueText, width - margin - 2, y + 4.8, { align: 'right' });

        return y + rowHeight + 1.5;
      };

      const drawSummaryPage = (rows, subtitle) => {
        let y = addNewPage(combinedTitle, subtitle);

        const sample = rows[0];
        const stats = getChecklistStats(rows);
        const statusLabel = stats.issues ? 'Issues Present' : 'Clear';
        const statusColor = stats.issues ? brand.error : brand.success;

        setFont(18, 'bold', brand.dark);
        doc.text(combinedTitle, margin, y);
        y += 7;

        setFont(10, 'normal', brand.muted);
        doc.text('Inspection Summary', margin, y);
        y += 8;

        doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.roundedRect(margin, y, 42, 9, 3, 3, 'F');
        setFont(9, 'bold', [255, 255, 255]);
        doc.text(statusLabel.toUpperCase(), margin + 21, y + 5.8, { align: 'center' });

        setFont(8, 'normal', brand.muted);
        doc.text(`Created ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, width - margin, y + 5.8, { align: 'right' });
        y += 15;

        y = drawKeyValueGrid(y, [
          { label: 'Date', value: sample.date || 'Not set' },
          { label: 'Unit / Area', value: sample.unit || 'Not set' },
          { label: 'Supervisor', value: sample.supervisor || 'Not set' },
          { label: 'Team Member', value: sample.cleaner || 'Not set' },
          { label: 'Answered', value: `${stats.answered} / ${stats.total}` },
          { label: 'Issues', value: String(stats.issues) },
          { label: 'Clear Items', value: String(stats.clear) },
          { label: 'N/A Items', value: String(stats.na) }
        ]);
        y += 4;

        y = ensureSpace(y, 32, combinedTitle, subtitle);
        y = drawSectionTitle(y, 'Signature');
        if (sample.signatureDataUrl) {
          doc.setDrawColor(brand.line[0], brand.line[1], brand.line[2]);
          doc.roundedRect(margin, y, 70, 28, 2, 2, 'S');
          doc.addImage(sample.signatureDataUrl, 'PNG', margin + 3, y + 3, 64, 22);
          setFont(7.5, 'normal', brand.muted);
          doc.text('Signed inspection record', margin + 3, y + 26);
        } else {
          doc.setDrawColor(brand.line[0], brand.line[1], brand.line[2]);
          doc.roundedRect(margin, y, 70, 28, 2, 2, 'S');
          setFont(9, 'italic', brand.muted);
          doc.text('No signature captured', margin + 35, y + 15, { align: 'center' });
        }

        return doc.getCurrentPageInfo().pageNumber;
      };

      const drawIssuesSection = (rows, subtitle) => {
        const issues = rows.filter(row => row.value === 'N');
        const groupedIssues = groupBySection(issues);

        let y = addNewPage(combinedTitle, subtitle);
        y = drawSectionTitle(y, 'Issues Requiring Attention');

        if (!issues.length) {
          setFont(10, 'normal', brand.muted);
          doc.text('No failed items were recorded for this inspection.', margin, y + 4);
          return doc.getCurrentPageInfo().pageNumber;
        }

        Object.keys(groupedIssues).forEach(sectionName => {
          y = ensureSpace(y, 12, combinedTitle, subtitle);
          setFont(11, 'bold', brand.dark);
          doc.text(sectionName, margin, y);
          y += 6;

          groupedIssues[sectionName].forEach((row, index) => {
            y = drawIssueCard(y, row, index + 1, sectionName, combinedTitle);
          });

          y += 2;
        });

        return doc.getCurrentPageInfo().pageNumber;
      };

      const drawChecklistSection = (rows, subtitle) => {
        const groupedRows = groupBySection(rows);
        let y = addNewPage(combinedTitle, subtitle);
        y = drawSectionTitle(y, 'Full Checklist Record');

        Object.keys(groupedRows).forEach(sectionName => {
          const sectionRows = groupedRows[sectionName];
          y = ensureSpace(y, 16, combinedTitle, subtitle);

          setFont(11, 'bold', brand.dark);
          doc.text(sectionName, margin, y);
          y += 4.5;

          y = drawChecklistTableHeader(y);

          sectionRows.forEach((row, index) => {
            y = drawChecklistRow(y, row, index + 1, combinedTitle, sectionName);
          });

          y += 5;
        });

        return doc.getCurrentPageInfo().pageNumber;
      };

      const drawContentsPage = () => {
        doc.setPage(1);
        drawHeader(combinedTitle, 'Contents');
        drawFooter();

        let y = 24;
        setFont(18, 'bold', brand.dark);
        doc.text('Inspection Report Pack', margin, y);
        y += 7;

        setFont(10, 'normal', brand.muted);
        doc.text('Contents', margin, y);
        y += 10;

        tocEntries.forEach((entry, index) => {
          setFont(10, 'bold', brand.dark);
          doc.text(`${index + 1}. ${entry.label}`, margin, y);

          doc.setDrawColor(brand.line[0], brand.line[1], brand.line[2]);
          doc.line(margin + 60, y - 1, width - margin - 12, y - 1);

          setFont(10, 'bold', brand.dark);
          doc.text(String(entry.page), width - margin, y, { align: 'right' });
          y += 8;

          if (y > footerY - 10) {
            doc.addPage();
            drawHeader(combinedTitle, 'Contents');
            drawFooter();
            y = 24;
          }
        });
      };

    drawHeader(combinedTitle, 'Contents');
    drawFooter();

    let inspectionCounter = 0;

    typeOrder.forEach(checklistId => {
      const { byInstance, instanceOrder } = groups[checklistId];
      const checklistTitle = checklistMetadata[checklistId]?.title || checklistId;

      instanceOrder.forEach(inst => {
        inspectionCounter += 1;
        const rows = byInstance[inst];
        const sample = rows[0];
        const subtitle = `${checklistTitle} | ${sample.date || 'No date'} | ${sample.supervisor || 'No supervisor'} | ${sample.unit || 'No unit'}`;

        const summaryPage = drawSummaryPage(rows, subtitle);
        tocEntries.push({ label: `${inspectionCounter}. ${checklistTitle} Summary`, page: summaryPage });

        if (exportOptions.contentMode === 'full' || exportOptions.contentMode === 'summary_issues' || exportOptions.contentMode === 'issues_only') {
          const issuesPage = drawIssuesSection(rows, subtitle);
          tocEntries.push({ label: `${inspectionCounter}. ${checklistTitle} Issues`, page: issuesPage });
        }

        if (exportOptions.contentMode === 'full') {
          const checklistPage = drawChecklistSection(rows, subtitle);
          tocEntries.push({ label: `${inspectionCounter}. ${checklistTitle} Full Checklist`, page: checklistPage });
        }
      });
    });

    drawContentsPage();

    const ts = new Date().toISOString().replace(/[:\-]/g, '').replace(/\..+$/, '');
    doc.save(`${fileNamePrefix}_${ts}.pdf`);
  };

  const moveReportsToArchive = (instance = null) => {
    const rowsToMove = instance ? getRowsByInstance(reportData, instance) : [...reportData];
    if (!rowsToMove.length) return;

    archiveData.push(...rowsToMove);
    reportData = instance ? reportData.filter(r => r.instance !== instance) : [];

    saveArchiveState();
    saveQueueState();
    closeReportDetailModal();

    showToast(instance ? 'Report moved to archive.' : 'Reports moved to archive.');
  };

  const restoreArchivedReport = instance => {
    const rowsToRestore = getRowsByInstance(archiveData, instance);
    if (!rowsToRestore.length) return;

    reportData.push(...rowsToRestore);
    archiveData = archiveData.filter(r => r.instance !== instance);

    saveQueueState();
    saveArchiveState();
    closeReportDetailModal();

    showToast('Archived report restored to queue.');
  };

  const deleteArchivedReport = instance => {
    archiveData = archiveData.filter(r => r.instance !== instance);
    saveArchiveState();
    closeReportDetailModal();
    showToast('Archived report deleted.');
  };

  const shareAllReports = () => {
    if (!reportData.length) return showToast('No reports to share. Click "Add to Report" first.', 4000);
    exportGroupedPDFs(reportData);
    const subject = encodeURIComponent('CheckLib Reports');
    const body = encodeURIComponent('Attached are the generated checklist reports. Please attach the PDFs from your downloads folder.');
    try {
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      showToast('Email client opened. Please manually attach PDFs from your downloads folder.', 5000);
    } catch (error) {
      console.error('Failed to open email client:', error);
      showToast('Could not open email client. PDFs saved to downloads folder.', 5000);
    }
  };

  const updateOfflineState = () => {
    if (els.offlineMessage) els.offlineMessage.classList.toggle('hidden', navigator.onLine);
  };

  const showUpdateBanner = () => els.updateBanner && els.updateBanner.classList.remove('hidden');
  const hideUpdateBanner = () => els.updateBanner && els.updateBanner.classList.add('hidden');

  const loadChecklistMetadata = async () => {
    try {
      const res = await fetch('checklists.json');
      if (!res.ok) throw new Error(res.statusText);

      const builtInData = await res.json();
      const customData = await getCustomChecklists();

      customChecklistCache = customData.reduce((memo, item) => {
        memo[item.id] = item;
        return memo;
      }, {});

      const builtInOptions = builtInData.map(item => ({
        id: item.id,
        title: item.title,
        footerText: item.footerText || '',
        source: 'built-in'
      }));

      const customOptions = customData.map(item => ({
        id: item.id,
        title: item.title,
        footerText: 'Custom checklist',
        source: 'custom'
      }));

      const combined = [...builtInOptions, ...customOptions];

      checklistMetadata = combined.reduce((memo, item) => {
        memo[item.id] = {
          title: item.title,
          footerText: item.footerText,
          source: item.source
        };
        return memo;
      }, {});

      els.checklistSelect.innerHTML = combined.map(item => {
        const label = item.source === 'custom'
          ? `${item.title} (Custom)`
          : item.title;

        return `<option value="${item.id}">${label}</option>`;
      }).join('');

      const last = localStorage.getItem('lastChecklistId');
      const firstId = combined[0]?.id || '';

      els.checklistSelect.value = last && checklistMetadata[last] ? last : firstId;

      if (els.checklistSelect.value) {
        loadChecklist(els.checklistSelect.value);
      }
    } catch (error) {
      console.error('Metadata load failed:', error);
      showToast('Could not load available checklists.', 4500);
    }
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    const installBtn = document.getElementById('install-app');
    installBtn.hidden = false;
    showToast('Install available! Click the button to add this app.');
  });

  document.getElementById('install-app').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    showToast(outcome === 'accepted' ? 'Thanks for installing!' : 'Installation dismissed.');
    deferredInstallPrompt = null;
    document.getElementById('install-app').hidden = true;
  });

  updateViewportOffsets();
  window.addEventListener('resize', updateViewportOffsets);

  const preferredTheme = localStorage.getItem('theme');
  if (preferredTheme === 'dark' || (!preferredTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark-theme');
    els.themeToggle.textContent = 'Light';
  } else {
    els.themeToggle.textContent = 'Dark';
  }
  els.themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-theme');
    els.themeToggle.textContent = isDark ? 'Light' : 'Dark';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });

  els.startRunner.addEventListener('click', () => {
    syncMetadataFromInputs();
    if (validateMetadata()) {
      autosaveEnabled = true;
      setRunnerStage('section');
    }
  });
  els.openSectionDrawer.addEventListener('click', () => openSectionDrawer());
  els.sectionDrawerClose.addEventListener('click', () => closeSectionDrawer());
  els.sectionDrawerDismiss.addEventListener('click', () => closeSectionDrawer());
  els.sectionShowUnanswered.addEventListener('click', () => {
    const unanswered = getUnansweredInCurrentSection();
    if (!unanswered.length && !appState.sectionFilterUnanswered) return;
    const enableFilter = !appState.sectionFilterUnanswered;
    setSectionUnansweredFilter(enableFilter);
    if (enableFilter && unanswered.length) focusSectionItem(unanswered[0].id);
  });
  const refreshCurrentSectionView = () => {
    renderSectionStage();
    renderRunnerSummary();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollRunnerViewportToTop();
        }, 0);
      });
    });

    if (autosaveEnabled) saveProgress({ silent: true });
  };

  els.sectionPrev.addEventListener('click', () => {
    confirmSectionExitIfNeeded(() => {
      if (appState.currentSectionIndex > 0) {
        appState.currentSectionIndex -= 1;
        refreshCurrentSectionView();
      } else {
        setRunnerStage('setup');
      }
    });
  });
  els.sectionNext.addEventListener('click', () => {
    confirmSectionExitIfNeeded(() => {
      if (appState.currentSectionIndex < appState.sections.length - 1) {
        appState.currentSectionIndex += 1;
        refreshCurrentSectionView();
      } else {
        setRunnerStage('issues');
      }
    });
  });
  els.sectionReview.addEventListener('click', () => confirmSectionExitIfNeeded(() => setRunnerStage('issues')));
  els.sectionPrevSticky.addEventListener('click', () => els.sectionPrev.click());
  els.sectionNextSticky.addEventListener('click', () => els.sectionNext.click());
  els.sectionReviewSticky.addEventListener('click', () => els.sectionReview.click());
  els.sectionSaveSticky.addEventListener('click', () => saveProgress());
  els.issuesBack.addEventListener('click', () => setRunnerStage('section'));
  els.issuesNext.addEventListener('click', () => setRunnerStage('final'));
  els.finalBack.addEventListener('click', () => setRunnerStage('issues'));
  els.finalSaveDraft.addEventListener('click', () => saveProgress());
  els.finalProceedSignature.addEventListener('click', () => {
    const status = getFinalReviewStatus();
    renderFinalStage();
    if (!status.ready) {
      showToast('Finish required fields, unanswered items, and missing comments before signature.', 4000);
      return;
    }
    pendingAction = 'addToReport';
    openSignatureModal();
  });

  els.checklistContainer.addEventListener('change', event => {
    if (event.target.type === 'radio') {
      const taskId = event.target.name;
      const answer = event.target.value;
      appState.answers[taskId] = answer;
      if (answer !== 'N') {
        delete appState.comments[taskId];
        clearIssueForTask(taskId);
      } else {
        ensureIssueRecord(taskId);
      }
      renderFromState();
      if (autosaveEnabled) saveProgress({ silent: true });
      if (answer === 'N') {
        const textarea = els.checklistContainer.querySelector(`[name="comment_${taskId}"]`);
        if (textarea) {
          textarea.disabled = false;
          textarea.focus();
        }
      }
      return;
    }
    if (event.target.matches('[data-issue-severity]')) {
      const itemId = event.target.dataset.issueSeverity;
      setIssueMeta(itemId, { severity: event.target.value });
      refreshIssueStatusUI(itemId);
      if (autosaveEnabled) saveProgress({ silent: true });
      return;
    }
    if (event.target.matches('[data-issue-action-required]')) {
      const itemId = event.target.dataset.issueActionRequired;
      setIssueMeta(itemId, { actionRequired: event.target.checked });
      refreshIssueStatusUI(itemId);
      if (autosaveEnabled) saveProgress({ silent: true });
    }
  });
  els.checklistContainer.addEventListener('input', event => {
    if (event.target.classList.contains('comments-input')) {
      const itemId = event.target.name.replace('comment_', '');
      appState.comments[itemId] = event.target.value;
      refreshIssueStatusUI(itemId);
      if (autosaveEnabled) saveProgress({ silent: true });
      return;
    }
    if (event.target.matches('[data-issue-responsible]')) {
      const itemId = event.target.dataset.issueResponsible;
      setIssueMeta(itemId, { responsible: event.target.value });
      refreshIssueStatusUI(itemId);
      if (autosaveEnabled) saveProgress({ silent: true });
      return;
    }
    if (event.target.matches('[data-issue-due-date]')) {
      const itemId = event.target.dataset.issueDueDate;
      setIssueMeta(itemId, { dueDate: event.target.value });
      refreshIssueStatusUI(itemId);
      if (autosaveEnabled) saveProgress({ silent: true });
      return;
    }
    if (autosaveEnabled) saveProgress({ silent: true });
  });
  els.finalReview.addEventListener('click', event => {
    if (!event.target.matches('.review-jump')) return;
    appState.currentSectionIndex = parseInt(event.target.dataset.sectionIndex, 10) || 0;
    setRunnerStage('section');
  });
  els.issuesReview.addEventListener('click', event => {
    if (!event.target.matches('.review-jump')) return;
    appState.currentSectionIndex = parseInt(event.target.dataset.sectionIndex, 10) || 0;
    setRunnerStage('section');
    const itemId = event.target.dataset.itemId;
    const focusComment = event.target.dataset.focusComment === 'true';
    if (itemId) {
      requestAnimationFrame(() => {
        const item = els.checklistContainer.querySelector(`[data-task-id="${itemId}"]`);
        if (item) item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (focusComment) {
          const textarea = els.checklistContainer.querySelector(`[name="comment_${itemId}"]`);
          if (textarea) textarea.focus();
        }
      });
    }
  });
  const refreshIssueReviewCard = itemId => {
    const warning = els.issuesReview.querySelector(`[data-issue-warning="${itemId}"]`);
    const card = els.issuesReview.querySelector(`[data-issue-item="${itemId}"]`);
    const hasComment = Boolean((appState.comments[itemId] || '').trim());
    if (warning) warning.classList.toggle('hidden', hasComment);
    if (card) card.classList.toggle('issue-review-card-warning', !hasComment);
    refreshIssueStatusUI(itemId);
    const issues = flattenTasks().filter(item => appState.answers[item.id] === 'N');
    const unresolved = issues.filter(item => !(appState.comments[item.id] || '').trim()).length;
    const actionsRequired = issues.filter(item => getIssueMeta(item.id).actionRequired).length;
    els.issuesSummary.textContent = issues.length
      ? `${issues.length} issue${issues.length === 1 ? '' : 's'} need review. ${actionsRequired} action-required. ${unresolved ? `${unresolved} missing comment${unresolved === 1 ? '' : 's'}.` : 'All issue comments captured.'}`
      : 'No issues recorded.';
  };
  els.issuesReview.addEventListener('input', event => {
    if (event.target.matches('[data-issue-comment]')) {
      const itemId = event.target.dataset.issueComment;
      appState.comments[itemId] = event.target.value;
      refreshIssueReviewCard(itemId);
      if (autosaveEnabled) saveProgress({ silent: true });
      return;
    }
    if (event.target.matches('[data-issue-responsible]')) {
      const itemId = event.target.dataset.issueResponsible;
      setIssueMeta(itemId, { responsible: event.target.value });
      refreshIssueReviewCard(itemId);
      if (autosaveEnabled) saveProgress({ silent: true });
      return;
    }
    if (event.target.matches('[data-issue-due-date]')) {
      const itemId = event.target.dataset.issueDueDate;
      setIssueMeta(itemId, { dueDate: event.target.value });
      refreshIssueReviewCard(itemId);
      if (autosaveEnabled) saveProgress({ silent: true });
    }
  });
  els.issuesReview.addEventListener('change', event => {
    if (event.target.matches('[data-issue-severity]')) {
      const itemId = event.target.dataset.issueSeverity;
      setIssueMeta(itemId, { severity: event.target.value });
      refreshIssueReviewCard(itemId);
      if (autosaveEnabled) saveProgress({ silent: true });
      return;
    }
    if (event.target.matches('[data-issue-action-required]')) {
      const itemId = event.target.dataset.issueActionRequired;
      setIssueMeta(itemId, { actionRequired: event.target.checked });
      refreshIssueReviewCard(itemId);
      if (autosaveEnabled) saveProgress({ silent: true });
    }
  });
  els.sectionDrawerList.addEventListener('click', event => {
    const trigger = event.target.closest('[data-jump-section]');
    if (!trigger) return;
    const targetIndex = parseInt(trigger.dataset.jumpSection, 10) || 0;
    if (targetIndex === appState.currentSectionIndex) {
      closeSectionDrawer();
      return;
    }
    confirmSectionExitIfNeeded(() => {
      appState.currentSectionIndex = targetIndex;
      closeSectionDrawer();
      setRunnerStage('section');
      if (autosaveEnabled) saveProgress({ silent: true });
    });
  });
  els.form.addEventListener('input', event => {
    if (!event.target.matches('#checklist-date, #supervisor, #cleaner-team, #unit-area')) return;
    syncMetadataFromInputs();
    renderRunnerSummary();
    saveRememberedDefaults();
  });

  els.resumeDraft.addEventListener('click', () => {
    const saved = getSavedDraft();
    if (!saved) {
      els.resumeBanner.classList.add('hidden');
      showToast('No draft available to resume.', 3500);
      return;
    }
    loadProgress(saved);
  });
  els.dismissDraft.addEventListener('click', () => {
    els.resumeBanner.classList.add('hidden');
  });

  els.addToReport.addEventListener('click', () => {
    syncMetadataFromInputs();
    setRunnerStage('final');
    showToast('Review the checklist before signature.', 3000);
  });
  els.confirmSignature.addEventListener('click', () => {
    if (!signaturePad || signaturePad.isEmpty()) {
      els.signatureError.classList.remove('hidden');
      els.signaturePadCanvas.classList.add('error-highlight');
      return;
    }
    const signatureDataUrl = signaturePad.toDataURL('image/png');
    closeSignatureModal();
    if (pendingAction === 'addToReport') {
      reportData.push(...collectReportRows(signatureDataUrl));
      saveQueueState();
      showToast('This check has been added to your queue.');
      clearForm();
    }
    pendingAction = null;
  });
  els.cancelSignature.addEventListener('click', closeSignatureModal);
  els.confirmModalCancel.addEventListener('click', closeConfirmModal);
  els.confirmModalConfirm.addEventListener('click', () => {
    const action = confirmState;
    closeConfirmModal();
    if (typeof action === 'function') action();
  });
  els.confirmModal.addEventListener('click', event => {
    if (event.target === els.confirmModal) closeConfirmModal();
  });

  if (els.exportDecisionModal) {
    els.exportDecisionModal.addEventListener('click', event => {
      if (event.target === els.exportDecisionModal) {
        closeExportOptionsModal();
      }
    });
  }

  if (els.reportDetailClose) {
    els.reportDetailClose.addEventListener('click', () => {
      closeReportDetailModal();
    });
  }

  if (els.reportDetailModal) {
    els.reportDetailModal.addEventListener('click', event => {
      if (event.target === els.reportDetailModal) {
        closeReportDetailModal();
      }
    });
  }
  els.clearSignature.addEventListener('click', () => {
    if (!signaturePad) return;
    signaturePad.clear();
    els.signatureError.classList.add('hidden');
    els.signaturePadCanvas.classList.remove('error-highlight');
  });

  if (els.queueDashboardTiles) {
    els.queueDashboardTiles.querySelectorAll('[data-tile-scope="queue"][data-filter-value]').forEach(tile => {
      tile.addEventListener('click', () => {
        applyReportTileFilter('queue', tile.dataset.filterValue || 'all');
      });
    });
  }

  if (els.queueSearch) {
    els.queueSearch.addEventListener('input', event => {
      queueViewState.search = event.target.value || '';
      updateFilterStripSummary('queue');
      renderReportList();
    });
  }

  if (els.queueFilter) {
    els.queueFilter.addEventListener('change', event => {
      applyReportTileFilter('queue', event.target.value || 'all');
    });
  }

  if (els.archiveDashboardTiles) {
    els.archiveDashboardTiles.querySelectorAll('[data-tile-scope="archive"][data-filter-value]').forEach(tile => {
      tile.addEventListener('click', () => {
        applyReportTileFilter('archive', tile.dataset.filterValue || 'all');
      });
    });
  }

  if (els.archiveSearch) {
    els.archiveSearch.addEventListener('input', event => {
      archiveViewState.search = event.target.value || '';
      updateFilterStripSummary('archive');
      renderArchiveList();
    });
  }

  if (els.archiveFilter) {
    els.archiveFilter.addEventListener('change', event => {
      applyReportTileFilter('archive', event.target.value || 'all');
    });
  }

  if (els.exportQueueCsv) {
    els.exportQueueCsv.addEventListener('click', exportQueueCsvSummary);
  }

  if (els.exportArchiveCsv) {
    els.exportArchiveCsv.addEventListener('click', exportArchiveCsvSummary);
  }

  els.clearReports.addEventListener('click', () => {
    if (!reportData.length) return showToast('No reports to clear.', 3500);
    openConfirmModal({
      title: 'Clear Report Queue',
      message: 'This will delete all stored reports. Continue?',
      confirmLabel: 'Clear Reports',
      onConfirm: () => {
        reportData = [];
        saveQueueState();
        showToast('All reports cleared.');
      }
    });
  });
  els.reportItems.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-view-instance][data-source="queue"]');
    if (viewButton) {
      openReportDetailModal({
        source: 'queue',
        instance: viewButton.dataset.viewInstance
      });
      return;
    }

    const exportButton = event.target.closest('[data-export-instance][data-source="queue"]');
    if (exportButton) {
      openExportOptionsModal({
        scope: 'single',
        source: 'queue',
        instance: exportButton.dataset.exportInstance
      });
      return;
    }

    const archiveButton = event.target.closest('[data-archive-instance]');
    if (archiveButton) {
      const inst = archiveButton.dataset.archiveInstance;
      openConfirmModal({
        title: 'Archive Queued Report',
        message: 'Move this report from the queue into history?',
        confirmLabel: 'Archive Report',
        onConfirm: () => moveReportsToArchive(inst)
      });
      return;
    }

    const deleteButton = event.target.closest('[data-delete-report]');
    if (deleteButton) {
      const inst = deleteButton.dataset.deleteReport;
      openConfirmModal({
        title: 'Delete Queued Report',
        message: 'Delete this report from the queue?',
        confirmLabel: 'Delete Report',
        onConfirm: () => {
          reportData = reportData.filter(r => r.instance !== inst);
          saveQueueState();
          closeReportDetailModal();
          showToast('Queued report deleted.');
        }
      });
    }
  });
  els.archiveItems.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-view-instance][data-source="archive"]');
    if (viewButton) {
      openReportDetailModal({
        source: 'archive',
        instance: viewButton.dataset.viewInstance
      });
      return;
    }

    const exportButton = event.target.closest('[data-export-instance][data-source="archive"]');
    if (exportButton) {
      openExportOptionsModal({
        scope: 'single',
        source: 'archive',
        instance: exportButton.dataset.exportInstance
      });
      return;
    }

    const restoreButton = event.target.closest('[data-restore-instance]');
    if (restoreButton) {
      const inst = restoreButton.dataset.restoreInstance;
      openConfirmModal({
        title: 'Restore Archived Report',
        message: 'Restore this report to the active queue?',
        confirmLabel: 'Restore Report',
        onConfirm: () => restoreArchivedReport(inst)
      });
      return;
    }

    const deleteButton = event.target.closest('[data-delete-archive]');
    if (deleteButton) {
      const inst = deleteButton.dataset.deleteArchive;
      openConfirmModal({
        title: 'Delete Archived Report',
        message: 'Delete this archived report permanently?',
        confirmLabel: 'Delete Archive',
        onConfirm: () => deleteArchivedReport(inst)
      });
    }
  });

  els.exportReport.addEventListener('click', () => {
    openQueueExportFlow();
  });
  if (els.exportOptions) {
    els.exportOptions.addEventListener('click', () => {
      openQueueExportFlow();
    });
  }

  if (els.exportCancel) {
    els.exportCancel.addEventListener('click', () => {
      closeExportOptionsModal();
    });
  }

  if (els.exportRun) {
    els.exportRun.addEventListener('click', () => {
      pendingExportOptions = {
        contentMode: els.exportContentMode.value,
        afterMode: els.exportAfterMode.disabled ? 'keep' : els.exportAfterMode.value
      };

      const targetRows = pendingExportContext.scope === 'single' && pendingExportContext.instance
        ? getRowsByInstance(pendingExportContext.source === 'archive' ? archiveData : reportData, pendingExportContext.instance)
        : reportData;

      const filePrefix = pendingExportContext.scope === 'single'
        ? 'checklib_single_report'
        : 'checklib_combined_report';

      closeExportOptionsModal();
      exportGroupedPDFs(targetRows, { contentMode: pendingExportOptions.contentMode }, false, filePrefix);

      if (pendingExportContext.source === 'queue' && pendingExportContext.afterMode === 'archive') {
        if (pendingExportContext.scope === 'single' && pendingExportContext.instance) {
          moveReportsToArchive(pendingExportContext.instance);
        } else {
          moveReportsToArchive();
        }
      } else if (pendingExportContext.source === 'queue') {
        showToast(
          pendingExportContext.scope === 'single'
            ? 'Single report exported and kept in queue.'
            : 'Queue export complete. Reports kept in queue.'
        );
      } else {
        showToast('Archived report export complete.');
      }
    });
  }
  els.shareReports.addEventListener('click', shareAllReports);
  els.checkAllYes.addEventListener('click', () => {
    flattenTasks().forEach(item => {
      appState.answers[item.id] = 'Y';
      delete appState.comments[item.id];
      clearIssueForTask(item.id);
    });
    renderFromState();
  });
  els.clearForm.addEventListener('click', requestClearForm);
  els.saveProgress.addEventListener('click', saveProgress);
  els.loadProgress.addEventListener('click', loadProgress);
  els.checklistSelect.addEventListener('change', () => {
    localStorage.setItem('lastChecklistId', els.checklistSelect.value);
    loadChecklist(els.checklistSelect.value);
  });

  if (els.updateNow) {
    els.updateNow.addEventListener('click', () => {
      if (swRegistration && swRegistration.waiting) {
        hideUpdateBanner();
        showToast('Applying update...', 3000);
        swRegistration.waiting.postMessage({ action: 'skipWaiting' });
      }
    });
  }
  if (els.updateLater) {
    els.updateLater.addEventListener('click', () => {
      hideUpdateBanner();
      showToast('Update postponed until next refresh or app open.', 3000);
    });
  }
  els.checkUpdate.addEventListener('click', async () => {
    if (!('serviceWorker' in navigator)) return showToast('Service workers are not supported on this device.', 4000);
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return showToast('No service worker registration found.', 4000);
    swRegistration = reg;
    await reg.update();
    if (reg.waiting) {
      showUpdateBanner();
      return showToast('Update ready to install.', 3000);
    }
    showToast('No new update found.', 3000);
  });

  updateReportCountUI();
  updateDashboardTiles();
  updateFilterStripSummary('queue');
  updateFilterStripSummary('archive');
  renderReportList();
  renderArchiveList();
  updateOfflineState();
  window.addEventListener('online', updateOfflineState);
  window.addEventListener('offline', updateOfflineState);
  window.addEventListener('resize', resizeCanvas);
  loadChecklistMetadata();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').then(reg => {
      swRegistration = reg;
      if (reg.waiting) showUpdateBanner();
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
            showToast('App update available.', 3000);
          }
        });
      });
    }).catch(error => console.error('Service worker registration failed:', error));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (window.__swReloading) return;
      window.__swReloading = true;
      window.location.reload();
    });
  }
});

window.addEventListener('load', () => {
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) splash.remove();
    const app = document.getElementById('app');
    if (app) app.style.visibility = 'visible';
  }, 1800);
});
