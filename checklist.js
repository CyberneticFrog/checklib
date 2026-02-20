import { tutorialSteps } from './help.js';

// checklist.js

// Persisted storage
let reportData = JSON.parse(localStorage.getItem('reportData') || '[]');
let reportCount = parseInt(localStorage.getItem('reportCount') || '0', 10);

let checklistMetadata = {};

document.addEventListener('DOMContentLoaded', () => {
  // ──────────────
  // GRAB ELEMENTS
  // ──────────────
  const checklistForm = document.getElementById('checklist-form');
  const checklistSelect = document.getElementById('checklist-select');
  const checklistTitle = document.getElementById('checklist-title');
  const checklistContainer = document.getElementById('checklist-container');
  const addToReportButton = document.getElementById('add-to-report');
  const reportItems = document.getElementById('report-items');
  const exportReportButton = document.getElementById('export-report');
  const clearReportsButton = document.getElementById('clear-reports');
  const checkAllYesButton = document.getElementById('check-all-yes');
  const clearFormButton = document.getElementById('clear-form');
  const saveProgressButton = document.getElementById('save-progress');
  const loadProgressButton = document.getElementById('load-progress');
  const checkUpdateButton = document.getElementById('check-update');
  const progressBar = document.getElementById('progress-bar');
  const signatureModal = document.getElementById('signature-modal');
  const signaturePadCanvas = document.getElementById('signature-pad');
  const clearSignatureButton = document.getElementById('clear-signature');
  const confirmSignatureButton = document.getElementById('confirm-signature');
  const cancelSignatureButton = document.getElementById('cancel-signature');
  const signatureError = document.getElementById('signature-error');
  const themeToggle = document.getElementById('theme-toggle');
  const splashScreen = document.querySelector('.splash-screen');
  const PDF_META_FIELDS = ['date', 'supervisor', 'cleaner', 'unit'];

  // Tutorial Wizard Elements
  const learnButton = document.getElementById('learn-button');
  const tutorialModal = document.getElementById('tutorial-modal');
  const tutorialTitle = document.getElementById('tutorial-title');
  const tutorialDescription = document.getElementById('tutorial-description');
  const tutorialTip = document.getElementById('tutorial-tip');
  const tutorialLearnMore = document.getElementById('tutorial-learn-more');
  const tutorialLearnMoreText = document.getElementById('tutorial-learn-more-text');
  const tutorialImage = document.getElementById('tutorial-image');
  const tutorialProgress = document.getElementById('tutorial-progress');
  const tutorialBack = document.getElementById('tutorial-back');
  const tutorialNext = document.getElementById('tutorial-next');
  const tutorialSkip = document.getElementById('tutorial-skip');
  const tutorialClose = document.getElementById('tutorial-close');

  // Tutorial Wizard Variables
  // (we use the imported tutorialSteps array instead of shadowing it)
  let currentStepIndex = 0;

  function loadTutorial() {
    try {
      if (!tutorialSteps || !Array.isArray(tutorialSteps)) {
        throw new Error('Tutorial steps not available');
      }
      tutorialSteps.sort((a, b) => a.order - b.order); // Sort by order
    } catch (error) {
      console.error('Error loading tutorial:', error);
    }
  }

  // Show first-time prompt
  function showFirstTimePrompt() {
    if (!localStorage.getItem('hasSeenTutorialPrompt')) {
      const prompt = document.createElement('div');
      prompt.id = 'tutorial-prompt';
      prompt.style.position = 'fixed';
      prompt.style.top = '10%';
      prompt.style.left = '50%';
      prompt.style.transform = 'translateX(-50%)';
      prompt.style.background = document.body.classList.contains('dark-theme') ? '#333' : '#FFF';
      prompt.style.padding = '20px';
      prompt.style.border = '1px solid #31849B';
      prompt.style.zIndex = '1001';
      prompt.innerHTML = `
        <p>New to Check Lib? Click 'Learn' to start the tutorial!</p>
        <button id="prompt-dismiss">Dismiss</button>
      `;
      document.body.appendChild(prompt);
      document.getElementById('prompt-dismiss').addEventListener('click', () => {
        localStorage.setItem('hasSeenTutorialPrompt', 'true');
        prompt.remove();
      });
    }
  }

  // Display a tutorial step
  function displayStep(index) {
    if (index < 0 || index >= tutorialSteps.length || !tutorialSteps.length) return;
    currentStepIndex = index;
    localStorage.setItem('tutorialStep', index);

    const step = tutorialSteps[index];
    tutorialTitle.textContent = step.title;
    tutorialDescription.textContent = step.description;
    tutorialTip.textContent = step.tip ? `Tip: ${step.tip}` : '';
    if (step.learnMore) {
      tutorialLearnMore.style.display = 'block';
      tutorialLearnMoreText.textContent = step.learnMore;
    } else {
      tutorialLearnMore.style.display = 'none';
      tutorialLearnMoreText.textContent = '';
      tutorialLearnMoreText.style.display = 'none';
    }
    if (step.image) {
      tutorialImage.src = step.image;
      tutorialImage.alt = step.imageAlt || '';
      tutorialImage.style.display = 'block';
    } else {
      tutorialImage.src = '';
      tutorialImage.alt = '';
      tutorialImage.style.display = 'none';
    }
    tutorialProgress.textContent = `Step ${index + 1} of ${tutorialSteps.length}`;

    // Highlight element
    document.querySelectorAll('.pulse').forEach(el => el.classList.remove('pulse'));
    if (step.elementId) {
      const element = document.getElementById(step.elementId);
      if (element) element.classList.add('pulse');
    }

    // Update navigation buttons
    tutorialBack.disabled = index === 0;
    tutorialNext.disabled = index === tutorialSteps.length - 1;
  }

  // Show tutorial modal
  function showTutorial(startIndex = 0) {
    if (!tutorialSteps.length) {
      showToast('Help unavailable. Please contact support.', 4000);
      return;
    }
    signatureModal.classList.add('hidden'); // Close signature modal
    tutorialModal.style.display = 'block';
    displayStep(startIndex);
  }

  // Close tutorial modal
  function closeTutorial() {
    tutorialModal.style.display = 'none';
    document.querySelectorAll('.pulse').forEach(el => el.classList.remove('pulse'));
    if (currentStepIndex === tutorialSteps.length - 1) {
      localStorage.setItem('hasSeenTutorial', 'true');
    }
  }

  // Persisted storage
  let reportData = JSON.parse(localStorage.getItem('reportData') || '[]');

  /**
   * Displays a temporary toast notification.
   * @param {string} message - The message to show.
   * @param {number} duration_ms - How long before it disappears (default: 3000ms).
   */
  function showToast(message, duration_ms = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) {
      console.warn('Toast container not found');
      return;
    }
    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, duration_ms);
  }

  let deferredInstallPrompt;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const installBtn = document.getElementById('install-app');
    installBtn.hidden = false;
    showToast('Install available! Click the button to add this app.');
  });

  document.getElementById('install-app').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('Thanks for installing! 🎉');
    } else {
      showToast('Installation dismissed.');
    }
    deferredInstallPrompt = null;
    document.getElementById('install-app').hidden = true;
  });

  let isDirty = false;

  if (!checklistForm || !checklistSelect || !checklistContainer) {
    console.error('Missing critical DOM elements');
    return;
  }

  let signaturePad = null;
  try {
    signaturePad = new SignaturePad(signaturePadCanvas, {
      penColor: 'black',
      backgroundColor: 'rgb(255,255,255)',
      minWidth: 1,
      maxWidth: 2.5
    });
  } catch (e) {
    console.warn('SignaturePad init failed:', e);
  }

  const preferredTheme = localStorage.getItem('theme');
  if (
    preferredTheme === 'dark' ||
    (!preferredTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.body.classList.add('dark-theme');
    themeToggle.textContent = '☀️';
  } else {
    themeToggle.textContent = '🌙';
  }
  themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-theme');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });

  function updateReportCountUI() {
    document.getElementById('report-count').textContent = reportCount;
  }
  updateReportCountUI();
  renderReportList();

  let pendingAction = null;

  addToReportButton.addEventListener('click', () => {
    if (!validateForm()) return;
    pendingAction = 'addToReport';
    openSignatureModal();
  });

  exportReportButton.addEventListener('click', exportGroupedPDFs);

  clearReportsButton.addEventListener('click', () => {
    if (!reportData.length) {
      return alert('No reports to clear.');
    }
    if (!confirm('This will delete all stored reports. Continue?')) {
      return;
    }
    reportData = [];
    reportCount = 0;
    localStorage.removeItem('reportData');
    localStorage.removeItem('reportCount');
    updateReportCountUI();
    alert('All reports cleared.');
    renderReportList();
  });

  function renderReportList() {
    const instances = Array.from(new Set(reportData.map(r => r.instance)));
    reportItems.innerHTML = '';
    instances.forEach((inst, idx) => {
      const sample = reportData.find(r => r.instance === inst);
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="report-meta">
          ${idx + 1}. <strong>${sample.checklistName}</strong><br>
          <span class="report-date">Date: ${sample.date}</span>,
          <span class="report-unit">Unit: ${sample.unit}</span>
        </div>
        <button class="delete-report" data-instance="${inst}">Delete</button>
      `;
      reportItems.appendChild(li);
    });
  }

  reportItems.addEventListener('click', e => {
    if (!e.target.matches('.delete-report')) return;
    const inst = e.target.dataset.instance;
    if (!confirm('Delete this report from the queue?')) return;
    reportData = reportData.filter(r => r.instance !== inst);
    reportCount--;
    localStorage.setItem('reportData', JSON.stringify(reportData));
    localStorage.setItem('reportCount', reportCount.toString());
    updateReportCountUI();
    renderReportList();
  });

  confirmSignatureButton.addEventListener('click', () => {
    if (!signaturePad || signaturePad.isEmpty()) {
      signatureError.classList.remove('hidden');
      signaturePadCanvas.classList.add('error-highlight');
      return;
    }
    const sigUrl = signaturePad.toDataURL('image/png');
    closeSignatureModal();

    if (pendingAction === 'addToReport') {
      const instance = new Date().toISOString().replace(/[:\-]/g, '').replace(/\..+$/, '');
      const date = document.getElementById('checklist-date').value;
      const supervisor = document.getElementById('supervisor').value;
      const cleaner = document.getElementById('cleaner-team').value;
      const unit = document.getElementById('unit-area').value;
      const checklistId = checklistSelect.value;
      const checklistName = checklistMetadata[checklistId]?.title || checklistId;

      document.querySelectorAll('.checklist-item').forEach(item => {
        let prev = item.previousElementSibling;
        while (prev && prev.tagName !== 'H3') prev = prev.previousElementSibling;
        const section = prev ? prev.textContent : '';
        const task = item.querySelector('.task-description').textContent;
        const value = getRadioValue(item.querySelector('input[type="radio"]').name);
        const comment = item.querySelector('.comments-input').value.trim();

        reportData.push({
          checklistId,
          checklistName,
          instance,
          date,
          supervisor,
          cleaner,
          unit,
          section,
          task,
          value,
          comment,
          signatureDataUrl: sigUrl
        });
      });

      localStorage.setItem('reportData', JSON.stringify(reportData));
      reportCount++;
      localStorage.setItem('reportCount', reportCount.toString());
      updateReportCountUI();

      showToast('This check has been added to your report.');
      clearForm();
      renderReportList();
    }

    pendingAction = null;
  });

  cancelSignatureButton.addEventListener('click', closeSignatureModal);

  function updateChecklistTitle(id) {
    checklistTitle.textContent = checklistMetadata[id]?.title || 'Unknown Checklist';
  }

  function loadChecklist(id) {
    updateChecklistTitle(id);
    fetch(`checks/${id}.csv`)
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.text();
      })
      .then(txt => {
        Papa.parse(txt, {
          header: true,
          complete: result => {
            renderChecklist(result.data);
            initializeCommentFields();
            updateProgressBar();
          }
        });
      })
      .catch(err => {
        console.error('Load error:', err);
        renderChecklist([{ section: 'Error', task: 'Could not load checklist.' }]);
      });
  }

  function renderChecklist(data) {
    checklistContainer.innerHTML = '';
    let currentSection = '';
    data.forEach((item, i) => {
      if (item.section && item.task) {
        if (item.section !== currentSection) {
          currentSection = item.section;
          const h3 = document.createElement('h3');
          h3.textContent = currentSection;
          checklistContainer.appendChild(h3);
        }
        const div = document.createElement('div');
        div.className = 'checklist-item';
        const id = `task_${i}_${item.task.replace(/\s+/g, '_')}`;
        div.innerHTML = `
          <span class="task-description">${item.task}</span>
          <div class="radio-group">
            <label><input type="radio" name="${id}" value="Y"> Y</label>
            <label><input type="radio" name="${id}" value="N"> N</label>
            <label><input type="radio" name="${id}" value="NA"> N/A</label>
          </div>
          <div class="comments-container">
            <button type="button" class="add-comment" data-textarea="comment_${id}">
              Add Comment
            </button>
            <span class="comment-required hidden">Please Explain</span>
            <textarea class="comments-input" name="comment_${id}" disabled></textarea>
          </div>`;
        checklistContainer.appendChild(div);
        div.querySelectorAll('input[type="radio"]').forEach(radio => {
          radio.addEventListener('change', e => {
            updateCommentFields(e.target.name, e.target.value);
            updateProgressBar();
          });
        });
      }
    });
    checklistContainer.querySelectorAll('.add-comment').forEach(btn => {
      btn.addEventListener('click', () => {
        const ta = checklistContainer.querySelector(
          `textarea[name="${btn.dataset.textarea}"]`
        );
        if (ta) {
          ta.disabled = false;
          ta.focus();
          btn.style.display = 'none';
        }
      });
    });
  }

  function getRadioValue(name) {
    const c = document.querySelector(`input[name="${name}"]:checked`);
    return c ? c.value : '';
  }

  function updateCommentFields(name, value) {
    const radios = document.getElementsByName(name);
    const changed = Array.from(radios).find(r => r.checked);
    if (!changed) return;
    const item = changed.closest('.checklist-item');
    const ta = item.querySelector('.comments-input');
    const link = item.querySelector('.add-comment');
    const req = item.querySelector('.comment-required');
    if (value === 'N') {
      ta.disabled = false;
      ta.focus();
      link.style.display = 'none';
      req.classList.remove('hidden');
    } else {
      ta.disabled = true;
      ta.value = '';
      link.style.display = 'inline';
      req.classList.add('hidden');
    }
  }

  function initializeCommentFields() {
    document.querySelectorAll('.checklist-item').forEach(item => {
      const r = item.querySelector('input[type=radio]');
      updateCommentFields(r.name, getRadioValue(r.name));
    });
  }

  function updateProgressBar() {
    const total = document.querySelectorAll('.checklist-item').length;
    const done = document.querySelectorAll('input[type=radio]:checked').length;
    const pct = total ? Math.round(done / total * 100) : 0;
    progressBar.style.setProperty('--progress-width', `${pct}%`);
    progressBar.classList.remove('red', 'amber', 'green');
    if (pct <= 49) progressBar.classList.add('red');
    else if (pct <= 80) progressBar.classList.add('amber');
    else progressBar.classList.add('green');
    const text = document.querySelector('.progress-text');
    if (text) text.textContent = `${pct}% Progress`;
  }

  function validateForm() {
    document.querySelectorAll('.error-message').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.error-highlight').forEach(el => el.classList.remove('error-highlight'));
    const fields = ['checklist-date', 'supervisor', 'cleaner-team', 'unit-area'];
    for (const id of fields) {
      const el = document.getElementById(id);
      const msgEl = document.getElementById(`error-${id}`);
      if (!el.value.trim()) {
        el.classList.add('error-highlight');
        if (msgEl) {
          msgEl.textContent = `${el.labels[0].textContent} is required.`;
          msgEl.classList.remove('hidden');
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        return false;
      }
    }
    for (const item of document.querySelectorAll('.checklist-item')) {
      const name = item.querySelector('input[type="radio"]').name;
      const val = getRadioValue(name);
      if (!val) {
        item.classList.add('error-highlight');
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
      if (val === 'N') {
        const ta = item.querySelector('.comments-input');
        const req = item.querySelector('.comment-required');
        if (!ta.value.trim()) {
          ta.classList.add('error-highlight');
          req.classList.remove('hidden');
          ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
          ta.focus();
          return false;
        }
      }
    }
    return true;
  }

  function resizeCanvas() {
    if (!signaturePad) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    signaturePadCanvas.width = signaturePadCanvas.offsetWidth * ratio;
    signaturePadCanvas.height = signaturePadCanvas.offsetHeight * ratio;
    signaturePadCanvas.getContext('2d').scale(ratio, ratio);
    signaturePad.clear();
  }

  function openSignatureModal() {
    if (!validateForm()) return;
    signatureError.classList.add('hidden');
    signaturePadCanvas.classList.remove('error-highlight');
    signatureModal.classList.remove('hidden');
    resizeCanvas();
  }

  function closeSignatureModal() {
    signatureModal.classList.add('hidden');
    if (signaturePad) signaturePad.clear();
  }

  function exportGroupedPDFs() {
    if (!reportData.length) {
      alert('No reports to export. Click "Add to Report" first.');
      return;
    }
    if (!window.jspdf) {
      console.error('window.jspdf is undefined—cannot export PDF');
      alert('PDF export unavailable (library not loaded).');
      return;
    }
    const { jsPDF } = window.jspdf;

    const typeOrder = [];
    const groups = {};

    reportData.forEach(row => {
      const { checklistId, instance } = row;
      if (!groups[checklistId]) {
        groups[checklistId] = { instanceOrder: [], byInstance: {} };
        typeOrder.push(checklistId);
      }
      const type = groups[checklistId];
      if (!type.byInstance[instance]) {
        type.byInstance[instance] = [];
        type.instanceOrder.push(instance);
      }
      type.byInstance[instance].push(row);
    });

    typeOrder.forEach(checklistId => {
      const { byInstance, instanceOrder } = groups[checklistId];
      const title = checklistMetadata[checklistId]?.title || checklistId;
      const footerText = checklistMetadata[checklistId]?.footerText || '© 2025 Check Lib';
      const doc = new jsPDF();
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      // Table of Contents
      doc.setFillColor(49, 132, 155);
      doc.rect(0, 0, width, 12, 'F');
      doc.setTextColor('#FFF');
      doc.setFontSize(14);
      doc.text('Table of Contents', width / 2, 8, { align: 'center' });

      doc.setTextColor('#000');
      doc.setFontSize(11);
      let y = 20;
      instanceOrder.forEach((inst, idx) => {
        const sample = byInstance[inst][0];
        doc.text(
          `${idx + 1}. ${sample.date} – ${sample.supervisor} – ${sample.unit} (Page ${idx + 2})`,
          10, y
        );
        y += 7;
        if (y > height - 20) {
          doc.addPage();
          y = 20;
        }
      });
      // Add footer to Table of Contents page
      doc.setFontSize(8);
      doc.text(footerText, width / 2, 290, { align: 'center' });

      const estimatedPages = 1 + instanceOrder.length;
      if (estimatedPages > 20 && 
          !confirm(`This PDF for "${title}" will be approx. ${estimatedPages} pages. Continue?`)
      ) {
        return;
      }

      instanceOrder.forEach((inst, idx) => {
        doc.addPage();
        doc.setFillColor(49, 132, 155);
        doc.rect(0, 0, width, 12, 'F');
        doc.setTextColor('#FFF');
        doc.setFontSize(14);
        doc.text(title, width / 2, 8, { align: 'center' });

        doc.setTextColor('#000');
        doc.setFontSize(11);
        let py = 20;
        const meta = byInstance[inst][0];
		PDF_META_FIELDS.forEach(field => {
		  let label = field;

		  if (field === 'cleaner') {
			label = 'Team member';
		  } else {
			label = field.charAt(0).toUpperCase() + field.slice(1);
		  }

		  doc.text(
			`${label}: ${meta[field]}`,
			10, py
		  );
		  py += 6;
		});
        py += 4;

        // Column headers
        doc.setFontSize(10);
        doc.text('Section', 10, py);
        doc.text('Task', 40, py);
        doc.text('Value', 110, py);
        doc.text('Comment', 120, py);
        py += 6;

        byInstance[inst].forEach(row => {
          const sectionWrap = doc.splitTextToSize(row.section, 30); // 30mm width
          const taskWrap = doc.splitTextToSize(row.task, 70); // 70mm width
          const valueText = row.value || '';
          const commentText = row.comment || '';
          
          // Calculate height for this row
          const sectionHeight = sectionWrap.length * 5;
          const taskHeight = taskWrap.length * 5;
          const rowHeight = Math.max(sectionHeight, taskHeight, 5);
          
          if (py + rowHeight > height - 40) {
            doc.addPage();
            py = 20;
            // Redraw headers on new page
            doc.setFontSize(10);
            doc.text('Section', 10, py);
            doc.text('Task', 40, py);
            doc.text('Value', 110, py);
            doc.text('Comment', 120, py);
            py += 6;
          }

          // Render columns
          doc.setFontSize(10);
          doc.text(sectionWrap, 10, py);
          doc.text(taskWrap, 40, py);
          doc.text(valueText, 110, py);
          if (commentText) {
            const commentWrap = doc.splitTextToSize(commentText, 60); // 60mm width
            doc.text(commentWrap, 120, py);
          }
          py += rowHeight + 1; // 1mm extra spacing
        });

        if (byInstance[inst][0].signatureDataUrl) {
          const sigY = py + 10;
          if (sigY < height - 60) {
            doc.addImage(
              byInstance[inst][0].signatureDataUrl, 
              'PNG', 10, sigY, 50, 25
            );
          }
        }
        // Add footer to report page
        doc.setFontSize(8);
        doc.text(footerText, width / 2, 290, { align: 'center' });
      });

      const now = new Date();
      const ts = now.toISOString().replace(/[:\-]/g, '').replace(/\..+$/, '');
      doc.save(`combined_report_${checklistId}_${ts}.pdf`);
    });
  }

  function shareAllReports() {
    if (!reportData.length) {
      showToast('No reports to share. Click "Add to Report" first.', 4000);
      return;
    }
    if (!window.jspdf) {
      showToast('PDF generation unavailable (library not loaded).', 4000);
      return;
    }
    const { jsPDF } = window.jspdf;

    const typeOrder = [];
    const groups = {};

    reportData.forEach(row => {
      const { checklistId, instance } = row;
      if (!groups[checklistId]) {
        groups[checklistId] = { instanceOrder: [], byInstance: {} };
        typeOrder.push(checklistId);
      }
      const type = groups[checklistId];
      if (!type.byInstance[instance]) {
        type.byInstance[instance] = [];
        type.instanceOrder.push(instance);
      }
      type.byInstance[instance].push(row);
    });

    const attachments = [];
    typeOrder.forEach(checklistId => {
      const { byInstance, instanceOrder } = groups[checklistId];
      const title = checklistMetadata[checklistId]?.title || checklistId;
      const footerText = checklistMetadata[checklistId]?.footerText || '© 2025 Check Lib';
      const doc = new jsPDF();
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      // Table of Contents
      doc.setFillColor(49, 132, 155);
      doc.rect(0, 0, width, 12, 'F');
      doc.setTextColor('#FFF');
      doc.setFontSize(14);
      doc.text('Table of Contents', width / 2, 8, { align: 'center' });

      doc.setTextColor('#000');
      doc.setFontSize(11);
      let y = 20;
      instanceOrder.forEach((inst, idx) => {
        const sample = byInstance[inst][0];
        doc.text(
          `${idx + 1}. ${sample.date} – ${sample.supervisor} – ${sample.unit} (Page ${idx + 2})`,
          10, y
        );
        y += 7;
        if (y > height - 20) {
          doc.addPage();
          y = 20;
        }
      });
      // Add footer to Table of Contents page
      doc.setFontSize(8);
      doc.text(footerText, width / 2, 290, { align: 'center' });

      instanceOrder.forEach((inst, idx) => {
        doc.addPage();
        doc.setFillColor(49, 132, 155);
        doc.rect(0, 0, width, 12, 'F');
        doc.setTextColor('#FFF');
        doc.setFontSize(14);
        doc.text(title, width / 2, 8, { align: 'center' });

        doc.setTextColor('#000');
        doc.setFontSize(11);
        let py = 20;
        const meta = byInstance[inst][0];
		PDF_META_FIELDS.forEach(field => {
		  let label = field;

		  if (field === 'cleaner') {
			label = 'Team member';
		  } else {
			label = field.charAt(0).toUpperCase() + field.slice(1);
		  }

		  doc.text(
			`${label}: ${meta[field]}`,
			10, py
		  );
		  py += 6;
		});
        py += 4;

        // Column headers
        doc.setFontSize(10);
        doc.text('Section', 10, py);
        doc.text('Task', 40, py);
        doc.text('Value', 110, py);
        doc.text('Comment', 120, py);
        py += 6;

        byInstance[inst].forEach(row => {
          const sectionWrap = doc.splitTextToSize(row.section, 30); // 30mm width
          const taskWrap = doc.splitTextToSize(row.task, 70); // 70mm width
          const valueText = row.value || '';
          const commentText = row.comment || '';
          
          // Calculate height for this row
          const sectionHeight = sectionWrap.length * 5;
          const taskHeight = taskWrap.length * 5;
          const rowHeight = Math.max(sectionHeight, taskHeight, 5);
          
          if (py + rowHeight > height - 40) {
            doc.addPage();
            py = 20;
            // Redraw headers on new page
            doc.setFontSize(10);
            doc.text('Section', 10, py);
            doc.text('Task', 40, py);
            doc.text('Value', 110, py);
            doc.text('Comment', 120, py);
            py += 6;
          }

          // Render columns
          doc.setFontSize(10);
          doc.text(sectionWrap, 10, py);
          doc.text(taskWrap, 40, py);
          doc.text(valueText, 110, py);
          if (commentText) {
            const commentWrap = doc.splitTextToSize(commentText, 60); // 60mm width
            doc.text(commentWrap, 120, py);
          }
          py += rowHeight + 1; // 1mm extra spacing
        });

        if (byInstance[inst][0].signatureDataUrl) {
          const sigY = py + 10;
          if (sigY < height - 60) {
            doc.addImage(
              byInstance[inst][0].signatureDataUrl, 
              'PNG', 10, sigY, 50, 25
            );
          }
        }
        // Add footer to report page
        doc.setFontSize(8);
        doc.text(footerText, width / 2, 290, { align: 'center' });
      });

      const pdfDataUrl = doc.output('datauristring');
      const safeId = checklistId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const now = new Date();
      const safeDate = now.toISOString().replace(/[:\-]/g, '').replace(/\..+$/, '');
      attachments.push({
        filename: `combined_report_${safeId}_${safeDate}.pdf`,
        content: pdfDataUrl.split(',')[1],
        type: 'application/pdf'
      });
      doc.save(`combined_report_${safeId}_${safeDate}.pdf`);
    });

    const emailSubject = encodeURIComponent('Check Lib Reports');
    const emailBody = encodeURIComponent('Attached are the generated checklist reports. Please attach the PDFs from your downloads folder.');
    const mailtoLink = `mailto:?subject=${emailSubject}&body=${emailBody}`;
    try {
      window.location.href = mailtoLink;
      showToast('Email client opened. Please manually attach PDFs from your downloads folder.', 5000);
    } catch (e) {
      console.error('Failed to open email client:', e);
      showToast('Could not open email client. PDFs saved to downloads folder.', 5000);
    }
  }

  function clearForm() {
    checklistSelect.value = '';
    document.getElementById('checklist-date').value = '';
    document.getElementById('supervisor').value = '';
    document.getElementById('cleaner-team').value = '';
    document.getElementById('unit-area').value = '';

    document.querySelectorAll('.checklist-item').forEach(item => {
      item.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
      const ta = item.querySelector('.comments-input');
      ta.value = '';
      ta.disabled = true;
      const addBtn = item.querySelector('.add-comment');
      addBtn.style.display = 'inline';
      const notice = item.querySelector('.comment-required');
      notice.classList.add('hidden');
    });

    updateProgressBar();
    showToast('Form cleared.');
  }

  function saveProgress() {
    const data = {
      checklistId: checklistSelect.value,
      date: document.getElementById('checklist-date').value || '',
      supervisor: document.getElementById('supervisor').value || '',
      cleanerTeam: document.getElementById('cleaner-team').value || '',
      unit: document.getElementById('unit-area').value || '',
      checklist: []
    };

    document.querySelectorAll('.checklist-item').forEach(item => {
      const radio = item.querySelector('input[type="radio"]:checked');
      const comment = item.querySelector('.comments-input').value.trim();
      data.checklist.push({
        task: item.querySelector('.task-description').textContent,
        value: radio ? radio.value : '',
        comment
      });
    });

    localStorage.setItem('checklistProgress', JSON.stringify(data));
    showToast('Progress saved successfully!');
    if (!navigator.onLine) {
      showToast('Offline: saved locally.');
    }
  }

  function loadProgress() {
    const saved = localStorage.getItem('checklistProgress');
    if (!saved) return alert('No saved progress found.');
    const data = JSON.parse(saved);
    if (data.checklistId !== checklistSelect.value) {
      return alert('Saved data is for a different checklist.');
    }
    document.getElementById('checklist-date').value = data.date || '';
    document.getElementById('supervisor').value = data.supervisor || '';
    document.getElementById('cleaner-team').value = data.cleanerTeam || '';
    document.getElementById('unit-area').value = data.unit || '';
    document.querySelectorAll('.checklist-item').forEach(item => {
      const task = item.querySelector('.task-description').textContent;
      const entry = data.checklist.find(e => e.task === task);
      if (entry) {
        item.querySelectorAll('input[type="radio"]').forEach(r => {
          if (r.value === entry.value) r.checked = true;
        });
        updateCommentFields(item.querySelector('input[type=radio]').name, entry.value);
        const ta = item.querySelector('.comments-input');
        ta.value = entry.comment; if (entry.value === 'N') ta.disabled = false;
      }
    });
    updateProgressBar();
    alert('Progress loaded successfully!');
  }

  async function loadChecklistMetadata() {
    try {
      const res = await fetch(`checklists.json`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      checklistMetadata = data.reduce((o, i) => (
        o[i.id] = { title: i.title, footerText: i.footerText }, o
      ), {});
      checklistSelect.innerHTML = data.map(i => `<option value="${i.id}">${i.title}</option>`).join('');
      const last = localStorage.getItem('lastChecklistId');
      checklistSelect.value = last && checklistMetadata[last] ? last : data[0].id;
      loadChecklist(checklistSelect.value);
      updateProgressBar();
    } catch (e) {
      console.error('Metadata load failed:', e);
      alert('Could not load available checklists.');
    }
  }

  // Initialize tutorial
  loadTutorial();
  showFirstTimePrompt();
  const savedStep = localStorage.getItem('tutorialStep');
  if (savedStep && !localStorage.getItem('hasSeenTutorial')) {
    currentStepIndex = parseInt(savedStep, 10);
  }

  learnButton.addEventListener('click', () => {
    showTutorial(currentStepIndex);
  });

  tutorialBack.addEventListener('click', () => {
    if (currentStepIndex > 0) displayStep(currentStepIndex - 1);
  });

  tutorialNext.addEventListener('click', () => {
    if (currentStepIndex < tutorialSteps.length - 1) displayStep(currentStepIndex + 1);
  });

  tutorialSkip.addEventListener('click', closeTutorial);
  tutorialClose.addEventListener('click', closeTutorial);


  tutorialLearnMore.addEventListener('click', () => {
    tutorialLearnMoreText.style.display = tutorialLearnMoreText.style.display === 'none' ? 'block' : 'none';
  });

  loadChecklistMetadata();

  checklistSelect.addEventListener('change', () => {
    localStorage.setItem('lastChecklistId', checklistSelect.value);
    loadChecklist(checklistSelect.value);
  });
  checkAllYesButton.addEventListener('click', () => {
    document.querySelectorAll('input[value="Y"]').forEach(r => {
      r.checked = true; updateCommentFields(r.name, 'Y');
    });
    updateProgressBar();
  });
  clearFormButton.addEventListener('click', clearForm);
  saveProgressButton.addEventListener('click', saveProgress);
  loadProgressButton.addEventListener('click', loadProgress);
  document.getElementById('share-reports').addEventListener('click', () => {
    if (!reportData.length) {
      showToast('No reports to share. Click "Add to Report" first.', 4000);
      return;
    }
    shareAllReports();
  });
  clearSignatureButton.addEventListener('click', () => {
    if (signaturePad) {
      signaturePad.clear();
      signatureError.classList.add('hidden');
      signaturePadCanvas.classList.remove('error-highlight');
    }
  });
  cancelSignatureButton.addEventListener('click', closeSignatureModal);
  checklistForm.addEventListener('change', e => {
    isDirty = true;
    if (e.target.type === 'radio') {
      updateCommentFields(e.target.name, e.target.value);
      updateProgressBar();
    }
  });
  window.addEventListener('resize', resizeCanvas);
});

window.addEventListener('load', () => {
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) splash.remove();
    const app = document.getElementById('app');
    if (app) app.style.visibility = 'visible';
  }, 1800);
});