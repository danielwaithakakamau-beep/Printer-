/**
 * Epson Print Hub – Frontend prototype
 * Supports:
 *  1. Local Wi-Fi / system print dialog
 *  2. Email Print (Epson Connect)
 *  3. Epson Connect API placeholders + config storage
 */

(() => {
  // ---------- State ----------
  let selectedFile = null;
  let currentMode = 'local';

  // ---------- DOM refs ----------
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const filePreview = document.getElementById('filePreview');
  const fileNameEl = document.getElementById('fileName');
  const fileSizeEl = document.getElementById('fileSize');
  const removeFileBtn = document.getElementById('removeFile');
  const logEl = document.getElementById('log');

  const tabs = document.querySelectorAll('.tab');
  const panels = {
    local: document.getElementById('panelLocal'),
    email: document.getElementById('panelEmail'),
    api: document.getElementById('panelApi'),
  };

  const btnLocalPrint = document.getElementById('btnLocalPrint');
  const btnEmailPrint = document.getElementById('btnEmailPrint');
  const btnApiPrint = document.getElementById('btnApiPrint');
  const btnCopyEmail = document.getElementById('btnCopyEmail');
  const btnSaveConfig = document.getElementById('btnSaveConfig');

  const printerEmailInput = document.getElementById('printerEmail');
  const clientIdInput = document.getElementById('clientId');
  const clientSecretInput = document.getElementById('clientSecret');
  const apiKeyInput = document.getElementById('apiKey');
  const deviceIdInput = document.getElementById('deviceId');

  // ---------- Helpers ----------
  function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${message}`;
    logEl.prepend(entry);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function updateButtons() {
    const hasFile = !!selectedFile;
    btnLocalPrint.disabled = !hasFile;
    btnEmailPrint.disabled = !hasFile || !printerEmailInput.value.trim();
    btnApiPrint.disabled = !hasFile;
  }

  function setFile(file) {
    selectedFile = file;
    if (file) {
      fileNameEl.textContent = file.name;
      fileSizeEl.textContent = formatSize(file.size);
      filePreview.classList.remove('hidden');
      dropzone.style.display = 'none';
      log(`File selected: ${file.name} (${formatSize(file.size)})`, 'success');
    } else {
      filePreview.classList.add('hidden');
      dropzone.style.display = 'block';
      log('File removed');
    }
    updateButtons();
  }

  // ---------- File handling ----------
  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      setFile(fileInput.files[0]);
    }
  });

  removeFileBtn.addEventListener('click', () => {
    fileInput.value = '';
    setFile(null);
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files[0]) setFile(files[0]);
  });

  // ---------- Mode tabs ----------
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentMode = tab.dataset.mode;

      Object.keys(panels).forEach((key) => {
        panels[key].classList.toggle('hidden', key !== currentMode);
      });

      log(`Switched to ${currentMode === 'local' ? 'Local Wi-Fi' : currentMode === 'email' ? 'Email Print' : 'Epson Connect API'} mode`);
    });
  });

  // ---------- Local Print ----------
  btnLocalPrint.addEventListener('click', () => {
    if (!selectedFile) return;

    log('Opening system print dialog…', 'info');

    // Create a temporary object URL and open a print-friendly window
    const url = URL.createObjectURL(selectedFile);
    const printWindow = window.open(url, '_blank');

    if (printWindow) {
      printWindow.addEventListener('load', () => {
        setTimeout(() => {
          printWindow.print();
          log('Print dialog opened. Choose your Epson printer from the list.', 'success');
        }, 500);
      });
    } else {
      // Fallback: use iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow.print();
        log('Print dialog opened via iframe.', 'success');
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 1000);
      };
    }
  });

  // ---------- Email Print ----------
  printerEmailInput.addEventListener('input', updateButtons);

  btnEmailPrint.addEventListener('click', () => {
    const email = printerEmailInput.value.trim();
    if (!selectedFile || !email) return;

    // Build mailto link. Note: most email clients have attachment limits;
    // for large files the user should attach manually or use the API path.
    const subject = encodeURIComponent(`Print: ${selectedFile.name}`);
    const body = encodeURIComponent(
      `Please print the attached file.\n\n` +
      `Settings requested:\n` +
      `- Paper: ${document.getElementById('paperSize').value}\n` +
      `- Color: ${document.getElementById('colorMode').value}\n` +
      `- Quality: ${document.getElementById('quality').value}\n` +
      `- Copies: ${document.getElementById('copies').value}\n` +
      `- Duplex: ${document.getElementById('duplex').checked ? 'Yes' : 'No'}\n\n` +
      `Sent from Epson Print Hub`
    );

    // mailto cannot reliably attach files from the browser for security reasons.
    // We open the compose window and instruct the user.
    const mailto = `mailto:${email}?subject=${subject}&body=${body}`;
    window.location.href = mailto;

    log(`Opened email client to ${email}. Please attach "${selectedFile.name}" manually and send.`, 'info');
    log('Epson Connect will receive the email and queue the print job on the printer.', 'success');
  });

  btnCopyEmail.addEventListener('click', async () => {
    const email = printerEmailInput.value.trim();
    if (!email) {
      log('Enter a printer email address first.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(email);
      log('Printer email copied to clipboard.', 'success');
    } catch {
      log('Could not copy. Select and copy manually.', 'error');
    }
  });

  // ---------- API mode (config + placeholder) ----------
  // Load saved config
  function loadConfig() {
    try {
      const cfg = JSON.parse(localStorage.getItem('epsonPrintHubConfig') || '{}');
      if (cfg.clientId) clientIdInput.value = cfg.clientId;
      if (cfg.clientSecret) clientSecretInput.value = cfg.clientSecret;
      if (cfg.apiKey) apiKeyInput.value = cfg.apiKey;
      if (cfg.deviceId) deviceIdInput.value = cfg.deviceId;
      if (cfg.printerEmail) printerEmailInput.value = cfg.printerEmail;
    } catch (_) {}
  }

  btnSaveConfig.addEventListener('click', () => {
    const cfg = {
      clientId: clientIdInput.value.trim(),
      clientSecret: clientSecretInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      deviceId: deviceIdInput.value.trim(),
      printerEmail: printerEmailInput.value.trim(),
    };
    localStorage.setItem('epsonPrintHubConfig', JSON.stringify(cfg));
    log('API configuration saved to localStorage (browser only).', 'success');
  });

  btnApiPrint.addEventListener('click', async () => {
    if (!selectedFile) return;

    const clientId = clientIdInput.value.trim();
    const clientSecret = clientSecretInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const deviceId = deviceIdInput.value.trim();

    if (!clientId || !clientSecret || !apiKey || !deviceId) {
      log('Please fill in Client ID, Client Secret, API Key and Device ID.', 'error');
      return;
    }

    log('Epson Connect API flow (simulated – real calls need a backend):', 'info');
    log('1. Authenticate with OAuth2 → obtain device token', 'info');
    log('2. Create print job with settings', 'info');
    log('3. Upload file to the returned upload URI', 'info');
    log('4. Execute the print job', 'info');
    log('See api-example.js and the README for a working Node.js / Python skeleton.', 'info');

    // In a real implementation you would call your own backend proxy here
    // because browser CORS and secret handling prevent direct calls.
    // Example:
    // const formData = new FormData();
    // formData.append('file', selectedFile);
    // formData.append('settings', JSON.stringify(getSettings()));
    // const res = await fetch('/api/epson/print', { method: 'POST', body: formData });
  });

  function getSettings() {
    return {
      paperSize: document.getElementById('paperSize').value,
      colorMode: document.getElementById('colorMode').value,
      printQuality: document.getElementById('quality').value,
      copies: parseInt(document.getElementById('copies').value, 10) || 1,
      duplex: document.getElementById('duplex').checked,
      borderless: document.getElementById('borderless').checked,
    };
  }

  // ---------- Init ----------
  loadConfig();
  updateButtons();
  log('Epson Print Hub ready. Select a mode and a file to begin.', 'success');
})();
