const API_BASE_URL = window.location.origin;

let logEventSource = null;
let accuracyWatchSource = null;
let timerInterval = null;
let startTime = 0;
let currentSessionId = null;
let accuracyHistoryLoaded = false;

document.addEventListener('DOMContentLoaded', async () => {
  const testSelect = document.getElementById('testFile');
  const sharedFolder = document.getElementById('manualSourceFolder');
  const historySection = document.getElementById('accuracy-history-section');

  await loadTestList();
  await loadEnvStatus();
  startAccuracyWatcher();

  testSelect.addEventListener('change', toggleManualConfig);
  toggleManualConfig();

  if (sharedFolder) {
    sharedFolder.addEventListener('input', () => {
      document.querySelectorAll('.source-folder-input').forEach((input) => {
        if (!input.dataset.manuallyEdited) {
          input.value = sharedFolder.value;
        }
      });
    });
  }

  if (historySection) {
    historySection.addEventListener('toggle', async () => {
      if (historySection.open) {
        await loadAccuracyHistory(true);
      }
    });
  }
});

function buildApiUrl(routePath) {
  return `${API_BASE_URL}${routePath}`;
}

async function loadTestList() {
  const testSelect = document.getElementById('testFile');

  try {
    const response = await fetch(buildApiUrl('/list-tests'));
    if (!response.ok) {
      return;
    }

    const tests = await response.json();
    if (!Array.isArray(tests) || tests.length === 0) {
      return;
    }

    testSelect.innerHTML = '';
    tests.forEach((testFile) => {
      const option = document.createElement('option');
      option.value = testFile;
      option.textContent = testFile;
      testSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Could not load test list:', error);
  }
}

async function loadEnvStatus() {
  const badge = document.getElementById('env-status-badge');
  if (!badge) {
    return;
  }

  try {
    const response = await fetch(buildApiUrl('/api/env-status'));
    const data = await response.json();

    if (!response.ok) {
      badge.textContent = 'Config status unavailable';
      badge.style.color = '#fb7185';
      badge.style.borderColor = 'rgba(251, 113, 133, 0.35)';
      return;
    }

    if (data.ok) {
      badge.textContent = `Env OK (${data.present.length}/${data.present.length})`;
      badge.style.color = '#34d399';
      badge.style.borderColor = 'rgba(52, 211, 153, 0.35)';
    } else {
      badge.textContent = `Env warning (${data.missing.length} missing)`;
      badge.title = `Missing: ${data.missing.join(', ')}`;
      badge.style.color = '#facc15';
      badge.style.borderColor = 'rgba(250, 204, 21, 0.35)';
    }
  } catch (error) {
    badge.textContent = 'Config status unavailable';
    badge.style.color = '#fb7185';
    badge.style.borderColor = 'rgba(251, 113, 133, 0.35)';
  }
}

function startAccuracyWatcher() {
  if (accuracyWatchSource) {
    return;
  }

  try {
    accuracyWatchSource = new EventSource(buildApiUrl('/api/accuracy/watch'));
    accuracyWatchSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'file-added') {
          showAccuracyWatchBanner(
            `New file detected: ${payload.filename}. Click Refresh to load it.`
          );
        }
      } catch (error) {
        console.error('Failed to parse accuracy watcher payload:', error);
      }
    };

    accuracyWatchSource.onerror = () => {
      console.warn('Accuracy file watcher disconnected.');
    };
  } catch (error) {
    console.warn('Accuracy file watcher could not start:', error);
  }
}

function showAccuracyWatchBanner(message) {
  const banner = document.getElementById('accuracy-watch-banner');
  if (!banner) {
    return;
  }

  banner.textContent = message;
  banner.style.display = 'block';
}

function toggleManualConfig() {
  const testSelect = document.getElementById('testFile');
  const manualSection = document.getElementById('manual-config');
  const isManual = testSelect.value.includes('manual_input');

  if (manualSection) {
    manualSection.style.display = isManual ? 'block' : 'none';
  }

  document.querySelectorAll('.source-folder-input').forEach((input) => {
    input.style.display = isManual ? 'block' : 'none';
  });
}

function addSourceInput() {
  const container = document.getElementById('source-files-container');
  const testSelect = document.getElementById('testFile');
  const isManual = testSelect && testSelect.value.includes('manual_input');
  const sharedFolder = document.getElementById('manualSourceFolder');

  const group = document.createElement('div');
  group.className = 'source-input-group';

  const fileInput = document.createElement('input');
  fileInput.type = 'text';
  fileInput.className = 'source-input';
  fileInput.placeholder = 'Additional_Source.docx';

  const folderInput = document.createElement('input');
  folderInput.type = 'text';
  folderInput.className = 'source-folder-input';
  folderInput.placeholder = 'Folder';
  folderInput.style.display = isManual ? 'block' : 'none';
  if (sharedFolder && sharedFolder.value) {
    folderInput.value = sharedFolder.value;
  }
  folderInput.addEventListener('input', () => {
    folderInput.dataset.manuallyEdited = 'true';
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-icon btn-remove';
  removeBtn.textContent = '-';
  removeBtn.onclick = () => group.remove();

  group.appendChild(fileInput);
  group.appendChild(folderInput);
  group.appendChild(removeBtn);
  container.appendChild(group);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

async function runTest() {
  const statusEl = document.getElementById('status');
  const runBtn = document.getElementById('runBtn');
  const terminal = document.getElementById('log-terminal');
  const statsDiv = document.getElementById('execution-stats');
  const timerEl = document.getElementById('timer');
  const runStatusEl = document.getElementById('run-status');

  statusEl.textContent = '';
  runBtn.disabled = true;
  runBtn.style.opacity = '0.5';

  terminal.style.display = 'block';
  statsDiv.style.display = 'flex';
  terminal.innerHTML = '';
  runStatusEl.innerHTML = '<span class="loader"></span> Running...';

  startTime = Date.now();
  timerEl.innerText = '00:00';
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerEl.innerText = formatTime(Date.now() - startTime);
  }, 1000);

  if (logEventSource) {
    logEventSource.close();
  }

  const testFile = document.getElementById('testFile').value;
  const isManual = testFile.includes('manual_input');
  const data = {
    testerName: document.getElementById('tester').value,
    email: document.getElementById('email').value,
    password: document.getElementById('password').value,
    template: document.getElementById('template').value,
    source: Array.from(document.querySelectorAll('.source-input'))
      .map((input) => input.value.trim())
      .filter(Boolean)
      .join(','),
    folder: document.getElementById('folder').value,
    testFile,
    baseUrl: 'https://app-v2-rc1-aw.smarter.codes',
    appUrl: 'https://app-v2-rc1-aw.smarter.codes/signin',
    envName: 'QA',
  };

  if (isManual) {
    const sharedFolder = document.getElementById('manualSourceFolder').value.trim();
    data.manualTemplateName = data.template;
    data.manualTemplateFolder = document.getElementById('manualTemplateFolder').value.trim();
    data.manualTemplateTab = document.getElementById('manualTemplateTab').value;
    data.generatedScriptName = document.getElementById('generatedScriptName').value.trim();
    data.useQaFolderForSources = false;
    data.manualSourceFiles = Array.from(document.querySelectorAll('.source-input-group'))
      .map((group) => {
        const nameInput = group.querySelector('.source-input');
        const folderInput = group.querySelector('.source-folder-input');
        return {
          name: nameInput ? nameInput.value.trim() : '',
          folder: (folderInput && folderInput.value.trim()) || sharedFolder,
        };
      })
      .filter((sourceFile) => sourceFile.name);
  }

  try {
    const startResponse = await fetch(buildApiUrl('/run-test'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!startResponse.ok) {
      statusEl.innerText = 'Failed to start test run';
      runStatusEl.innerText = 'Failed';
      clearInterval(timerInterval);
      runBtn.disabled = false;
      runBtn.style.opacity = '1';
      return;
    }

    const { sessionId } = await startResponse.json();
    currentSessionId = sessionId;

    logEventSource = new EventSource(buildApiUrl(`/stream?sessionId=${sessionId}`));
    logEventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'phase') {
          const separator = document.createElement('div');
          separator.classList.add('log-phase-separator');
          const isReportPhase = payload.message.toLowerCase().includes('report');
          separator.classList.add(isReportPhase ? 'phase-report' : 'phase-test');
          const icon = isReportPhase ? 'R' : '>';
          separator.innerHTML = `<span class="phase-icon">${icon}</span><span>${payload.message}</span>`;
          terminal.appendChild(separator);
          terminal.scrollTop = terminal.scrollHeight;
          return;
        }

        const row = document.createElement('div');
        let color = '#94a3b8';
        if (payload.type === 'error') {
          color = '#fb7185';
        } else if (payload.type === 'info') {
          color = '#38bdf8';
        } else if (payload.type === 'done') {
          color = '#34d399';
        } else if (payload.type === 'log') {
          color = '#f8fafc';
        }

        row.style.color = color;

        const text = String(payload.message || '').trim();
        if (text) {
          const elapsedMs = typeof payload.elapsed === 'number' ? payload.elapsed : 0;
          const totalSeconds = Math.floor(elapsedMs / 1000);
          const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
          const seconds = String(totalSeconds % 60).padStart(2, '0');
          const escapedText = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

          row.innerHTML = `<span class="log-ts">[${minutes}:${seconds}]</span>${escapedText}`;
          terminal.appendChild(row);
          terminal.scrollTop = terminal.scrollHeight;
        }

        if (payload.type === 'info' || payload.type === 'done') {
          runStatusEl.innerText = text;
        }

        if (payload.type === 'done') {
          clearInterval(timerInterval);
          logEventSource.close();
          runBtn.disabled = false;
          runBtn.style.opacity = '1';
          statusEl.innerText =
            text.toLowerCase().includes('successfully')
              ? 'Test cycle completed successfully'
              : 'Test execution completed with failures';
        }
      } catch (error) {
        console.error(error);
      }
    };
  } catch (error) {
    statusEl.innerText = 'Connection error: Backend server unreachable';
    runStatusEl.innerText = 'Error';
    clearInterval(timerInterval);
    runBtn.disabled = false;
    runBtn.style.opacity = '1';
  }
}

function downloadReport() {
  if (!currentSessionId) {
    alert('No completed test run found in this tab. Please run a test first.');
    return;
  }
  window.open(buildApiUrl(`/download-report?sessionId=${currentSessionId}`));
}

function toggleAccuracyPanel() {
  const panel = document.getElementById('accuracy-panel');
  const icon = document.getElementById('accuracy-toggle-icon');

  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    icon.style.transform = 'rotate(180deg)';
    refreshAccuracyDropdowns();
  } else {
    panel.style.display = 'none';
    icon.style.transform = 'rotate(0deg)';
  }
}

async function refreshAccuracyDropdowns() {
  await loadAccuracySelect(
    'accuracyRef',
    '/api/accuracy/reference-files',
    'No reference files found - add .xlsx to reference_files\\'
  );
  await loadAccuracySelect(
    'accuracyRaw',
    '/api/accuracy/raw-qa-files',
    'No QA files found - drop .xlsx into raw_qa_files\\'
  );
}

async function loadAccuracySelect(selectId, endpoint, emptyMessage) {
  const select = document.getElementById(selectId);

  try {
    const response = await fetch(buildApiUrl(endpoint));
    const data = await response.json();
    select.innerHTML = '';

    if (!Array.isArray(data.files) || data.files.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = emptyMessage;
      option.disabled = true;
      option.selected = true;
      select.appendChild(option);
      return;
    }

    data.files.forEach((fileName, index) => {
      const option = document.createElement('option');
      option.value = fileName;
      option.textContent = fileName;
      if (index === 0) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  } catch (error) {
    select.innerHTML = '<option value="" disabled selected>Server unreachable</option>';
  }
}

async function fetchAccuracyResults() {
  const response = await fetch(buildApiUrl('/api/accuracy/results'));
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load accuracy results.');
  }
  return data.items || [];
}

async function loadLatestPreviousSummary() {
  const items = await fetchAccuracyResults();
  const latestJson = items.find((item) => item.name.endsWith('.json'));

  if (!latestJson) {
    return null;
  }

  const response = await fetch(buildApiUrl(`/api/accuracy/download/${latestJson.name}`));
  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return payload.summary || null;
}

function formatGeneratedAt(item) {
  if (item.generatedAt) {
    const parsed = new Date(item.generatedAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString();
    }
  }

  if (typeof item.mtimeMs === 'number') {
    return new Date(item.mtimeMs).toLocaleString();
  }

  return 'Unknown';
}

function buildTrendSummary(currentOverall, previousSummary) {
  if (!previousSummary || typeof previousSummary.overall !== 'number') {
    return {
      text: 'First run - no baseline to compare against.',
      color: '#94a3b8',
    };
  }

  const delta = currentOverall - previousSummary.overall;
  if (Math.abs(delta) < 0.0001) {
    return {
      text: 'No change vs last run',
      color: '#94a3b8',
    };
  }

  const direction = delta > 0 ? 'up' : 'down';
  const arrow = delta > 0 ? 'Up' : 'Down';
  const percentage = `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(2)}%`;
  return {
    text: `${arrow} ${percentage} vs last run`,
    color: delta > 0 ? '#34d399' : '#fb7185',
    direction,
  };
}

function buildAccuracyResultCard(scoreResponse, previousSummary) {
  const summary = scoreResponse.summary;
  const matched = Object.values(summary.byType).reduce(
    (sum, row) => sum + row.correct,
    0
  );
  const skipped = summary.skipped || 0;
  const total = summary.total || 0;
  const trend = buildTrendSummary(summary.overall, previousSummary);
  const toPercent = (value) => `${(value * 100).toFixed(2)}%`;

  let typeRows = '';
  for (const [type, row] of Object.entries(summary.byType)) {
    const accuracyColor =
      row.accuracy >= 0.85 ? '#34d399' : row.accuracy >= 0.5 ? '#facc15' : '#fb7185';
    typeRows += `
      <tr>
        <td style="padding: 6px 10px; border-bottom: 1px solid var(--border);">${type}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid var(--border); text-align: center;">${row.total}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid var(--border); text-align: center;">${row.correct}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid var(--border); text-align: center; color: ${accuracyColor};">${toPercent(row.accuracy)}</td>
      </tr>
    `;
  }

  return `
    <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem;">
      <div style="text-align: center; margin-bottom: 1rem;">
        <div style="font-size: 2rem; font-weight: 700; background: linear-gradient(to right, #34d399, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${toPercent(summary.overall)}</div>
        <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Overall Accuracy</div>
        <div style="margin-top: 0.5rem; color: ${trend.color}; font-size: 0.82rem; font-weight: 600;">
          ${trend.text}
        </div>
      </div>
      <div style="display: flex; justify-content: space-around; margin-bottom: 1rem; font-size: 0.8rem; color: var(--text-muted);">
        <span>Total: <strong style="color: var(--text);">${total}</strong></span>
        <span>Matched: <strong style="color: #34d399;">${matched}</strong></span>
        <span>Skipped: <strong style="color: #94a3b8;">${skipped}</strong></span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; color: var(--text);">
        <thead>
          <tr style="border-bottom: 2px solid var(--border);">
            <th style="padding: 6px 10px; text-align: left; color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase;">Type</th>
            <th style="padding: 6px 10px; text-align: center; color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase;">Total</th>
            <th style="padding: 6px 10px; text-align: center; color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase;">Correct</th>
            <th style="padding: 6px 10px; text-align: center; color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase;">Accuracy</th>
          </tr>
        </thead>
        <tbody>${typeRows}</tbody>
      </table>
      <div style="margin-top: 1rem; text-align: center;">
        <a href="${buildApiUrl(scoreResponse.excelPath)}" style="color: #818cf8; font-size: 0.85rem; text-decoration: none;" download>
          Download Excel Report
        </a>
      </div>
    </div>
  `;
}

async function loadAccuracyHistory(forceReload = false) {
  const historyContent = document.getElementById('accuracy-history-content');
  if (!historyContent) {
    return;
  }

  if (accuracyHistoryLoaded && !forceReload) {
    return;
  }

  historyContent.textContent = 'Loading previous results...';

  try {
    const items = await fetchAccuracyResults();
    const excelItems = items.filter((item) => item.name.endsWith('.xlsx'));

    if (excelItems.length === 0) {
      historyContent.innerHTML = '<div>No previous results.</div>';
      accuracyHistoryLoaded = true;
      return;
    }

    const rows = excelItems
      .map((item) => `
        <tr>
          <td style="padding: 6px 10px; border-bottom: 1px solid var(--border);">${item.name}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid var(--border);">${formatGeneratedAt(item)}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid var(--border); text-align: right;">
            <a href="${buildApiUrl(`/api/accuracy/download/${item.name}`)}" download style="color: #818cf8; text-decoration: none;">Download</a>
          </td>
        </tr>
      `)
      .join('');

    historyContent.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; color: var(--text);">
        <thead>
          <tr style="border-bottom: 2px solid var(--border);">
            <th style="padding: 6px 10px; text-align: left; color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase;">Filename</th>
            <th style="padding: 6px 10px; text-align: left; color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase;">Generated At</th>
            <th style="padding: 6px 10px; text-align: right; color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase;">Download</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    accuracyHistoryLoaded = true;
  } catch (error) {
    historyContent.textContent = 'Failed to load previous results.';
  }
}

async function runAccuracyScore() {
  const scoreBtn = document.getElementById('scoreBtn');
  const errorEl = document.getElementById('accuracy-error');
  const warningEl = document.getElementById('accuracy-warning');
  const resultEl = document.getElementById('accuracy-result');
  const refFile = document.getElementById('accuracyRef').value;
  const rawFile = document.getElementById('accuracyRaw').value;

  errorEl.style.display = 'none';
  warningEl.style.display = 'none';
  resultEl.style.display = 'none';

  if (!refFile || !rawFile) {
    errorEl.textContent = 'Please select both a reference file and a raw QA file.';
    errorEl.style.display = 'block';
    return;
  }

  scoreBtn.disabled = true;
  scoreBtn.innerHTML = '<span class="loader"></span> Scoring...';

  let previousSummary = null;
  try {
    previousSummary = await loadLatestPreviousSummary();
  } catch (error) {
    console.warn('Previous accuracy baseline could not be loaded:', error);
  }

  try {
    const response = await fetch(buildApiUrl('/api/accuracy/score'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceFile: refFile,
        rawQAFile: rawFile,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      errorEl.textContent = data.error || 'Scoring failed.';
      errorEl.style.display = 'block';
      return;
    }

    if (data.warning) {
      warningEl.textContent = `Warning: ${data.warning}`;
      warningEl.style.display = 'block';
    }

    resultEl.innerHTML = buildAccuracyResultCard(data, previousSummary);
    resultEl.style.display = 'block';

    accuracyHistoryLoaded = false;
    await loadAccuracyHistory(true);
  } catch (error) {
    errorEl.textContent = 'Connection error: Backend server unreachable.';
    errorEl.style.display = 'block';
  } finally {
    scoreBtn.disabled = false;
    scoreBtn.innerHTML = 'Run Accuracy Score';
  }
}
