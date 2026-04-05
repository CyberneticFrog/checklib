(function () {
  const DB_NAME = 'checklib_builder_db';
  const DB_VERSION = 2;
  const STORE_NAME = 'custom_checklists';

  const newChecklistBtn = document.getElementById('builder-new-checklist');
  const openImportBtn = document.getElementById('builder-open-import');
  const emptyCreateBtn = document.getElementById('builder-empty-create');
  const emptyImportBtn = document.getElementById('builder-empty-import');
  const addSectionBtn = document.getElementById('builder-add-section');

  const checklistTitleInput = document.getElementById('checklistTitle');
  const checklistDescriptionInput = document.getElementById('checklistDescription');
  const sectionsContainer = document.getElementById('builder-sections');
  const sectionTemplate = document.getElementById('builder-section-template');
  const editorForm = document.getElementById('builder-editor-form');
  const validationSummary = document.getElementById('builder-validation-summary');
  const saveStatus = document.getElementById('builder-save-status');
  const libraryList = document.getElementById('builder-library-list');
  const libraryEmpty = document.getElementById('builder-library-empty');

  const importModal = document.getElementById('importModal');
  const deleteModal = document.getElementById('deleteModal');
  const deleteMessage = document.getElementById('builder-delete-message');

  const importCancelBtn = document.getElementById('builder-import-cancel');
  const importConfirmBtn = document.getElementById('builder-import-confirm');
  const importFileInput = document.getElementById('builder-import-file');
  const deleteCancelBtn = document.getElementById('builder-delete-cancel');
  const deleteConfirmBtn = document.getElementById('builder-delete-confirm');
  const builderThemeToggle = document.getElementById('builder-theme-toggle');
  const builderStatTitle = document.getElementById('builder-stat-title');
  const builderStatSections = document.getElementById('builder-stat-sections');
  const builderStatTasks = document.getElementById('builder-stat-tasks');
  const builderDirtyState = document.getElementById('builder-dirty-state');

  let db = null;
  let sectionCounter = 1;
  let taskCounter = 2;
  let activeChecklistId = null;
  let pendingDeleteChecklistId = null;

  function openDialog(dialog) {
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
    }
  }

  function closeDialog(dialog) {
    if (dialog && typeof dialog.close === 'function') {
      dialog.close();
    }
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-theme', isDark);

    if (builderThemeToggle) {
      builderThemeToggle.textContent = isDark ? 'Light' : 'Dark';
    }
  }

  function updateBuilderStats() {
    const sectionCards = sectionsContainer?.querySelectorAll('.builder-section-card') || [];
    const sectionCount = sectionCards.length;
    let taskCount = 0;

    sectionCards.forEach((sectionCard) => {
      taskCount += sectionCard.querySelectorAll('.builder-task-row').length;
    });

    if (builderStatTitle) {
      const title = checklistTitleInput?.value.trim() || 'New checklist';
      builderStatTitle.textContent = title;
    }

    if (builderStatSections) {
      builderStatSections.textContent = String(sectionCount);
    }

    if (builderStatTasks) {
      builderStatTasks.textContent = String(taskCount);
    }
  }

  function setDirtyState(isDirty) {
    if (!builderDirtyState) return;
    builderDirtyState.textContent = isDirty ? 'Unsaved' : 'Saved';
    builderDirtyState.classList.toggle('is-dirty', isDirty);
  }

  function showSaveStatus(message, variant = 'success') {
    if (!saveStatus) {
      return;
    }

    saveStatus.textContent = message;
    saveStatus.classList.remove('builder-hidden');
    saveStatus.classList.remove('is-error', 'is-info');

    if (variant === 'error') {
      saveStatus.classList.add('is-error');
    }

    if (variant === 'info') {
      saveStatus.classList.add('is-info');
    }
  }

  function clearSaveStatus() {
    if (!saveStatus) {
      return;
    }

    saveStatus.textContent = '';
    saveStatus.classList.add('builder-hidden');
    saveStatus.classList.remove('is-error', 'is-info');
  }

  function clearValidationState() {
    document.querySelectorAll('.error-highlight').forEach((element) => {
      element.classList.remove('error-highlight');
    });

    if (validationSummary) {
      validationSummary.classList.add('builder-hidden');
      validationSummary.innerHTML = '';
    }
  }

  function showValidationErrors(errors) {
    if (!validationSummary) {
      return;
    }

    validationSummary.innerHTML = `
      <h3>Please fix the following</h3>
      <ul>
        ${errors.map((error) => `<li>${error}</li>`).join('')}
      </ul>
    `;

    validationSummary.classList.remove('builder-hidden');
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (db) {
        resolve(db);
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        const database = event.target.result;

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('title', 'title', { unique: false });
        }
      };

      request.onsuccess = function () {
        db = request.result;

        db.onclose = function () {
          db = null;
        };

        db.onversionchange = function () {
          if (db) {
            db.close();
            db = null;
          }
        };

        resolve(db);
      };

      request.onblocked = function () {
        reject(new Error('Database open blocked.'));
      };

      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function withStore(mode, work) {
    return openDatabase().then((database) => {
      return new Promise((resolve, reject) => {
        let transaction;

        try {
          transaction = database.transaction(STORE_NAME, mode);
        } catch (error) {
          db = null;
          reject(error);
          return;
        }

        const store = transaction.objectStore(STORE_NAME);

        transaction.onabort = function () {
          reject(transaction.error || new Error('Database transaction aborted.'));
        };

        transaction.onerror = function () {
          reject(transaction.error || new Error('Database transaction failed.'));
        };

        work(store, resolve, reject, transaction);
      });
    });
  }

  function generateChecklistId() {
    return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function createTaskRow(taskValue = '') {
    taskCounter += 1;

    const taskRow = document.createElement('div');
    taskRow.className = 'builder-task-row';
    taskRow.dataset.taskId = `task-${taskCounter}`;

    taskRow.innerHTML = `
      <div class="builder-task-row__top">
        <span class="builder-task-row__badge">Task</span>
        <div class="builder-task-row__mini-actions">
          <button type="button" data-action="task-up" aria-label="Move task up">Up</button>
          <button type="button" data-action="task-down" aria-label="Move task down">Down</button>
        </div>
      </div>
      <div class="builder-field">
        <label for="task${taskCounter}">Task</label>
        <input id="task${taskCounter}" type="text" value="${escapeHtml(taskValue)}" placeholder="Enter task wording">
      </div>
      <div class="builder-task-row__actions">
        <button type="button" data-action="duplicate-task">Duplicate</button>
        <button type="button" data-action="quick-add-task">Add Below</button>
        <button type="button" data-action="delete-task">Remove Task</button>
      </div>
    `;

    return taskRow;
  }

  function createSection(sectionName = '', firstTaskValue = '') {
    if (!sectionTemplate || !sectionsContainer) {
      return null;
    }

    sectionCounter += 1;

    const sectionFragment = sectionTemplate.content.cloneNode(true);
    const sectionCard = sectionFragment.querySelector('.builder-section-card');
    const sectionLabel = sectionFragment.querySelector('label');
    const sectionInput = sectionFragment.querySelector('input');
    const taskList = sectionFragment.querySelector('.builder-task-list');

    sectionCard.dataset.sectionId = `section-${sectionCounter}`;
    sectionCard.classList.remove('is-collapsed');
    sectionLabel.setAttribute('for', `sectionName${sectionCounter}`);
    sectionInput.id = `sectionName${sectionCounter}`;
    sectionInput.value = sectionName || `New Section ${sectionCounter}`;

    if (firstTaskValue !== null) {
      const firstTask = createTaskRow(firstTaskValue);
      taskList.appendChild(firstTask);
    }

    sectionsContainer.appendChild(sectionFragment);

    return sectionsContainer.querySelector(`[data-section-id="section-${sectionCounter}"]`);
  }

  function resetBuilderForm() {
    activeChecklistId = null;
    pendingDeleteChecklistId = null;
    clearValidationState();
    clearSaveStatus();

    if (checklistTitleInput) {
      checklistTitleInput.value = '';
    }

    if (checklistDescriptionInput) {
      checklistDescriptionInput.value = '';
    }

    if (sectionsContainer) {
      sectionsContainer.innerHTML = '';
    }

    createSection('', '');
    updateSelectedLibraryCard();
    updateBuilderStats();
    setDirtyState(false);
    checklistTitleInput?.focus();
  }

  function insertTaskAfter(referenceTaskRow, taskValue = '') {
    if (!referenceTaskRow) {
      return null;
    }

    const taskList = referenceTaskRow.closest('.builder-task-list');
    if (!taskList) {
      return null;
    }

    const newTask = createTaskRow(taskValue);
    if (referenceTaskRow.nextSibling) {
      taskList.insertBefore(newTask, referenceTaskRow.nextSibling);
    } else {
      taskList.appendChild(newTask);
    }

    return newTask;
  }

  function moveTask(taskRow, direction) {
    if (!taskRow) {
      return false;
    }

    if (direction === 'up' && taskRow.previousElementSibling) {
      taskRow.parentElement.insertBefore(taskRow, taskRow.previousElementSibling);
      return true;
    }

    if (direction === 'down' && taskRow.nextElementSibling) {
      taskRow.parentElement.insertBefore(taskRow.nextElementSibling, taskRow);
      return true;
    }

    return false;
  }

  function setSectionCollapsed(sectionCard, collapsed) {
    if (!sectionCard) {
      return;
    }

    sectionCard.classList.toggle('is-collapsed', collapsed);

    const toggleButton = sectionCard.querySelector('[data-action="toggle-section"]');
    if (toggleButton) {
      toggleButton.textContent = collapsed ? 'Expand' : 'Collapse';
    }
  }

  function buildChecklistData() {
    const checklist = {
      id: activeChecklistId,
      title: checklistTitleInput?.value.trim() || '',
      description: checklistDescriptionInput?.value.trim() || '',
      sections: []
    };

    const sectionCards = sectionsContainer?.querySelectorAll('.builder-section-card') || [];

    sectionCards.forEach((sectionCard, sectionIndex) => {
      const sectionInput = sectionCard.querySelector('.builder-section-card__header input');
      const taskInputs = sectionCard.querySelectorAll('.builder-task-list .builder-task-row input');

      const section = {
        id: sectionCard.dataset.sectionId || `section-${sectionIndex + 1}`,
        section: sectionInput?.value.trim() || '',
        tasks: []
      };

      taskInputs.forEach((taskInput, taskIndex) => {
        section.tasks.push({
          id: taskInput.closest('.builder-task-row')?.dataset.taskId || `task-${sectionIndex + 1}-${taskIndex + 1}`,
          task: taskInput.value.trim()
        });
      });

      checklist.sections.push(section);
    });

    return checklist;
  }

  function validateChecklist(checklist) {
    const errors = [];

    if (!checklist.title) {
      errors.push('Checklist title is required.');
      checklistTitleInput?.classList.add('error-highlight');
    }

    if (!checklist.sections.length) {
      errors.push('At least one section is required.');
    }

    checklist.sections.forEach((section, sectionIndex) => {
      const sectionCard = sectionsContainer?.querySelectorAll('.builder-section-card')[sectionIndex];
      const sectionInput = sectionCard?.querySelector('.builder-section-card__header input');

      if (!section.section) {
        errors.push(`Section ${sectionIndex + 1} needs a section name.`);
        sectionInput?.classList.add('error-highlight');
      }

      if (!section.tasks.length) {
        errors.push(`Section ${sectionIndex + 1} must contain at least one task.`);
      }

      section.tasks.forEach((task, taskIndex) => {
        const taskInput = sectionCard?.querySelectorAll('.builder-task-list .builder-task-row input')[taskIndex];

        if (!task.task) {
          errors.push(`Section ${sectionIndex + 1}, task ${taskIndex + 1} cannot be blank.`);
          taskInput?.classList.add('error-highlight');
        }
      });
    });

    return errors;
  }

  function saveChecklistToDb(checklist) {
    return withStore('readwrite', (store, resolve, reject) => {
      const now = new Date().toISOString();
      const existingCreatedAt = checklist.createdAt || null;

      const record = {
        id: checklist.id || generateChecklistId(),
        title: checklist.title,
        description: checklist.description,
        sections: checklist.sections,
        sectionCount: checklist.sections.length,
        taskCount: checklist.sections.reduce((total, section) => total + section.tasks.length, 0),
        updatedAt: now,
        createdAt: existingCreatedAt || now
      };

      const request = store.put(record);

      request.onsuccess = function () {
        resolve(record);
      };

      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function deleteChecklistFromDb(id) {
    return withStore('readwrite', (store, resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = function () {
        resolve();
      };

      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function getAllChecklistsFromDb() {
    return withStore('readonly', (store, resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = function () {
        const records = (request.result || []).sort((a, b) => {
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        resolve(records);
      };

      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function getChecklistById(id) {
    return withStore('readonly', (store, resolve, reject) => {
      const request = store.get(id);

      request.onsuccess = function () {
        resolve(request.result || null);
      };

      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function updateSelectedLibraryCard() {
    if (!libraryList) {
      return;
    }

    libraryList.querySelectorAll('.builder-card').forEach((card) => {
      card.classList.toggle('is-selected', card.dataset.checklistId === activeChecklistId);
    });
  }

  function renderLibrary(records) {
    if (!libraryList || !libraryEmpty) {
      return;
    }

    libraryList.innerHTML = '';

    if (!records.length) {
      libraryList.classList.add('builder-hidden');
      libraryEmpty.hidden = false;
      return;
    }

    libraryList.classList.remove('builder-hidden');
    libraryEmpty.hidden = true;

    records.forEach((record) => {
      const article = document.createElement('article');
      article.className = 'builder-card';
      article.dataset.checklistId = record.id;

      article.innerHTML = `
        <div class="builder-card__top">
          <div>
            <h3 class="builder-card__title">${escapeHtml(record.title)}</h3>
            <div class="builder-card__meta">
              <span>${record.sectionCount} sections</span>
              <span>${record.taskCount} tasks</span>
              <span>Updated ${new Date(record.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div class="builder-card__actions">
          <button type="button" data-action="edit">Edit</button>
          <button type="button" data-action="duplicate">Duplicate</button>
          <button type="button" data-action="export">Export CSV</button>
          <button type="button" data-action="delete">Delete</button>
        </div>
      `;

      libraryList.appendChild(article);
    });

    updateSelectedLibraryCard();
  }

  function loadChecklistIntoEditor(record) {
    if (!record || !sectionsContainer) {
      return;
    }

    activeChecklistId = record.id;
    pendingDeleteChecklistId = null;
    clearValidationState();
    clearSaveStatus();

    checklistTitleInput.value = record.title || '';
    checklistDescriptionInput.value = record.description || '';
    sectionsContainer.innerHTML = '';

    (record.sections || []).forEach((section) => {
      const sectionCard = createSection(section.section || '', null);
      const taskList = sectionCard?.querySelector('.builder-task-list');

      if (taskList) {
        taskList.innerHTML = '';

        (section.tasks || []).forEach((task) => {
          taskList.appendChild(createTaskRow(task.task || ''));
        });
      }
    });

    if (!sectionsContainer.children.length) {
      createSection('', '');
    }

    updateSelectedLibraryCard();
    updateBuilderStats();
    setDirtyState(false);
  }

  function checklistToCsv(record) {
    const rows = ['section,task'];

    (record.sections || []).forEach((section) => {
      (section.tasks || []).forEach((task) => {
        const sectionValue = `"${String(section.section || '').replace(/"/g, '""')}"`;
        const taskValue = `"${String(task.task || '').replace(/"/g, '""')}"`;
        rows.push(`${sectionValue},${taskValue}`);
      });
    });

    return rows.join('\n');
  }

  function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values.map((value) => value.trim());
  }

  function buildChecklistFromCsvText(text, fileName = 'Imported Checklist') {
    const lines = String(text || '')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      throw new Error('CSV file is empty.');
    }

    const header = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
    const sectionIndex = header.indexOf('section');
    const taskIndex = header.indexOf('task');

    if (sectionIndex === -1 || taskIndex === -1) {
      throw new Error('CSV must contain section and task columns.');
    }

    const sections = [];
    const sectionMap = new Map();

    lines.slice(1).forEach((line) => {
      const values = parseCsvLine(line);
      const sectionName = values[sectionIndex] || '';
      const taskName = values[taskIndex] || '';

      if (!sectionName || !taskName) {
        return;
      }

      if (!sectionMap.has(sectionName)) {
        const sectionRecord = {
          id: `section-${Date.now()}-${sectionMap.size + 1}`,
          section: sectionName,
          tasks: []
        };
        sectionMap.set(sectionName, sectionRecord);
        sections.push(sectionRecord);
      }

      sectionMap.get(sectionName).tasks.push({
        id: `task-${Date.now()}-${sections.length}-${sectionMap.get(sectionName).tasks.length + 1}`,
        task: taskName
      });
    });

    if (!sections.length) {
      throw new Error('No valid checklist rows found in CSV.');
    }

    return {
      id: null,
      title: fileName.replace(/\.csv$/i, '') || 'Imported Checklist',
      description: 'Imported from CSV',
      sections
    };
  }

  function downloadCsv(record) {
    const csv = checklistToCsv(record);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const safeTitle = (record.title || 'checklist')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeTitle || 'checklist'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function refreshLibrary() {
    const records = await getAllChecklistsFromDb();
    renderLibrary(records);
  }

  async function loadChecklistById(id, focusTitle = false) {
    if (!id) {
      return;
    }

    try {
      const record = await getChecklistById(id);

      if (!record) {
        showSaveStatus('Checklist could not be found.', 'error');
        return;
      }

      loadChecklistIntoEditor(record);
      showSaveStatus(`Loaded "${record.title}" from local storage.`, 'info');

      if (focusTitle) {
        checklistTitleInput?.focus();
      }
    } catch (error) {
      console.error(error);
      showSaveStatus('Checklist failed to load.', 'error');
    }
  }

  async function duplicateChecklistById(id) {
    const record = await getChecklistById(id);

    if (!record) {
      showSaveStatus('Checklist could not be found.', 'error');
      return;
    }

    const duplicate = {
      ...record,
      id: null,
      title: `${record.title} Copy`,
      createdAt: null
    };

    const savedRecord = await saveChecklistToDb(duplicate);
    activeChecklistId = savedRecord.id;
    await refreshLibrary();
    await loadChecklistById(savedRecord.id, true);
    showSaveStatus(`Checklist duplicated: ${savedRecord.title}`);
  }

  function promptDeleteChecklist(id, title) {
    pendingDeleteChecklistId = id;

    if (deleteMessage) {
      deleteMessage.textContent = `Delete "${title}" from this device?`;
    }

    openDialog(deleteModal);
  }

  if (openImportBtn) {
    openImportBtn.addEventListener('click', () => openDialog(importModal));
  }

  if (emptyImportBtn) {
    emptyImportBtn.addEventListener('click', () => openDialog(importModal));
  }

  if (importCancelBtn) {
    importCancelBtn.addEventListener('click', () => closeDialog(importModal));
  }

  if (importConfirmBtn) {
    importConfirmBtn.addEventListener('click', async () => {
      clearValidationState();
      clearSaveStatus();

      try {
        const file = importFileInput?.files?.[0];

        if (!file) {
          showSaveStatus('Choose a CSV file first.', 'error');
          return;
        }

        const text = await file.text();
        const importedChecklist = buildChecklistFromCsvText(text, file.name);

        loadChecklistIntoEditor(importedChecklist);
        activeChecklistId = null;
        closeDialog(importModal);

        if (importFileInput) {
          importFileInput.value = '';
        }

        showSaveStatus(`CSV imported into editor: ${importedChecklist.title}`, 'info');
      } catch (error) {
        console.error(error);
        showSaveStatus(error.message || 'CSV import failed.', 'error');
      }
    });
  }

  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener('click', () => {
      pendingDeleteChecklistId = null;
      closeDialog(deleteModal);
    });
  }

  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener('click', async () => {
      if (!pendingDeleteChecklistId) {
        closeDialog(deleteModal);
        return;
      }

      try {
        const deletedId = pendingDeleteChecklistId;
        await deleteChecklistFromDb(deletedId);

        if (activeChecklistId === deletedId) {
          resetBuilderForm();
        }

        pendingDeleteChecklistId = null;
        closeDialog(deleteModal);
        await refreshLibrary();
        showSaveStatus('Checklist deleted from this device.');
      } catch (error) {
        console.error(error);
        showSaveStatus('Delete failed. Please try again.', 'error');
      }
    });
  }

  if (importModal) {
    importModal.addEventListener('click', (event) => {
      if (event.target === importModal) {
        closeDialog(importModal);
      }
    });
  }

  if (deleteModal) {
    deleteModal.addEventListener('click', (event) => {
      if (event.target === deleteModal) {
        pendingDeleteChecklistId = null;
        closeDialog(deleteModal);
      }
    });
  }

  if (newChecklistBtn) {
    newChecklistBtn.addEventListener('click', resetBuilderForm);
  }

  if (emptyCreateBtn) {
    emptyCreateBtn.addEventListener('click', resetBuilderForm);
  }

  if (addSectionBtn) {
    addSectionBtn.addEventListener('click', () => {
      clearValidationState();
      clearSaveStatus();

      const newSection = createSection('', '');
      updateBuilderStats();
      setDirtyState(true);
      const newSectionInput = newSection?.querySelector('input');
      newSectionInput?.focus();
    });
  }

  if (editorForm) {
    editorForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      clearValidationState();
      clearSaveStatus();

      const checklist = buildChecklistData();
      const errors = validateChecklist(checklist);

      if (errors.length) {
        showValidationErrors(errors);
        return;
      }

      try {
        const existingRecord = checklist.id ? await getChecklistById(checklist.id) : null;
        if (existingRecord?.createdAt) {
          checklist.createdAt = existingRecord.createdAt;
        }

        const savedRecord = await saveChecklistToDb(checklist);
        activeChecklistId = savedRecord.id;
        await refreshLibrary();
        updateBuilderStats();
        setDirtyState(false);
        showSaveStatus(`Checklist saved locally on this device: ${savedRecord.title}`);
      } catch (error) {
        console.error(error);
        showSaveStatus('Save failed. Please try again.', 'error');
      }
    });
  }

  document.addEventListener('input', () => {
    clearValidationState();
    clearSaveStatus();
    updateBuilderStats();
    setDirtyState(true);
  });

  document.addEventListener('click', async (event) => {
    const libraryCard = event.target.closest('.builder-card[data-checklist-id]');
    const editButton = event.target.closest('[data-action="edit"]');
    const duplicateButton = event.target.closest('[data-action="duplicate"]');
    const exportButton = event.target.closest('[data-action="export"]');
    const deleteButton = event.target.closest('[data-action="delete"]');
    const addTaskButton = event.target.closest('[data-action="add-task"]');
    const toggleSectionButton = event.target.closest('[data-action="toggle-section"]');
    const moveSectionButton = event.target.closest('[data-action="move-section"]');
    const taskUpButton = event.target.closest('[data-action="task-up"]');
    const taskDownButton = event.target.closest('[data-action="task-down"]');
    const duplicateTaskButton = event.target.closest('[data-action="duplicate-task"]');
    const quickAddTaskButton = event.target.closest('[data-action="quick-add-task"]');
    const deleteTaskButton = event.target.closest('[data-action="delete-task"]');
    const deleteSectionButton = event.target.closest('[data-action="delete-section"]');

    if (libraryCard && !event.target.closest('.builder-card__actions')) {
      await loadChecklistById(libraryCard.dataset.checklistId, false);
    }

    if (editButton) {
      const libraryCardForEdit = editButton.closest('.builder-card[data-checklist-id]');
      const checklistId = libraryCardForEdit?.dataset.checklistId || '';
      await loadChecklistById(checklistId, true);
    }

    if (duplicateButton) {
      const libraryCardForDuplicate = duplicateButton.closest('.builder-card[data-checklist-id]');
      const checklistId = libraryCardForDuplicate?.dataset.checklistId || '';

      try {
        await duplicateChecklistById(checklistId);
      } catch (error) {
        console.error(error);
        showSaveStatus('Duplicate failed. Please try again.', 'error');
      }
    }

    if (exportButton) {
      const libraryCardForExport = exportButton.closest('.builder-card[data-checklist-id]');
      const checklistId = libraryCardForExport?.dataset.checklistId || '';

      try {
        const record = await getChecklistById(checklistId);

        if (!record) {
          showSaveStatus('Checklist could not be found.', 'error');
          return;
        }

        downloadCsv(record);
        showSaveStatus(`CSV exported: ${record.title}`, 'info');
      } catch (error) {
        console.error(error);
        showSaveStatus('CSV export failed. Please try again.', 'error');
      }
    }

    if (deleteButton) {
      const libraryCardForDelete = deleteButton.closest('.builder-card[data-checklist-id]');
      const checklistId = libraryCardForDelete?.dataset.checklistId || '';

      try {
        const record = await getChecklistById(checklistId);

        if (!record) {
          showSaveStatus('Checklist could not be found.', 'error');
          return;
        }

        promptDeleteChecklist(checklistId, record.title || 'this checklist');
      } catch (error) {
        console.error(error);
        showSaveStatus('Delete setup failed. Please try again.', 'error');
      }
    }

    if (addTaskButton) {
      clearValidationState();
      clearSaveStatus();

      const sectionCard = addTaskButton.closest('.builder-section-card');
      const taskList = sectionCard?.querySelector('.builder-task-list');

      if (sectionCard?.classList.contains('is-collapsed')) {
        setSectionCollapsed(sectionCard, false);
      }

      if (taskList) {
        const newTask = createTaskRow('');
        taskList.appendChild(newTask);
        updateBuilderStats();
        setDirtyState(true);
        newTask.querySelector('input')?.focus();
      }
    }

    if (toggleSectionButton) {
      clearValidationState();
      clearSaveStatus();

      const sectionCard = toggleSectionButton.closest('.builder-section-card');
      if (sectionCard) {
        const nextState = !sectionCard.classList.contains('is-collapsed');
        setSectionCollapsed(sectionCard, nextState);
      }
    }

    if (moveSectionButton) {
      clearValidationState();
      clearSaveStatus();

      const sectionCard = moveSectionButton.closest('.builder-section-card');
      const nextSection = sectionCard?.nextElementSibling;

      if (sectionCard && sectionsContainer) {
        if (nextSection) {
          sectionsContainer.insertBefore(nextSection, sectionCard);
          showSaveStatus('Section moved down.', 'info');
        } else {
          sectionsContainer.prepend(sectionCard);
          showSaveStatus('Section moved to top.', 'info');
        }
        updateBuilderStats();
        setDirtyState(true);
      }
    }

    if (taskUpButton) {
      clearValidationState();
      clearSaveStatus();

      const taskRow = taskUpButton.closest('.builder-task-row');
      if (moveTask(taskRow, 'up')) {
        updateBuilderStats();
        setDirtyState(true);
        taskRow.querySelector('input')?.focus();
      }
    }

    if (taskDownButton) {
      clearValidationState();
      clearSaveStatus();

      const taskRow = taskDownButton.closest('.builder-task-row');
      if (moveTask(taskRow, 'down')) {
        updateBuilderStats();
        setDirtyState(true);
        taskRow.querySelector('input')?.focus();
      }
    }

    if (duplicateTaskButton) {
      clearValidationState();
      clearSaveStatus();

      const taskRow = duplicateTaskButton.closest('.builder-task-row');
      const sourceInput = taskRow?.querySelector('input');
      const copiedValue = sourceInput?.value || '';

      if (taskRow) {
        const newTask = insertTaskAfter(taskRow, copiedValue);
        updateBuilderStats();
        setDirtyState(true);
        newTask?.querySelector('input')?.focus();
      }
    }

    if (quickAddTaskButton) {
      clearValidationState();
      clearSaveStatus();

      const taskRow = quickAddTaskButton.closest('.builder-task-row');

      if (taskRow) {
        const newTask = insertTaskAfter(taskRow, '');
        updateBuilderStats();
        setDirtyState(true);
        newTask?.querySelector('input')?.focus();
      }
    }

    if (deleteTaskButton) {
      clearValidationState();
      clearSaveStatus();

      const taskRow = deleteTaskButton.closest('.builder-task-row');
      const taskList = deleteTaskButton.closest('.builder-task-list');

      if (taskRow && taskList) {
        taskRow.remove();

        if (!taskList.children.length) {
          taskList.innerHTML = '';
        }

        updateBuilderStats();
        setDirtyState(true);
      }
    }

    if (deleteSectionButton) {
      clearValidationState();
      clearSaveStatus();

      const sectionCard = deleteSectionButton.closest('.builder-section-card');

      if (sectionCard) {
        sectionCard.remove();

        if (sectionsContainer && !sectionsContainer.children.length) {
          createSection('', '');
        }

        updateBuilderStats();
        setDirtyState(true);
      }
    }
  });

  const preferredTheme = localStorage.getItem('theme');
  if (preferredTheme === 'dark' || (!preferredTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }

  if (builderThemeToggle) {
    builderThemeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      builderThemeToggle.textContent = isDark ? 'Light' : 'Dark';
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }

  openDatabase()
    .then(() => {
      updateBuilderStats();
      setDirtyState(false);
      return refreshLibrary();
    })
    .catch((error) => {
      console.error(error);
      showSaveStatus('Local storage failed to open.', 'error');
    });
})();