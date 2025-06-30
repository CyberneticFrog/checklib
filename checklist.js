// checklist.js

// Persisted storage
let reportData  = JSON.parse(localStorage.getItem('reportData')  || '[]');
let reportCount = parseInt(localStorage.getItem('reportCount') || '0', 10);

let checklistMetadata = {};

document.addEventListener('DOMContentLoaded', () => {
  // ──────────────
  // GRAB ELEMENTS
  // ──────────────
  const checklistForm         = document.getElementById('checklist-form');
  const checklistSelect       = document.getElementById('checklist-select');
  const checklistTitle        = document.getElementById('checklist-title');
  const checklistContainer    = document.getElementById('checklist-container');
  const exportPdfButton       = document.getElementById('export-pdf');
  const addToReportButton     = document.getElementById('add-to-report');
  const reportItems           = document.getElementById('report-items');
  const exportReportButton    = document.getElementById('export-report');
  const clearReportsButton    = document.getElementById('clear-reports');
  const checkAllYesButton     = document.getElementById('check-all-yes');
  const clearFormButton       = document.getElementById('clear-form');
  const saveProgressButton    = document.getElementById('save-progress');
  const loadProgressButton    = document.getElementById('load-progress');
  const checkUpdateButton     = document.getElementById('check-update');
  const progressBar           = document.getElementById('progress-bar');
  const signatureModal        = document.getElementById('signature-modal');
  const signaturePadCanvas    = document.getElementById('signature-pad');
  const clearSignatureButton  = document.getElementById('clear-signature');
  const confirmSignatureButton= document.getElementById('confirm-signature');
  const cancelSignatureButton = document.getElementById('cancel-signature');
  const signatureError        = document.getElementById('signature-error');
  const themeToggle           = document.getElementById('theme-toggle');
  const splashScreen          = document.querySelector('.splash-screen');
  const PDF_META_FIELDS = ['date', 'supervisor', 'cleaner', 'unit'];



  // Persisted storage
  let reportData  = JSON.parse(localStorage.getItem('reportData')  || '[]');


/**
 * Displays a temporary toast notification.
 * @param {string} message - The message to show.
 * @param {number} duration_ms - How long before it disappears (default: 3000ms).
 */
function showToast(message, duration_ms = 3000) {
  // Ensure the container exists
  const container = document.getElementById('toast-container');
  if (!container) {
    console.warn('Toast container not found');
    return;
  }
  // Create toast element
  const toast = document.createElement('div');
  toast.classList.add('toast');
  toast.textContent = message;
  container.appendChild(toast);

  // Trigger show animation
  requestAnimationFrame(() => toast.classList.add('show'));

  // After duration, remove toast
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration_ms);
}


let deferredInstallPrompt;

// 1) Capture the event
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();

  // Stash the event so it can be triggered later.
  deferredInstallPrompt = e;

  // Un-hide your install button
  const installBtn = document.getElementById('install-app');
  installBtn.hidden = false;

  // (Optional) show a toast or highlight to draw attention
  showToast('Install available! Click the button to add this app.');
});

// 2) Handle the click on your install button
document.getElementById('install-app').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;

  // Show the browser install prompt
  deferredInstallPrompt.prompt();

  // Wait for user choice
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    showToast('Thanks for installing! 🎉');
  } else {
    showToast('Installation dismissed.');
  }

  // Clear the saved prompt — it can only be used once
  deferredInstallPrompt = null;

  // Hide the install button again
  document.getElementById('install-app').hidden = true;
});



  // ────────────────────────────────────────────────
  // 1) UNSAVED‐CHANGES WARNING: dirty‐form flag
  // ────────────────────────────────────────────────
  let isDirty = false;

  if (!checklistForm || !checklistSelect || !checklistContainer) {
    console.error('Missing critical DOM elements');
    return;
  }

  // ────────────────────────
  // INITIALIZE SIGNATURE PAD
  // ────────────────────────
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

  // ─────────────
  // DARK MODE TOGGLE
  // ─────────────
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

  // ────────────────────────────
  // REPORT DATA & COUNTER SETUP
  // ────────────────────────────
  function updateReportCountUI() {
    document.getElementById('report-count').textContent = reportCount;
  }
  updateReportCountUI();
  // populate the list of reports already in storage
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
    // Clear in-memory and persistent storage
    reportData = [];
    reportCount = 0;
    localStorage.removeItem('reportData');
    localStorage.removeItem('reportCount');
    updateReportCountUI();
    alert('All reports cleared.');
    renderReportList();
  });

    /**
   * Render each report‐instance with a Delete button.
   */
  function renderReportList() {
    // 1) Get unique instance IDs in insertion order
    const instances = Array.from(new Set(reportData.map(r => r.instance)));
    // 2) Clear out the <ul>
    reportItems.innerHTML = '';

    // 3) Build one <li> per instance
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

  // handle clicks on any Delete button in the list
  reportItems.addEventListener('click', e => {
    if (!e.target.matches('.delete-report')) return;
    const inst = e.target.dataset.instance;
    if (!confirm('Delete this report from the queue?')) return;

    // remove all rows for that instance
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
        // ——— collect a unique instance timestamp ———
        const instance = new Date().toISOString().replace(/[:\-]/g, '').replace(/\..+$/, '');

        // ——— gather form meta once ———
        const date          = document.getElementById('checklist-date').value;
        const supervisor    = document.getElementById('supervisor').value;
        const cleaner       = document.getElementById('cleaner-team').value;
        const unit          = document.getElementById('unit-area').value;
        const checklistId   = checklistSelect.value;
        const checklistName = checklistMetadata[checklistId]?.title || checklistId;

        // ——— push one row PER ITEM, tagging instance + signature ———
        document.querySelectorAll('.checklist-item').forEach(item => {
          let prev = item.previousElementSibling;
          while (prev && prev.tagName !== 'H3') prev = prev.previousElementSibling;
          const section = prev ? prev.textContent : '';
          const task    = item.querySelector('.task-description').textContent;
          const value   = getRadioValue(item.querySelector('input[type="radio"]').name);
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

        // persist & bump count
        localStorage.setItem('reportData', JSON.stringify(reportData));
        reportCount++;
        localStorage.setItem('reportCount', reportCount.toString());
        updateReportCountUI();

        alert('This check has been added to your report.');
        clearForm();
        renderReportList();
      } else {
        // ——— Export PDF for single checklist (existing flow) ———
        exportToPDF(sigUrl);
      }

      pendingAction = null;
    });


  cancelSignatureButton.addEventListener('click', closeSignatureModal);

  // ────────────────────────
  // FETCH & RENDER CHECKLIST
  // ────────────────────────
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
        renderChecklist([{ section:'Error', task:'Could not load checklist.' }]);
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
        const id = `task_${i}_${item.task.replace(/\s+/g,'_')}`;
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
            // ————— Bind radio change events for this item —————
            div.querySelectorAll('input[type="radio"]').forEach(radio => {
              radio.addEventListener('change', e => {
                // enable/disable the matching comment box:
                updateCommentFields(e.target.name, e.target.value);
                // refresh any progress UI you have:
                updateProgressBar();
              });
            });
      }
    });
    // Bind comments links
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
    // 1) Find the radio input that actually changed:
    const radios = document.getElementsByName(name);
    const changed = Array.from(radios).find(r => r.checked);
    if (!changed) return;

    // 2) From that radio, walk up to the .checklist-item container:
    const item = changed.closest('.checklist-item');
    const ta   = item.querySelector('.comments-input');
    const link = item.querySelector('.add-comment');
    const req  = item.querySelector('.comment-required');

    // 3) Toggle based on “N” or not:
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
    const done  = document.querySelectorAll('input[type=radio]:checked').length;
    const pct   = total ? Math.round(done/total*100) : 0;
    progressBar.style.setProperty('--progress-width', `${pct}%`);
    progressBar.classList.remove('red','amber','green');
    if      (pct <= 49) progressBar.classList.add('red');
    else if (pct <= 80) progressBar.classList.add('amber');
    else                progressBar.classList.add('green');
    const text = document.querySelector('.progress-text');
    if (text) text.textContent = `${pct}% Progress`;
  }

    /**
   * Return true if the form is valid; otherwise,
   * highlight the first error inline and return false.
   */
  function validateForm() {
    // 1) Clear previous error states
    document.querySelectorAll('.error-message').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.error-highlight').forEach(el => el.classList.remove('error-highlight'));

    // 2) Validate top‐level fields in order
    const fields = ['checklist-date','supervisor','cleaner-team','unit-area'];
    for (const id of fields) {
      const el    = document.getElementById(id);
      const msgEl = document.getElementById(`error-${id}`);
      if (!el.value.trim()) {
        // highlight input
        el.classList.add('error-highlight');
        // show inline message
        if (msgEl) {
          msgEl.textContent = `${el.labels[0].textContent} is required.`;
          msgEl.classList.remove('hidden');
        }
        // scroll & focus
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        return false;
      }
    }

    // 3) Validate each checklist item
    for (const item of document.querySelectorAll('.checklist-item')) {
      const name = item.querySelector('input[type="radio"]').name;
      const val  = getRadioValue(name);
      // a) Missing answer?
      if (!val) {
        item.classList.add('error-highlight');
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
      // b) Answer “N” but no comment?
      if (val === 'N') {
        const ta  = item.querySelector('.comments-input');
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

    // 4) All good!
    return true;
  }


  function resizeCanvas() {
    if (!signaturePad) return;
    const ratio = Math.max(window.devicePixelRatio||1,1);
    signaturePadCanvas.width  = signaturePadCanvas.offsetWidth * ratio;
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

  function exportToPDF(signatureDataUrl) {
    if (!window.jspdf) {
      alert('PDF export unavailable');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 10;
    const date       = document.getElementById('checklist-date').value || 'N/A';
    const supervisor = document.getElementById('supervisor').value || 'N/A';
    const cleaner    = document.getElementById('cleaner-team').value || 'N/A';
    const unit       = document.getElementById('unit-area').value || 'N/A';
    const cid        = checklistSelect.value;
    const cTitle     = checklistMetadata[cid]?.title || cid;

    doc.setFontSize(16);
    doc.text(`Checklist: ${cTitle}`, 10, y); y += 8;
    doc.setFontSize(12);
    doc.text(`Date: ${date}`, 10, y); y += 6;
    doc.text(`Team Leader / Manager: ${supervisor}`, 10, y); y += 6;
    doc.text(`Cleaner/Team: ${cleaner}`, 10, y); y += 6;
    doc.text(`Unit: ${unit}`, 10, y); y += 10;

    document.querySelectorAll('#checklist-container > *').forEach(el => {
      if (el.tagName === 'H3') {
        doc.setFontSize(14);
        doc.text(el.textContent, 10, y); y += 7;
      } else if (el.classList.contains('checklist-item')) {
        const task    = el.querySelector('.task-description').textContent;
        const val     = getRadioValue(el.querySelector('input[type=radio]').name);
        const comment = el.querySelector('.comments-input').value.trim();
        let line = `${task}: ${val==='Y'?'Yes':val==='N'?'No':'N/A'}`;
        if (comment) line += ` – ${comment}`;
        const lines = doc.splitTextToSize(line, 180);
        doc.setFontSize(10);
        doc.text(lines, 12, y);
        y += lines.length*5 + 3;
      }
      if (y > 270) { doc.addPage(); y = 10; }
    });

    if (signatureDataUrl) {
      if (y > 250) { doc.addPage(); y = 10; }
      doc.text('Signature:', 10, y); y += 6;
      doc.addImage(signatureDataUrl, 'PNG', 10, y, 50, 25);
      y += 30;
    }

    doc.setFontSize(8);
    doc.text('© 2025 Check Lib', 10, 290);

    const safeId   = cid.replace(/[^a-zA-Z0-9_-]/g,'_');
    const safeDate = date.replace(/[^0-9]/g,'') || 'nodate';
    doc.save(`${safeId}_${safeDate}.pdf`);
  }

  /**
   * Generate one PDF per checklist type, with
   *  • Table of Contents
   *  • Banner header (#31849B / white)
   *  • One section per instance
   *  • Embedded signature image
   *  • Page-count warning if >20 pages
   */
   function exportGroupedPDFs() {
     console.log('exportGroupedPDFs() fired');
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

    // 1) Group in insertion order by checklistId → instance timestamp
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

    // 2) For each checklist type, build a PDF
    typeOrder.forEach(checklistId => {
      const { byInstance, instanceOrder } = groups[checklistId];
      const title = checklistMetadata[checklistId]?.title || checklistId;
      const doc = new jsPDF();
      const width  = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      // ── Table of Contents ──
      doc.setFillColor(49,132,155);
      doc.rect(0, 0, width, 12, 'F');
      doc.setTextColor('#FFF');
      doc.setFontSize(14);
      doc.text('Table of Contents', width/2, 8, { align: 'center' });

      doc.setTextColor('#000');
      doc.setFontSize(11);
      let y = 20;
      instanceOrder.forEach((inst, idx) => {
        const sample = byInstance[inst][0];
        doc.text(
          `${idx+1}. ${sample.date} – ${sample.supervisor} – ${sample.unit} (Page ${idx+2})`,
          10, y
        );
        y += 7;
        if (y > height - 20) {
          doc.addPage();
          y = 20;
        }
      });

      // warn if too many pages
      const estimatedPages = 1 + instanceOrder.length;
      if (estimatedPages > 20 && 
          !confirm(`This PDF for "${title}" will be approx. ${estimatedPages} pages. Continue?`)
      ) {
        return;
      }

      // ── One page per instance ──
      instanceOrder.forEach((inst, idx) => {
        doc.addPage();
        // banner
        doc.setFillColor(49,132,155);
        doc.rect(0, 0, width, 12, 'F');
        doc.setTextColor('#FFF');
        doc.setFontSize(14);
        doc.text(title, width/2, 8, { align: 'center' });

        // metadata
        // from checklist.js, inside exportGroupedPDFs function
        doc.setTextColor('#000');
        doc.setFontSize(11);
        let py = 20;
        const meta = byInstance[inst][0];
        PDF_META_FIELDS.forEach(field => { // <-- Use the constant here
          doc.text(
            `${field.charAt(0).toUpperCase()+field.slice(1)}: ${meta[field]}`,
            10, py
          );
          py += 6;
        });
        py += 4;

        // tasks
        byInstance[inst].forEach(row => {
          const line = `${row.section} – ${row.task}: ${row.value}` +
                       (row.comment ? ` (Comment: ${row.comment})` : '');
          const wrap = doc.splitTextToSize(line, width - 20);
          doc.setFontSize(10);
          doc.text(wrap, 10, py);
          py += wrap.length * 5;
          if (py > height - 40) { doc.addPage(); py = 20; }
        });

        // signature
        if (byInstance[inst][0].signatureDataUrl) {
          const sigY = py + 10;
          if (sigY < height - 60) {
            doc.addImage(
              byInstance[inst][0].signatureDataUrl, 
              'PNG', 10, sigY, 50, 25
            );
          }
        }
      });

      // ── Save file ──
      const now = new Date();
      const ts  = now.toISOString().replace(/[:\-]/g,'').replace(/\..+$/,'');
      doc.save(`combined_report_${checklistId}_${ts}.pdf`);
    });
  }
exportReportButton.addEventListener('click', exportGroupedPDFs);
  // ────────────────────────────
  // CLEAR, SAVE & LOAD PROGRESS
  // ────────────────────────────
  function clearForm() {
  // 1) Clear top‐level fields
  checklistSelect.value        = '';
  document.getElementById('checklist-date').value = '';
  document.getElementById('supervisor').value     = '';
  document.getElementById('cleaner-team').value   = '';
  document.getElementById('unit-area').value      = '';

  // 2) Iterate each checklist item to reset radios & comments
  document.querySelectorAll('.checklist-item').forEach(item => {
    // a) Uncheck all radios
    item.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);

    // b) Reset and disable the textarea
    const ta = item.querySelector('.comments-input');
    ta.value    = '';
    ta.disabled = true;

    // c) Show the “Add Comment” button again
    const addBtn = item.querySelector('.add-comment');
    addBtn.style.display = 'inline';

    // d) Hide the “Please Explain” notice
    const notice = item.querySelector('.comment-required');
    notice.classList.add('hidden');
  });

  // 3) Optionally reset progress bar or report count
  updateProgressBar();
  document.getElementById('report-count').textContent = '0';

  // 4) Provide user feedback
  showToast('Form cleared.');
}


  function saveProgress() {
    const data = {
      checklistId: checklistSelect.value,
      date:        document.getElementById('checklist-date').value || '',
      supervisor:  document.getElementById('supervisor').value || '',
      cleanerTeam: document.getElementById('cleaner-team').value || '',
      unit:        document.getElementById('unit-area').value || '',
      checklist:   []
    };

    document.querySelectorAll('.checklist-item').forEach(item => {
      const radio = item.querySelector('input[type="radio"]:checked');
      const comment = item.querySelector('.comments-input').value.trim();
      data.checklist.push({
        task:    item.querySelector('.task-description').textContent,
        value:   radio ? radio.value : '',
        comment
      });
    });

    localStorage.setItem('checklistProgress', JSON.stringify(data));

    // Replace blocking alerts with non-blocking toasts
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
    document.getElementById('checklist-date').value  = data.date || '';
    document.getElementById('supervisor').value     = data.supervisor || '';
    document.getElementById('cleaner-team').value   = data.cleanerTeam || '';
    document.getElementById('unit-area').value      = data.unit || '';
    document.querySelectorAll('.checklist-item').forEach(item => {
      const task = item.querySelector('.task-description').textContent;
      const entry = data.checklist.find(e => e.task === task);
      if (entry) {
        item.querySelectorAll('input[type="radio"]').forEach(r => {
          if (r.value === entry.value) r.checked = true;
        });
        updateCommentFields(item.querySelector('input[type=radio]').name, entry.value);
        const ta = item.querySelector('.comments-input');
        ta.value = entry.comment; if (entry.value==='N') ta.disabled = false;
      }
    });
    updateProgressBar();
    alert('Progress loaded successfully!');
  }

  // ────────────────
  // SERVICE WORKER
  // ────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('service-worker.js', { scope: './' })
      .then(reg => {
        console.log('Service Worker registered successfully.');
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state==='installed' && navigator.serviceWorker.controller) {
              if (confirm('New version available—click OK to update.')) {
                newWorker.postMessage({ action:'skipWaiting' });
              }
            }
          });
        });
      })
      .catch(err => console.error('SW registration failed:', err));

    // “Check for updates” button
    checkUpdateButton.addEventListener('click', () =>
      navigator.serviceWorker.getRegistration().then(reg => reg && reg.update())
    );

    // When the new SW takes over, persist & reload
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      saveProgress();
      window.location.reload();
    });
  }


  // ────────────────────────────
  // METADATA & INITIAL LOAD
  // ────────────────────────────



  async function loadChecklistMetadata() {
    try {
      const res = await fetch(`checklists.json`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      checklistMetadata = data.reduce((o,i)=> (o[i.id]={title:i.title},o),{});
      checklistSelect.innerHTML = data.map(i=>`<option value="${i.id}">${i.title}</option>`).join('');
      const last = localStorage.getItem('lastChecklistId');
      checklistSelect.value = last && checklistMetadata[last] ? last : data[0].id;
      loadChecklist(checklistSelect.value);
      updateProgressBar();
    } catch (e) {
      console.error('Metadata load failed:', e);
      alert('Could not load available checklists.');
    }
  }
  loadChecklistMetadata();

  // ────────────────────────────
  // UI EVENT BINDINGS
  // ────────────────────────────
  checklistSelect.addEventListener('change', () => {
    localStorage.setItem('lastChecklistId', checklistSelect.value);
    loadChecklist(checklistSelect.value);
  });
  checkAllYesButton.addEventListener('click', () => {
    document.querySelectorAll('input[value="Y"]').forEach(r => {
      r.checked = true; updateCommentFields(r.name,'Y');
    });
    updateProgressBar();
  });
  clearFormButton.addEventListener('click', clearForm);
  saveProgressButton.addEventListener('click', saveProgress);
  loadProgressButton.addEventListener('click', loadProgress);
  exportPdfButton.addEventListener('click', () => {
    pendingAction = 'exportPdf';
    openSignatureModal();
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
    isDirty = true;   // ← user made a change
    if (e.target.type==='radio') {
      updateCommentFields(e.target.name, e.target.value);
      updateProgressBar();
    }
  });
  window.addEventListener('resize', resizeCanvas);
});

// ─────────────────────────────────────────────────────────────────
// Keep splash up for exactly 3 seconds, then remove it and show the app
window.addEventListener('load', () => {
  setTimeout(() => {
    // 1) Remove the splash overlay
    const splash = document.getElementById('splash-screen');
    if (splash) splash.remove();

    // 2) Reveal the main app container
    const app = document.getElementById('app');
    if (app) app.style.visibility = 'visible';
  }, 3000); // 3000 ms = 3 seconds
});
