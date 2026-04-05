(function () {
  const STORAGE_KEY = 'checklib_help_enabled';

  const HELP_CONTENT = {
    runner: {
      title: 'Runner Help',
      quick: {
        setup: {
          title: 'Setup stage',
          text: 'Choose the checklist, enter the people involved, set the unit or area, then start the run.'
        },
        section: {
          title: 'Sections stage',
          text: 'Work through each section. Use the drawer to jump. Use Show unanswered to clean up gaps before review.'
        },
        issues: {
          title: 'Issues stage',
          text: 'Complete the issue details here. Missing issue comments will block final sign-off.'
        },
        final: {
          title: 'Final stage',
          text: 'Review the full run, save a draft if needed, capture the signature when validation is clear, then add the signed report to the queue for PDF export.'
        }
      },
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          kicker: 'Runner basics',
          html: `
            <div class="checklib-help-modal-card">
              <h3>What this area does</h3>
              <p>The Runner is where inspections are completed, reviewed, signed, queued, exported, and archived.</p>
            </div>
            <div class="checklib-help-modal-card">
              <h4>Stage flow</h4>
              <ol class="checklib-help-modal-list">
                <li>Setup</li>
                <li>Sections</li>
                <li>Issues</li>
                <li>Final</li>
              </ol>
            </div>
          `
        },
        {
          id: 'completing',
          label: 'Complete checks',
          kicker: 'Working through a run',
          html: `
            <div class="checklib-help-modal-card">
              <h3>Complete sections</h3>
              <ul class="checklib-help-modal-list">
                <li>Answer each task in the visible section.</li>
                <li>Use the section drawer to jump quickly.</li>
                <li>Use Save to hold progress during the inspection.</li>
                <li>Autosave updates after the run starts.</li>
              </ul>
            </div>
            <div class="checklib-help-modal-card">
              <h4>Unanswered focus</h4>
              <p>Use Show unanswered when you want to clean up missed items before moving on.</p>
            </div>
          `
        },
        {
          id: 'issues',
          label: 'Issues',
          kicker: 'Failures and follow-up',
          html: `
            <div class="checklib-help-modal-card">
              <h3>What to complete for each issue</h3>
              <ul class="checklib-help-modal-list">
                <li>Issue comment</li>
                <li>Severity</li>
                <li>Action required flag</li>
                <li>Responsible person where needed</li>
                <li>Due date where needed</li>
              </ul>
            </div>
            <div class="checklib-help-modal-card">
              <h4>Validation rule</h4>
              <p>Missing issue comments are treated as incomplete and block final signature.</p>
            </div>
          `
        },
        {
          id: 'reports',
          label: 'Reports',
          kicker: 'Queue, PDF export, and archive',
          html: `
            <div class="checklib-help-modal-card">
              <h3>Report actions</h3>
              <ul class="checklib-help-modal-list">
                <li>Add the current signed run to the queue.</li>
                <li>Export the full queue or use advanced export options.</li>
                <li>Export a single queued report when needed.</li>
                <li>Move exported items to archive or keep them in queue.</li>
                <li>Search and filter both queue and archive lists.</li>
              </ul>
            </div>
            <div class="checklib-help-modal-card">
              <h4>Queue and archive rule</h4>
              <p>Add to Queue stores the report for export. Export creates the output. Archive stores finished report history and supports re-export or restore.</p>
            </div>
          `
        },
        {
          id: 'exports',
          label: 'Reporting and Exports',
          kicker: 'PDF, single report, queue, and CSV handling',
          html: `
            <div class="checklib-help-modal-card">
              <h3>PDF export flow</h3>
              <ol class="checklib-help-modal-list">
                <li>Complete and sign the checklist.</li>
                <li>Add the signed report to the queue.</li>
                <li>Choose Export Queue or export a single report.</li>
                <li>Select the export content mode.</li>
                <li>Choose whether to keep in queue or move to archive after export.</li>
              </ol>
            </div>
            <div class="checklib-help-modal-card">
              <h4>Content modes</h4>
              <ul class="checklib-help-modal-list">
                <li>Full report</li>
                <li>Summary and issues only</li>
                <li>Issues only</li>
              </ul>
            </div>
            <div class="checklib-help-modal-card">
              <h4>Single report export</h4>
              <p>Use the export action on an individual queue card or archive card when you only want one report output instead of the whole queue.</p>
            </div>
            <div class="checklib-help-modal-card">
              <h4>CSV handling</h4>
              <p>Queue CSV and Archive CSV export summary tracking data. They are useful for reporting lists and analysis, but they do not replace the PDF report output.</p>
            </div>
            <div class="checklib-help-modal-card">
              <h4>Archive actions</h4>
              <p>Archived reports can be viewed, re-exported, restored to queue, searched, filtered, and deleted.</p>
            </div>
          `
        }
      ]
    },
    builder: {
      title: 'Builder Help',
      quick: {
        editor: {
          title: 'Builder workspace',
          text: 'Create or load a custom checklist, edit sections and tasks, then save it locally to make it available in the Runner.'
        }
      },
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          kicker: 'Builder basics',
          html: `
            <div class="checklib-help-modal-card">
              <h3>What this area does</h3>
              <p>The Builder manages custom checklists stored in IndexedDB on the current device.</p>
            </div>
            <div class="checklib-help-modal-card">
              <h4>Main library actions</h4>
              <ul class="checklib-help-modal-list">
                <li>Create new checklist</li>
                <li>Load an existing custom checklist</li>
                <li>Duplicate</li>
                <li>Delete</li>
                <li>Import CSV into the editor</li>
              </ul>
            </div>
          `
        },
        {
          id: 'editing',
          label: 'Editing',
          kicker: 'Structure and save',
          html: `
            <div class="checklib-help-modal-card">
              <h3>Checklist structure</h3>
              <ul class="checklib-help-modal-list">
                <li>Set the checklist title.</li>
                <li>Set the description.</li>
                <li>Add one or more sections.</li>
                <li>Add tasks inside each section.</li>
              </ul>
            </div>
            <div class="checklib-help-modal-card">
              <h4>Save result</h4>
              <p>Saving writes the record to IndexedDB and makes it available to the Runner after reload.</p>
            </div>
          `
        },
        {
          id: 'csv',
          label: 'CSV import',
          kicker: 'Bring in an existing list',
          html: `
            <div class="checklib-help-modal-card">
              <h3>Import CSV</h3>
              <p>Import loads the CSV content into the editor. Review titles, section names, and tasks before saving the final custom checklist.</p>
            </div>
            <div class="checklib-help-modal-card">
              <h4>Tip</h4>
              <p>Use import to speed up first draft creation, then refine the structure in the editor.</p>
            </div>
          `
        },
        {
          id: 'storage',
          label: 'Storage',
          kicker: 'Local database',
          html: `
            <div class="checklib-help-modal-card">
              <h3>Where data is held</h3>
              <p>Database: <code>checklib_builder_db</code><br>Store: <code>custom_checklists</code></p>
            </div>
            <div class="checklib-help-modal-card">
              <h4>Trouble signs</h4>
              <p>If the connection closes during a save, refresh the page and retry. This usually points to IndexedDB state instability rather than a checklist content issue.</p>
            </div>
          `
        }
      ]
    }
  };

  function isHelpEnabled() {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  }

  function setHelpEnabled(enabled) {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    updateTriggerVisibility();
    document.dispatchEvent(new CustomEvent('checklib-help-setting-changed', {
      detail: { enabled }
    }));
  }

  function updateTriggerVisibility() {
    const enabled = isHelpEnabled();
    document.querySelectorAll('.checklib-help-trigger').forEach((button) => {
      button.hidden = !enabled;
    });
    document.querySelectorAll('.checklib-help-embed').forEach((panel) => {
      panel.hidden = !enabled;
    });
  }

  function applyThemeToggle(buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    const preferredTheme = localStorage.getItem('theme');
    if (preferredTheme === 'dark' || (!preferredTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.body.classList.add('dark-theme');
      button.textContent = 'Light';
    } else {
      button.textContent = 'Dark';
    }
    button.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      button.textContent = isDark ? 'Light' : 'Dark';
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }

  function detectRunnerStage() {
    const panel = document.querySelector('[data-stage-panel]:not(.hidden)');
    return panel?.dataset.stagePanel || 'setup';
  }

  function createInlinePanel(context) {
    const panel = document.createElement('section');
    panel.className = 'checklib-help-embed';
    panel.hidden = !isHelpEnabled();
    panel.innerHTML = `
      <div class="checklib-help-embed-header">
        <div>
          <p class="checklib-help-muted">In-app help</p>
          <h3 class="checklib-help-embed-title">Help</h3>
        </div>
        <button type="button" class="checklib-help-inline-toggle">Disable In-App Help</button>
      </div>
      <p class="checklib-help-embed-text"></p>
      <div class="checklib-help-embed-actions">
        <button type="button" class="checklib-help-trigger">Open Help</button>
        <button type="button" class="checklib-help-open-page">Open Full Guide</button>
      </div>
    `;

    const toggleButton = panel.querySelector('.checklib-help-inline-toggle');
    toggleButton.addEventListener('click', () => {
      const enabled = isHelpEnabled();
      setHelpEnabled(!enabled);
      toggleButton.textContent = !enabled ? 'Disable In-App Help' : 'Enable In-App Help';
    });

    panel.querySelector('.checklib-help-open-page').addEventListener('click', () => {
      const path = context === 'builder' ? '../help/index.html' : 'help/index.html';
      window.location.href = path;
    });

    const updateText = () => {
      const textNode = panel.querySelector('.checklib-help-embed-text');
      const titleNode = panel.querySelector('.checklib-help-embed-title');
      const toggleNode = panel.querySelector('.checklib-help-inline-toggle');
      const enabled = isHelpEnabled();
      toggleNode.textContent = enabled ? 'Disable In-App Help' : 'Enable In-App Help';

      if (context === 'runner') {
        const stage = detectRunnerStage();
        const quick = HELP_CONTENT.runner.quick[stage] || HELP_CONTENT.runner.quick.setup;
        titleNode.textContent = quick.title;
        textNode.textContent = quick.text;
      } else {
        const quick = HELP_CONTENT.builder.quick.editor;
        titleNode.textContent = quick.title;
        textNode.textContent = quick.text;
      }
    };

    updateText();
    document.addEventListener('checklib-help-setting-changed', updateText);

    if (context === 'runner') {
      const observer = new MutationObserver(updateText);
      document.querySelectorAll('[data-stage-panel]').forEach((node) => {
        observer.observe(node, { attributes: true, attributeFilter: ['class'] });
      });
    }

    return panel;
  }

  function buildModal(context) {
    const source = HELP_CONTENT[context];
    const modal = document.createElement('div');
    modal.className = 'checklib-help-modal';
    modal.hidden = true;

    modal.innerHTML = `
      <div class="checklib-help-modal-backdrop" data-help-close="true"></div>
      <div class="checklib-help-modal-panel" role="dialog" aria-modal="true" aria-label="${source.title}">
        <div class="checklib-help-modal-header">
          <div>
            <p class="checklib-help-modal-kicker">Embedded guide</p>
            <h2 class="checklib-help-modal-title">${source.title}</h2>
          </div>
          <button type="button" class="runner-nav-button" data-help-close="true">Close</button>
        </div>
        <div class="checklib-help-modal-grid">
          <nav class="checklib-help-modal-nav"></nav>
          <section class="checklib-help-modal-body"></section>
        </div>
      </div>
    `;

    const nav = modal.querySelector('.checklib-help-modal-nav');
    const body = modal.querySelector('.checklib-help-modal-body');

    function renderTab(tabId) {
      const tab = source.tabs.find((entry) => entry.id === tabId) || source.tabs[0];
      nav.querySelectorAll('.checklib-help-modal-tab').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.helpTab === tab.id);
      });
      body.innerHTML = `
        <div>
          <p class="checklib-help-muted">${tab.kicker}</p>
          <h3>${tab.label}</h3>
        </div>
        ${tab.html}
        <div class="checklib-help-modal-card">
          <h4>Need the full manual?</h4>
          <div class="checklib-help-modal-actions">
            <button type="button" class="checklib-help-open-page">Open full guide</button>
            <button type="button" class="checklib-help-setting-toggle">${isHelpEnabled() ? 'Disable' : 'Enable'} in-app help</button>
          </div>
        </div>
      `;

      body.querySelector('.checklib-help-open-page').addEventListener('click', () => {
        const path = context === 'builder' ? '../help/index.html' : 'help/index.html';
        window.location.href = path;
      });

      body.querySelector('.checklib-help-setting-toggle').addEventListener('click', () => {
        setHelpEnabled(!isHelpEnabled());
        renderTab(tab.id);
      });
    }

    source.tabs.forEach((tab) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'checklib-help-modal-tab';
      button.dataset.helpTab = tab.id;
      button.textContent = tab.label;
      button.addEventListener('click', () => renderTab(tab.id));
      nav.appendChild(button);
    });

    modal.addEventListener('click', (event) => {
      if (event.target.dataset.helpClose === 'true') {
        modal.hidden = true;
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) {
        modal.hidden = true;
      }
    });

    renderTab(source.tabs[0].id);
    return modal;
  }

  function initEmbeddedHelp(options) {
    const context = options.context === 'builder' ? 'builder' : 'runner';
    const modal = buildModal(context);
    document.body.appendChild(modal);

    const triggerSelector = options.triggerSelector || '.checklib-help-trigger';
    document.querySelectorAll(triggerSelector).forEach((button) => {
      button.addEventListener('click', () => {
        if (!isHelpEnabled()) return;
        modal.hidden = false;
      });
    });

    const mountTarget = document.querySelector(options.inlineMountSelector);
    if (mountTarget) {
      mountTarget.appendChild(createInlinePanel(context));
      mountTarget.querySelectorAll('.checklib-help-trigger').forEach((button) => {
        button.addEventListener('click', () => {
          if (!isHelpEnabled()) return;
          modal.hidden = false;
        });
      });
    }

    updateTriggerVisibility();
  }

  function initHelpSectionMenu(options = {}) {
    const toggle = document.getElementById(options.sectionMenuToggleId || 'help-sections-toggle');
    const menu = document.getElementById(options.sectionMenuId || 'help-sections-menu');
    if (!toggle || !menu) return;

    const labelNode = toggle.querySelector('.checklib-help-menu-toggle__label');
    const sectionLinks = Array.from(menu.querySelectorAll('a[href^="#"]'));

    const closeMenu = () => {
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    };

    const openMenu = () => {
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    };

    const getSections = () => {
      return sectionLinks
        .map((link) => {
          const id = link.getAttribute('href').slice(1);
          const section = document.getElementById(id);
          return section ? { link, section, label: link.textContent.trim() } : null;
        })
        .filter(Boolean);
    };

    const updateActiveSectionLabel = () => {
      if (!labelNode) return;

      const sections = getSections();
      let active = sections[0];

      for (const item of sections) {
        const rect = item.section.getBoundingClientRect();
        if (rect.top <= 140) {
          active = item;
        }
      }

      if (active) {
        labelNode.textContent = active.label;
      }
    };

    toggle.addEventListener('click', () => {
      if (menu.hidden) {
        openMenu();
      } else {
        closeMenu();
      }
    });

    sectionLinks.forEach((link) => {
      link.addEventListener('click', () => {
        closeMenu();
        requestAnimationFrame(() => {
          setTimeout(updateActiveSectionLabel, 120);
        });
      });
    });

    document.addEventListener('click', (event) => {
      if (!menu.hidden && !menu.contains(event.target) && !toggle.contains(event.target)) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !menu.hidden) {
        closeMenu();
      }
    });

    window.addEventListener('scroll', updateActiveSectionLabel, { passive: true });
    window.addEventListener('load', updateActiveSectionLabel);
    updateActiveSectionLabel();
  }

  window.CheckLibHelp = {
    init(options = {}) {
      initEmbeddedHelp(options);
    },
    initHelpPage(options = {}) {
      applyThemeToggle(options.themeToggleId || 'help-theme-toggle');
      initHelpSectionMenu(options);

      const embeddedToggle = document.getElementById(options.embeddedToggleId || 'help-embedded-toggle');
      if (embeddedToggle) {
        const setLabel = () => {
          embeddedToggle.textContent = isHelpEnabled() ? 'Disable In-App Help' : 'Enable In-App Help';
        };
        setLabel();
        embeddedToggle.addEventListener('click', () => {
          setHelpEnabled(!isHelpEnabled());
          setLabel();
        });
      }

      const copyButton = document.getElementById(options.copyLinkButtonId || 'help-copy-link');
      if (copyButton) {
        copyButton.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            copyButton.textContent = 'Link Copied';
            setTimeout(() => {
              copyButton.textContent = 'Copy This Page Link';
            }, 1800);
          } catch (error) {
            copyButton.textContent = 'Copy Failed';
            setTimeout(() => {
              copyButton.textContent = 'Copy This Page Link';
            }, 1800);
          }
        });
      }
    },
    isHelpEnabled,
    setHelpEnabled
  };
})();
