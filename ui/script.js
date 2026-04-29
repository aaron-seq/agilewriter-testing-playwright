document.addEventListener('DOMContentLoaded', async () => {
  const testSelect = document.getElementById('testFile');
  try {
    const res = await fetch('http://localhost:3000/list-tests');
    if (res.ok) {
      const tests = await res.json();
      if (tests && tests.length > 0) {
        testSelect.innerHTML = ''; // Clear default
        tests.forEach(testFile => {
          const option = document.createElement('option');
          option.value = testFile;
          option.textContent = testFile;
          testSelect.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error('Could not load test list:', error);
  }

  // Show/hide manual config section based on selected test script
  testSelect.addEventListener('change', toggleManualConfig);
  toggleManualConfig(); // Run once on load in case manual is pre-selected

  // Auto-fill per-row source folder inputs when shared source folder changes
  const sharedFolder = document.getElementById('manualSourceFolder');
  if (sharedFolder) {
    sharedFolder.addEventListener('input', () => {
      document.querySelectorAll('.source-folder-input').forEach(input => {
        if (!input.dataset.manuallyEdited) {
          input.value = sharedFolder.value;
        }
      });
    });
  }
});

/** Toggle visibility of manual config section and per-row folder inputs. */
function toggleManualConfig() {
  const testSelect = document.getElementById('testFile');
  const isManual = testSelect.value.includes('manual_input');
  const manualSection = document.getElementById('manual-config');
  if (manualSection) {
    manualSection.style.display = isManual ? 'block' : 'none';
  }
  // Show/hide per-row source folder inputs
  document.querySelectorAll('.source-folder-input').forEach(input => {
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
  // Pre-fill with shared folder value
  if (sharedFolder && sharedFolder.value) {
    folderInput.value = sharedFolder.value;
  }
  // Mark as manually edited when user types in it
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

let logEventSource = null;
let timerInterval = null;
let startTime = 0;

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

async function runTest() {
  const statusEl = document.getElementById('status');
  const runBtn = document.getElementById('runBtn');
  const terminal = document.getElementById('log-terminal');
  const statsDiv = document.getElementById('execution-stats');
  const timerEl = document.getElementById('timer');
  const runStatusEl = document.getElementById('run-status');
  
  statusEl.innerHTML = ''; // Clear final status string
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
  
  // Connect to SSE stream
  logEventSource = new EventSource('http://localhost:3000/stream');
  logEventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // ── Phase separator ─────────────────────────────────────────
      if (data.type === 'phase') {
        const sep = document.createElement('div');
        sep.classList.add('log-phase-separator');
        const isReport = data.message.toLowerCase().includes('report');
        sep.classList.add(isReport ? 'phase-report' : 'phase-test');
        const icon = isReport ? '🗒' : '▶';
        sep.innerHTML = `<span class="phase-icon">${icon}</span><span>${data.message}</span>`;
        terminal.appendChild(sep);
        terminal.scrollTop = terminal.scrollHeight;
        return; // phase lines have no timestamp badge
      }

      // ── Regular log line ─────────────────────────────────────────
      const row = document.createElement('div');

      let color = '#94a3b8'; // default muted text
      if (data.type === 'error') color = '#fb7185'; // rose color
      else if (data.type === 'info') color = '#38bdf8'; // sky blue
      else if (data.type === 'done') color = '#34d399'; // emerald
      else if (data.type === 'log') color = '#f8fafc'; // light text for normal logs

      row.style.color = color;

      const text = data.message.trim();
      if (text) {
        // Build [MM:SS] timestamp from server-provided elapsed ms
        const elapsedMs  = typeof data.elapsed === 'number' ? data.elapsed : 0;
        const totalSecs  = Math.floor(elapsedMs / 1000);
        const mm = String(Math.floor(totalSecs / 60)).padStart(2, '0');
        const ss = String(totalSecs % 60).padStart(2, '0');
        const tsHtml = `<span class="log-ts">[${mm}:${ss}]</span>`;

        row.innerHTML = tsHtml + document.createTextNode(text).textContent
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

        terminal.appendChild(row);
        terminal.scrollTop = terminal.scrollHeight;
      }

      if (data.type === 'info' || data.type === 'done') {
        runStatusEl.innerText = data.message.trim();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const testFile = document.getElementById('testFile').value;
  const isManual = testFile.includes('manual_input');

  const data = {
    testerName: document.getElementById('tester').value,
    email: document.getElementById('email').value,
    password: document.getElementById('password').value,
    template: document.getElementById('template').value,
    source: Array.from(document.querySelectorAll('.source-input')).map(input => input.value.trim()).filter(Boolean).join(','),
    folder: document.getElementById('folder').value,
    testFile: testFile,
    baseUrl: 'https://app-v2-rc1-aw.smarter.codes',
    appUrl: 'https://app-v2-rc1-aw.smarter.codes/signin',
    envName: 'QA'
  };

  // Add manual input fields when the manual script is selected
  if (isManual) {
    const sharedFolder = document.getElementById('manualSourceFolder').value.trim();
    data.manualTemplateName = data.template;
    data.manualTemplateFolder = document.getElementById('manualTemplateFolder').value.trim();
    data.manualTemplateTab = document.getElementById('manualTemplateTab').value;
    data.generatedScriptName = document.getElementById('generatedScriptName').value.trim();
    data.useQaFolderForSources = false;
    data.manualSourceFiles = Array.from(document.querySelectorAll('.source-input-group')).map(group => {
      const nameInput = group.querySelector('.source-input');
      const folderInput = group.querySelector('.source-folder-input');
      return {
        name: nameInput ? nameInput.value.trim() : '',
        folder: (folderInput && folderInput.value.trim()) || sharedFolder,
      };
    }).filter(s => s.name);
  }

  try {
    const response = await fetch('http://localhost:3000/run-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      statusEl.innerText = '✔ Test Cycle Completed Successfully';
      runStatusEl.innerText = '✔ Completed';
    } else {
      statusEl.innerText = '✖️ Test Execution Failed';
      runStatusEl.innerText = '✖️ Failed';
    }
  } catch (error) {
    statusEl.innerText = '✖️ Connection Error: Backend server unreachable';
    runStatusEl.innerText = '✖️ Error';
  } finally {
    clearInterval(timerInterval);
    if (logEventSource) logEventSource.close();
    runBtn.disabled = false;
    runBtn.style.opacity = '1';
  }
}

function downloadReport() {
  window.open('http://localhost:3000/download-report');
}
