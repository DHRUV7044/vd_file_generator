// Elements Selection
const ruledToggle = document.getElementById('ruled-toggle');
const mathToggle = document.getElementById('math-toggle');
const clearBtn = document.getElementById('clear-btn');
const fontSelect = document.getElementById('font-select');
const marginSelect = document.getElementById('margin-select');
const mainLabSheet = document.getElementById('main-lab-sheet');
const sectionsContainer = document.getElementById('sections-container');

// Local Storage Keys prefix
const STORAGE_PREFIX = 'vlsi_lab_record_';

let isMathRendered = false;
let lastActiveEditable = null;

// Undo/Redo State History Managers
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 50;
let isApplyingUndoRedo = false;
let typingHistoryTimeout = null;

function saveHistoryState() {
  if (isApplyingUndoRedo || isMathRendered) return;
  
  const expDateField = document.getElementById('exp-date-field');
  const startNumInput = document.getElementById('start-num-input');
  
  const currentState = {
    expNum: document.getElementById('exp-num-field').innerHTML,
    expDate: expDateField ? expDateField.innerHTML : "",
    startNum: startNumInput ? startNumInput.value : "1",
    sectionsMarkup: sectionsContainer.innerHTML,
    ruledState: ruledToggle.checked,
    fontStyle: fontSelect.value,
    marginStyle: marginSelect.value
  };
  
  // Prevent duplicate states
  if (undoStack.length > 0) {
    const lastState = undoStack[undoStack.length - 1];
    if (JSON.stringify(lastState) === JSON.stringify(currentState)) {
      return;
    }
  }
  
  undoStack.push(currentState);
  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }
  
  redoStack.length = 0; // Clear redo on action
  updateUndoRedoButtons();
}

function applyHistoryState(state) {
  if (!state) return;
  isApplyingUndoRedo = true;
  
  document.getElementById('exp-num-field').innerHTML = state.expNum || "";
  
  const expDateField = document.getElementById('exp-date-field');
  if (expDateField) expDateField.innerHTML = state.expDate || "";
  
  const startNumInput = document.getElementById('start-num-input');
  if (startNumInput) startNumInput.value = state.startNum || "1";
  
  sectionsContainer.innerHTML = migrateAndSanitizeHTML(state.sectionsMarkup || "");
  
  ruledToggle.checked = state.ruledState === true;
  toggleRuledClass(ruledToggle.checked);
  
  fontSelect.value = state.fontStyle || 'font-times';
  applyFontClass(fontSelect.value);
  
  marginSelect.value = state.marginStyle || 'margin-standard';
  applyMarginClass(marginSelect.value);
  
  // Update browser cache in sync
  localStorage.setItem(STORAGE_PREFIX + 'exp_num', state.expNum);
  if (expDateField) localStorage.setItem(STORAGE_PREFIX + 'exp_date', state.expDate || "");
  if (startNumInput) localStorage.setItem(STORAGE_PREFIX + 'start_num', state.startNum || "1");
  localStorage.setItem(STORAGE_PREFIX + 'sections_markup', state.sectionsMarkup);
  localStorage.setItem(STORAGE_PREFIX + 'ruled_state', state.ruledState);
  localStorage.setItem(STORAGE_PREFIX + 'font_choice', state.fontStyle);
  localStorage.setItem(STORAGE_PREFIX + 'margin_choice', state.marginStyle);
  
  updateSectionNumbers();
  updateImageNumbers();
  bindAllEvents();
  
  isApplyingUndoRedo = false;
  updateUndoRedoButtons();
}

function undo() {
  if (isMathRendered || undoStack.length <= 1) return;
  
  const currentState = undoStack.pop();
  redoStack.push(currentState);
  
  const prevState = undoStack[undoStack.length - 1];
  applyHistoryState(prevState);
}

function redo() {
  if (isMathRendered || redoStack.length === 0) return;
  
  const nextState = redoStack.pop();
  undoStack.push(nextState);
  applyHistoryState(nextState);
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  if (undoBtn && redoBtn) {
    undoBtn.disabled = isMathRendered || undoStack.length <= 1;
    redoBtn.disabled = isMathRendered || redoStack.length === 0;
  }
}

function handleTypingHistory() {
  if (typingHistoryTimeout) clearTimeout(typingHistoryTimeout);
  typingHistoryTimeout = setTimeout(() => {
    saveHistoryState();
  }, 1000);
}

// Dynamically inject MathJax layout protection styles to bypass HTML caches
function injectMathStyles() {
  const styleId = 'mathjax-dynamic-resets';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.innerHTML = `
    mjx-container {
      white-space: nowrap !important;
      display: inline-block !important;
      line-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    mjx-container[display="true"] {
      display: block !important;
      text-align: center;
      margin: 1em auto !important;
      white-space: nowrap !important;
    }
    mjx-container svg {
      display: inline-block !important;
      vertical-align: middle !important;
      margin: 0 !important;
      padding: 0 !important;
    }
  `;
  document.head.appendChild(style);
}
injectMathStyles();
document.addEventListener('DOMContentLoaded', injectMathStyles);

// Save Data Function (Serializes the entire sections container HTML)
function saveAllData() {
  if (isMathRendered) return;

  localStorage.setItem(STORAGE_PREFIX + 'exp_num', document.getElementById('exp-num-field').innerHTML);
  
  const expDateField = document.getElementById('exp-date-field');
  if (expDateField) {
    localStorage.setItem(STORAGE_PREFIX + 'exp_date', expDateField.innerHTML);
  }
  
  const startNumInput = document.getElementById('start-num-input');
  if (startNumInput) {
    localStorage.setItem(STORAGE_PREFIX + 'start_num', startNumInput.value);
  }

  localStorage.setItem(STORAGE_PREFIX + 'sections_markup', sectionsContainer.innerHTML);
  localStorage.setItem(STORAGE_PREFIX + 'ruled_state', ruledToggle.checked);
  localStorage.setItem(STORAGE_PREFIX + 'font_choice', fontSelect.value);
  localStorage.setItem(STORAGE_PREFIX + 'margin_choice', marginSelect.value);
  
  handleTypingHistory();
}

// Auto-migrator to modernize loaded document states, injecting colgroups and restoring math symbols
function migrateAndSanitizeHTML(htmlString) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;
  
  // 1. Inject colgroups to params-table if missing
  const paramsTable = tempDiv.querySelector('#params-table');
  if (paramsTable && !paramsTable.querySelector('colgroup')) {
    const colgroup = document.createElement('colgroup');
    colgroup.innerHTML = `
      <col style="width: 45%;">
      <col style="width: 25%;">
      <col style="width: 20%;">
      <col style="width: 10%;" class="table-actions-column">
    `;
    paramsTable.insertBefore(colgroup, paramsTable.firstChild);
  }
  
  // 2. Inject colgroups to comparison-table if missing
  const compTable = tempDiv.querySelector('#comparison-table');
  if (compTable && !compTable.querySelector('colgroup')) {
    const colgroup = document.createElement('colgroup');
    colgroup.innerHTML = `
      <col style="width: 40%;">
      <col style="width: 25%;">
      <col style="width: 25%;">
      <col style="width: 10%;" class="table-actions-column">
    `;
    compTable.insertBefore(colgroup, compTable.firstChild);
  }

  // 3. Ensure a colgroup exists on all other tables matching columns count
  const allTables = tempDiv.querySelectorAll('.lab-table');
  allTables.forEach(table => {
    if (!table.querySelector('colgroup')) {
      const colgroup = document.createElement('colgroup');
      const headerCols = table.querySelectorAll('thead tr th').length;
      let colHtml = '';
      for (let i = 0; i < headerCols; i++) {
        if (i === headerCols - 1) {
          colHtml += '<col style="width: 10%;" class="table-actions-column">';
        } else {
          colHtml += `<col style="width: ${Math.floor(90 / (headerCols - 1))}%">`;
        }
      }
      colgroup.innerHTML = colHtml;
      table.insertBefore(colgroup, table.firstChild);
    }
  });

  // 4. Sanitize and restore LaTeX symbols inside table cells
  const cells = tempDiv.querySelectorAll('.lab-table td[contenteditable="true"], .lab-table th span.editable-th');
  cells.forEach(cell => {
    let text = cell.innerText.replace(/\s+/g, ' ').trim(); // Flatten carriage returns to space
    
    // replacements rules to auto-heal symbols
    const replacements = [
      { regex: /^V\s*D\s*D$/i, replacement: '$V_{DD}$' },
      { regex: /^V\s*T\s*H$/i, replacement: '$V_{TH}$' },
      { regex: /^V\s*O\s*H$/i, replacement: '$V_{OH}$' },
      { regex: /^V\s*O\s*L$/i, replacement: '$V_{OL}$' },
      { regex: /^V\s*I\s*H$/i, replacement: '$V_{IH}$' },
      { regex: /^V\s*I\s*L$/i, replacement: '$V_{IL}$' },
      { regex: /^N\s*M\s*H$/i, replacement: '$NM_H$' },
      { regex: /^N\s*M\s*L$/i, replacement: '$NM_L$' },
      { regex: /^t\s*p\s*H\s*L$/i, replacement: '$t_{pHL}$' },
      { regex: /^t\s*p\s*L\s*H$/i, replacement: '$t_{pLH}$' },
      { regex: /^t\s*p$/i, replacement: '$t_p$' },
      { regex: /^t\s*r$/i, replacement: '$t_r$' },
      { regex: /^t\s*f$/i, replacement: '$t_f$' },
      { regex: /^PMOS Width\s*\(?\s*W\s*p\s*\)?$/i, replacement: 'PMOS Width ($W_p$)' },
      { regex: /^NMOS Width\s*\(?\s*W\s*n\s*\)?$/i, replacement: 'NMOS Width ($W_n$)' },
      { regex: /^Input Rise Time\s*\(?\s*t\s*r\s*\)?$/i, replacement: 'Input Rise Time ($t_r$)' },
      { regex: /^Input Fall Time\s*\(?\s*t\s*f\s*\)?$/i, replacement: 'Input Fall Time ($t_f$)' }
    ];

    for (let rule of replacements) {
      if (rule.regex.test(text)) {
        cell.innerHTML = rule.replacement;
        break;
      }
    }
  });

  // 5. Upgrade old flat report sections to have a .section-body wrapper and add-element bar
  const reportSections = tempDiv.querySelectorAll('.report-section');
  reportSections.forEach(sec => {
    // Check if it already has .section-body
    let body = sec.querySelector('.section-body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'section-body';
      
      const childNodes = Array.from(sec.childNodes);
      childNodes.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.classList.contains('section-header-row') || child.classList.contains('section-element-bar')) {
            return;
          }
        }
        body.appendChild(child);
      });
      
      const header = sec.querySelector('.section-header-row');
      if (header) {
        sec.insertBefore(body, header.nextSibling);
      } else {
        sec.insertBefore(body, sec.firstChild);
      }
    }

    // Ensure the section-element-bar is present
    let bar = sec.querySelector('.section-element-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'section-element-bar';
      bar.innerHTML = `
        <button class="btn-sec-add" onclick="addTableToSectionBody(this)">+ Add Table Grid</button>
        <button class="btn-sec-add" onclick="addImageSpaceToSectionBody(this)">+ Add Image Dropzone</button>
        <button class="btn-sec-add" onclick="addTextBlockToSectionBody(this)">+ Add Text Area</button>
      `;
      sec.appendChild(bar);
    }
  });

  // 6. Clean up old toolbars and upgrade image containers with 4 corner handles & floating contextual menu
  const oldControls = tempDiv.querySelectorAll('.gallery-controls-bar, .image-toolbar, .delete-image-btn, .resize-handle-se');
  oldControls.forEach(el => el.remove());

  const imgContainers = tempDiv.querySelectorAll('.image-container');
  imgContainers.forEach(container => {
    // Ensure all 4 corner handles exist
    ['nw', 'ne', 'sw', 'se'].forEach(dir => {
      if (!container.querySelector(`.resize-handle-${dir}`)) {
        const h = document.createElement('div');
        h.className = `resize-handle resize-handle-${dir}`;
        h.setAttribute('data-handle', dir);
        container.appendChild(h);
      }
    });

    // Ensure floating contextual bar exists and has updated controls
    let floatBar = container.querySelector('.image-floating-bar');
    if (!floatBar) {
      floatBar = document.createElement('div');
      floatBar.className = 'image-floating-bar';
      container.appendChild(floatBar);
    }
    floatBar.innerHTML = `
      <button class="img-bar-btn" onclick="setImageSize(this, '50%')">50%</button>
      <button class="img-bar-btn" onclick="setImageSize(this, '75%')">75%</button>
      <button class="img-bar-btn" onclick="setImageSize(this, '100%')">100%</button>
      <div class="img-bar-divider"></div>
      <button class="img-bar-btn" onclick="rotateImage(this)" title="Rotate image 90° clockwise">🔄 Rotate</button>
      <button class="img-bar-btn toggle-page-break-btn" onclick="toggleImagePageBreak(this)" title="Print 1 image on dedicated A4 page">📄 1/Page</button>
      <div class="img-bar-divider"></div>
      <button class="img-bar-btn danger" onclick="deleteImageContainer(this)">🗑 Delete</button>
    `;
  });

  // 7. Ensure images-space-wrapper has Upload / Add More Images button bar
  const imageWrappers = tempDiv.querySelectorAll('.images-space-wrapper');
  imageWrappers.forEach(wrapper => {
    let bar = wrapper.querySelector('.image-section-action-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'image-section-action-bar';
      bar.innerHTML = `
        <input type="file" class="hidden-file-input" accept="image/*" multiple style="display: none;" onchange="handleImageFileUpload(this)">
        <button class="btn-upload-more-img" onclick="triggerImageFileUpload(this)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          + Upload / Add More Images
        </button>
      `;
      const space = wrapper.querySelector('.images-space');
      if (space) {
        space.after(bar);
      } else {
        wrapper.insertBefore(bar, wrapper.firstChild);
      }
    }
  });

  // 8. Ensure images-space has empty-dropzone-prompt
  const imagesSpaces = tempDiv.querySelectorAll('.images-space');
  imagesSpaces.forEach(space => {
    let gallery = space.querySelector('.image-gallery');
    if (!gallery) {
      gallery = document.createElement('div');
      gallery.className = 'image-gallery';
      space.appendChild(gallery);
    }
    let prompt = space.querySelector('.empty-dropzone-prompt');
    if (!prompt) {
      prompt = document.createElement('div');
      prompt.className = 'empty-dropzone-prompt';
      prompt.setAttribute('onclick', 'triggerImageFileUpload(this)');
      prompt.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        <span>Click to Upload Image(s) or Drag & Drop / Paste (Ctrl+V)</span>
      `;
      space.appendChild(prompt);
    }
  });

  return tempDiv.innerHTML;
}

// Load Data Function (Restores full serialized markup)
function loadAllData() {
  const expNum = localStorage.getItem(STORAGE_PREFIX + 'exp_num');
  if (expNum !== null) document.getElementById('exp-num-field').innerHTML = expNum;

  const expDate = localStorage.getItem(STORAGE_PREFIX + 'exp_date');
  const expDateField = document.getElementById('exp-date-field');
  if (expDateField) {
    if (expDate !== null && expDate !== "") {
      expDateField.innerHTML = expDate;
    } else {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      expDateField.innerHTML = `${dd}/${mm}/${yyyy}`;
    }
  }

  const startNum = localStorage.getItem(STORAGE_PREFIX + 'start_num') || '1';
  const startNumInput = document.getElementById('start-num-input');
  if (startNumInput) startNumInput.value = startNum;

  const savedSections = localStorage.getItem(STORAGE_PREFIX + 'sections_markup');
  if (savedSections !== null) {
    sectionsContainer.innerHTML = migrateAndSanitizeHTML(savedSections);
  }

  const savedRuledState = localStorage.getItem(STORAGE_PREFIX + 'ruled_state') === 'true';
  ruledToggle.checked = savedRuledState;
  toggleRuledClass(savedRuledState);

  const fontChoice = localStorage.getItem(STORAGE_PREFIX + 'font_choice') || 'font-times';
  applyFontClass(fontChoice);

  const marginChoice = localStorage.getItem(STORAGE_PREFIX + 'margin_choice') || 'margin-standard';
  applyMarginClass(marginChoice);

  // Refresh numbering of sections and figures
  updateSectionNumbers();
  updateImageNumbers();

  // Bind all interactive events to DOM
  bindAllEvents();

  // Initial history snapshot
  saveHistoryState();
}

// Update Section numbers sequentially (e.g. 1. AIM, 2. TOOL, etc.)
function updateSectionNumbers() {
  const startNumInput = document.getElementById('start-num-input');
  const startNum = startNumInput ? parseInt(startNumInput.value, 10) || 1 : 1;
  const titles = sectionsContainer.querySelectorAll('.report-section');
  titles.forEach((sec, idx) => {
    const numSpan = sec.querySelector('.section-number');
    if (numSpan) {
      numSpan.textContent = `${startNum + idx}. `;
    }
  });
}

// Update Figure numbers dynamically across the entire document
function updateImageNumbers() {
  const containers = sectionsContainer.querySelectorAll('.image-container');
  containers.forEach((container, index) => {
    const numSpan = container.querySelector('.img-number');
    if (numSpan) {
      numSpan.textContent = `Figure ${index + 1}: `;
    }
  });
}

// Move Section Up DOM handler
function moveSectionUp(btn) {
  if (isMathRendered) return;
  saveHistoryState();
  const section = btn.closest('.report-section');
  const previous = section.previousElementSibling;
  if (previous && previous.classList.contains('report-section')) {
    sectionsContainer.insertBefore(section, previous);
    updateSectionNumbers();
    saveAllData();
  }
}

// Move Section Down DOM handler
function moveSectionDown(btn) {
  if (isMathRendered) return;
  saveHistoryState();
  const section = btn.closest('.report-section');
  const next = section.nextElementSibling;
  if (next && next.classList.contains('report-section')) {
    sectionsContainer.insertBefore(section, next.nextElementSibling);
    updateSectionNumbers();
    saveAllData();
  }
}

// Delete Section DOM handler
function deleteSection(btn) {
  if (isMathRendered) return;
  if (confirm('Are you sure you want to delete this entire section and all its contents?')) {
    saveHistoryState();
    const section = btn.closest('.report-section');
    section.remove();
    updateSectionNumbers();
    updateImageNumbers(); // refresh image index in case image dropzone was removed
    saveAllData();
  }
}

// Delete sub-block inside a section
function deleteSubBlock(btn) {
  if (isMathRendered) return;
  if (confirm('Are you sure you want to delete this element?')) {
    saveHistoryState();
    const wrapper = btn.closest('.sub-block-wrapper') || btn.closest('.table-container') || btn.closest('.images-space-wrapper');
    if (wrapper) {
      wrapper.remove();
      updateImageNumbers();
      saveAllData();
    }
  }
}

// Add a new row to a table
function addRow(tableId) {
  if (isMathRendered) return;
  const table = document.getElementById(tableId);
  if (!table) return;
  saveHistoryState();
  const theadRow = table.querySelector('thead tr');
  const tbody = table.querySelector('tbody');
  const colsCount = theadRow.children.length;
  
  const tr = document.createElement('tr');
  
  // Add data cells
  for (let i = 0; i < colsCount - 1; i++) {
    const td = document.createElement('td');
    td.contentEditable = 'true';
    if (i === 0) {
      td.textContent = 'New Parameter';
    }
    tr.appendChild(td);
  }
  
  // Add actions cell
  const actionTd = document.createElement('td');
  actionTd.className = 'row-actions-cell';
  actionTd.innerHTML = '<button class="delete-row-btn">&times;</button>';
  tr.appendChild(actionTd);
  
  tbody.appendChild(tr);
  
  // Bind event listeners to new row
  actionTd.querySelector('.delete-row-btn').onclick = function() {
    tr.remove();
    saveAllData();
  };
  
  tr.querySelectorAll('[contenteditable="true"]').forEach(cell => {
    cell.oninput = saveAllData;
  });
  
  saveAllData();
}

// Add a new column to a table
function addColumn(tableId) {
  if (isMathRendered) return;
  const table = document.getElementById(tableId);
  if (!table) return;
  saveHistoryState();
  const theadRow = table.querySelector('thead tr');
  const tbodyRows = table.querySelectorAll('tbody tr');
  const colsCount = theadRow.children.length;

  const th = document.createElement('th');
  th.innerHTML = `
    <div class="th-content-wrapper">
      <span contenteditable="true" class="editable-th">New Column</span>
      <button class="delete-col-btn" title="Delete Column">&times;</button>
    </div>
  `;

  theadRow.insertBefore(th, theadRow.children[colsCount - 1]);

  const colgroup = table.querySelector('colgroup');
  if (colgroup) {
    const col = document.createElement('col');
    col.style.width = '20%'; // Default width for new columns
    colgroup.insertBefore(col, colgroup.children[colgroup.children.length - 1]);
  }

  th.querySelector('.delete-col-btn').onclick = function() {
    deleteColumn(th);
  };

  tbodyRows.forEach(row => {
    const td = document.createElement('td');
    td.contentEditable = 'true';
    row.insertBefore(td, row.children[row.children.length - 1]);
    td.oninput = saveAllData;
  });

  th.querySelector('.editable-th').oninput = saveAllData;
  saveAllData();
}

// Delete a column from a table
function deleteColumn(thElement) {
  if (isMathRendered) return;
  saveHistoryState();
  const table = thElement.closest('table');
  const theadRow = table.querySelector('thead tr');
  const index = Array.from(theadRow.children).indexOf(thElement);

  if (index === -1) return;

  thElement.remove();

  const colgroup = table.querySelector('colgroup');
  if (colgroup && colgroup.children[index]) {
    colgroup.children[index].remove();
  }

  const tbodyRows = table.querySelectorAll('tbody tr');
  tbodyRows.forEach(row => {
    if (row.children[index]) {
      row.children[index].remove();
    }
  });

  saveAllData();
}

// Helper to process and append base64 images into a target gallery
function addImageToGallery(galleryElement, base64Data) {
  const imgContainer = document.createElement('div');
  imgContainer.className = 'image-container';
  imgContainer.style.width = '100%';

  const titleWrapper = document.createElement('div');
  titleWrapper.className = 'image-title-wrapper';

  const numSpan = document.createElement('span');
  numSpan.className = 'img-number';
  
  const captionSpan = document.createElement('span');
  captionSpan.className = 'img-caption';
  captionSpan.contentEditable = 'true';
  captionSpan.setAttribute('placeholder', '[Type image title here...]');
  captionSpan.oninput = saveAllData;

  titleWrapper.appendChild(numSpan);
  titleWrapper.appendChild(captionSpan);

  const img = document.createElement('img');
  img.src = base64Data;
  img.className = 'pasted-image';

  imgContainer.appendChild(titleWrapper);
  imgContainer.appendChild(img);

  // Append 4 Corner Handles
  ['nw', 'ne', 'sw', 'se'].forEach(dir => {
    const h = document.createElement('div');
    h.className = `resize-handle resize-handle-${dir}`;
    h.setAttribute('data-handle', dir);
    imgContainer.appendChild(h);
  });

  // Append Floating Contextual Toolbar
  const floatBar = document.createElement('div');
  floatBar.className = 'image-floating-bar';
  floatBar.innerHTML = `
    <button class="img-bar-btn" onclick="setImageSize(this, '50%')">50%</button>
    <button class="img-bar-btn" onclick="setImageSize(this, '75%')">75%</button>
    <button class="img-bar-btn" onclick="setImageSize(this, '100%')">100%</button>
    <div class="img-bar-divider"></div>
    <button class="img-bar-btn" onclick="rotateImage(this)" title="Rotate image 90° clockwise">🔄 Rotate</button>
    <button class="img-bar-btn toggle-page-break-btn" onclick="toggleImagePageBreak(this)" title="Print 1 image on dedicated A4 page">📄 1/Page</button>
    <div class="img-bar-divider"></div>
    <button class="img-bar-btn danger" onclick="deleteImageContainer(this)">🗑 Delete</button>
  `;
  imgContainer.appendChild(floatBar);

  galleryElement.appendChild(imgContainer);

  bindImageContainerEvents(imgContainer);
  updateImageNumbers();
  saveAllData();
}

function bindImageContainerEvents(container) {
  makeImageResizable(container);
  makeImageDraggable(container);

  // Restore rotation transform if stored in data-rotation
  const currentRot = container.getAttribute('data-rotation');
  if (currentRot) {
    const img = container.querySelector('.pasted-image');
    if (img) {
      const rotDeg = parseInt(currentRot, 10);
      img.style.transform = `rotate(${rotDeg}deg)`;
      if (rotDeg === 90 || rotDeg === 270) {
        img.style.margin = '15px 0';
      }
    }
  }

  // Restore per-image page break active state if stored
  const isPageBreak = container.getAttribute('data-page-break') === 'true';
  const pageBreakBtn = container.querySelector('.toggle-page-break-btn');
  if (isPageBreak) {
    container.classList.add('print-one-per-page');
    if (pageBreakBtn) pageBreakBtn.classList.add('active');
    let badge = container.querySelector('.page-break-indicator');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'page-break-indicator';
      badge.innerHTML = '📄 1/Page Print';
      container.appendChild(badge);
    }
  }
}

// Rotate image by 90 degrees clockwise per click
function rotateImage(btn) {
  if (isMathRendered) return;
  const container = btn.closest('.image-container');
  if (!container) return;

  saveHistoryState();

  let currentRot = parseInt(container.getAttribute('data-rotation') || '0', 10);
  let newRot = (currentRot + 90) % 360;
  container.setAttribute('data-rotation', newRot.toString());

  const img = container.querySelector('.pasted-image');
  if (img) {
    img.style.transform = `rotate(${newRot}deg)`;
  }

  saveAllData();
}

// Toggle per-image "Print 1 Image Per Page" mode
function toggleImagePageBreak(btn) {
  if (isMathRendered) return;
  const container = btn.closest('.image-container');
  if (!container) return;

  saveHistoryState();

  const isBreakActive = container.getAttribute('data-page-break') === 'true';
  const newBreakState = !isBreakActive;

  container.setAttribute('data-page-break', newBreakState.toString());

  if (newBreakState) {
    container.classList.add('print-one-per-page');
    btn.classList.add('active');
    btn.setAttribute('title', 'Page break ACTIVE: Image prints on dedicated page');

    let badge = container.querySelector('.page-break-indicator');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'page-break-indicator';
      badge.innerHTML = '📄 1/Page Print';
      container.appendChild(badge);
    }
  } else {
    container.classList.remove('print-one-per-page');
    btn.classList.remove('active');
    btn.setAttribute('title', 'Print this image on its own dedicated A4 page');

    let badge = container.querySelector('.page-break-indicator');
    if (badge) badge.remove();
  }

  saveAllData();
}

// Proportional Corner Drag-to-Resize Handler (Google Docs / MS Word Style)
function makeImageResizable(container) {
  const handles = container.querySelectorAll('.resize-handle');
  handles.forEach(handle => {
    handle.onmousedown = function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (isMathRendered) return;

      let isResizing = true;
      const startX = e.clientX;
      const startWidth = container.offsetWidth;
      const gallery = container.parentElement;
      const galleryWidth = gallery ? gallery.offsetWidth : 600;
      const dir = handle.getAttribute('data-handle');

      saveHistoryState();

      function onMouseMove(me) {
        if (!isResizing) return;
        let dx = me.clientX - startX;
        if (dir === 'nw' || dir === 'sw') {
          dx = -dx;
        }
        let newWidthPx = startWidth + dx;
        const minWidthPx = 120;
        if (newWidthPx < minWidthPx) newWidthPx = minWidthPx;
        if (newWidthPx > galleryWidth) newWidthPx = galleryWidth;

        const widthPercent = Math.round((newWidthPx / galleryWidth) * 100);
        container.style.width = widthPercent + '%';
      }

      function onMouseUp() {
        if (!isResizing) return;
        isResizing = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        saveAllData();
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
  });
}

function setImageSize(btn, sizeVal) {
  if (isMathRendered) return;
  const container = btn.closest('.image-container');
  if (container) {
    saveHistoryState();
    container.style.width = sizeVal;
    saveAllData();
  }
}

function deleteImageContainer(btn) {
  if (isMathRendered) return;
  const container = btn.closest('.image-container');
  if (container) {
    saveHistoryState();
    container.remove();
    updateImageNumbers();
    saveAllData();
  }
}

// Contextual Selection Event Listener (Select image on click & deselect outside)
document.addEventListener('click', function(e) {
  const clickedContainer = e.target.closest('.image-container');
  if (clickedContainer) {
    document.querySelectorAll('.image-container').forEach(c => c.classList.remove('is-selected'));
    clickedContainer.classList.add('is-selected');
  } else if (!e.target.closest('.image-floating-bar')) {
    document.querySelectorAll('.image-container').forEach(c => c.classList.remove('is-selected'));
  }
});

// Image File Picker Upload Helpers
function triggerImageFileUpload(btn) {
  if (isMathRendered) return;
  const wrapper = btn.closest('.images-space-wrapper') || btn.closest('.section-body') || btn.closest('.report-section');
  if (!wrapper) return;
  let input = wrapper.querySelector('.hidden-file-input');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.className = 'hidden-file-input';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    input.onchange = function() { handleImageFileUpload(input); };
    wrapper.appendChild(input);
  }
  input.click();
}

function handleImageFileUpload(input) {
  const files = input.files;
  if (!files || !files.length) return;

  const wrapper = input.closest('.images-space-wrapper') || input.closest('.section-body') || input.closest('.report-section');
  const gallery = wrapper ? wrapper.querySelector('.image-gallery') : null;
  if (!gallery) return;

  saveHistoryState();

  Array.from(files).forEach(file => {
    if (file.type.indexOf('image') === 0) {
      const reader = new FileReader();
      reader.onload = function(e) {
        addImageToGallery(gallery, e.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  input.value = '';
}

// MS Word-style Click, Hold & Move (Drag and Drop Reordering)
let draggedContainer = null;

function makeImageDraggable(container) {
  container.setAttribute('draggable', 'true');

  container.ondragstart = function(e) {
    if (isMathRendered) {
      e.preventDefault();
      return;
    }
    if (e.target.closest('.img-caption') || e.target.classList.contains('resize-handle-se')) {
      e.preventDefault();
      return;
    }

    draggedContainer = container;
    container.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'image-drag');
  };

  container.ondragend = function() {
    if (draggedContainer) {
      draggedContainer.classList.remove('is-dragging');
      draggedContainer = null;
    }
    document.querySelectorAll('.image-container').forEach(c => c.classList.remove('drag-over'));
  };

  container.ondragover = function(e) {
    if (!draggedContainer || draggedContainer === container) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    container.classList.add('drag-over');
  };

  container.ondragleave = function() {
    container.classList.remove('drag-over');
  };

  container.ondrop = function(e) {
    if (!draggedContainer || draggedContainer === container) return;
    e.preventDefault();
    container.classList.remove('drag-over');

    const gallery = container.parentElement;
    if (!gallery) return;

    saveHistoryState();

    const bounding = container.getBoundingClientRect();
    const midX = bounding.left + (bounding.width / 2);
    const midY = bounding.top + (bounding.height / 2);

    if (e.clientY < bounding.top + (bounding.height * 0.3) || (e.clientX < midX && Math.abs(e.clientY - midY) < bounding.height / 2)) {
      gallery.insertBefore(draggedContainer, container);
    } else {
      gallery.insertBefore(draggedContainer, container.nextSibling);
    }

    updateImageNumbers();
    saveAllData();
  };
}

// Keep track of which contenteditable was last active for inserting formulas
document.addEventListener('focusin', function(e) {
  if (e.target.contentEditable === "true") {
    lastActiveEditable = e.target;
  }
});

// Sidebar Helper: Insert formula or markdown tags directly at the user's cursor
function insertTemplateText(text) {
  if (isMathRendered) {
    alert("Please turn off 'Preview Math & Markdown' before inserting content.");
    return;
  }
  if (lastActiveEditable) {
    lastActiveEditable.focus();
    const sel = window.getSelection();
    if (sel.getRangeAt && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      
      // Position cursor directly after inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      lastActiveEditable.innerHTML += text;
    }
    saveAllData();
  } else {
    alert("Please click inside an editor writing block or table cell first where you want to insert the formula!");
  }
}

// Dynamic Margin Setup Changer
marginSelect.addEventListener('change', function(e) {
  saveHistoryState();
  applyMarginClass(e.target.value);
  saveAllData();
});

function applyMarginClass(marginClass) {
  mainLabSheet.classList.remove('margin-standard', 'margin-narrow', 'margin-wide');
  mainLabSheet.classList.add(marginClass);
  marginSelect.value = marginClass;
}

// Dynamic Font Setup Changer
fontSelect.addEventListener('change', function(e) {
  saveHistoryState();
  applyFontClass(e.target.value);
  saveAllData();
});

function applyFontClass(fontClass) {
  mainLabSheet.classList.remove('font-times', 'font-arial', 'font-georgia');
  mainLabSheet.classList.add(fontClass);
  fontSelect.value = fontClass;
}

// Bind all interactive and save event listeners across the document
function bindAllEvents() {
  // 1. Re-bind section controls
  document.querySelectorAll('.move-up-btn').forEach(btn => {
    btn.onclick = () => moveSectionUp(btn);
  });
  document.querySelectorAll('.move-down-btn').forEach(btn => {
    btn.onclick = () => moveSectionDown(btn);
  });
  document.querySelectorAll('.section-control-btn.delete').forEach(btn => {
    btn.onclick = () => deleteSection(btn);
  });

  // 2. Re-bind table cell row additions and actions
  document.querySelectorAll('.btn-add-row').forEach(btn => {
    btn.onclick = function() {
      const tableId = btn.getAttribute('data-table');
      addRow(tableId);
    };
  });
  document.querySelectorAll('.btn-add-col').forEach(btn => {
    btn.onclick = function() {
      const tableId = btn.getAttribute('data-table');
      addColumn(tableId);
    };
  });
  document.querySelectorAll('.delete-row-btn').forEach(btn => {
    btn.onclick = function() {
      if (isMathRendered) return;
      btn.closest('tr').remove();
      saveAllData();
    };
  });
  document.querySelectorAll('.delete-col-btn').forEach(btn => {
    btn.onclick = function() {
      deleteColumn(btn.closest('th'));
    };
  });

  // 3. Re-bind drag & drop interfaces
  document.querySelectorAll('.images-space').forEach(dropzone => {
    const gallery = dropzone.querySelector('.image-gallery');
    
    dropzone.ondragover = function(e) {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--primary)';
      dropzone.style.backgroundColor = 'rgba(99, 102, 241, 0.05)';
    };
    
    dropzone.ondragleave = function(e) {
      e.preventDefault();
      dropzone.style.borderColor = '#cbd5e1';
      dropzone.style.backgroundColor = '#fafbfc';
    };
    
    dropzone.ondrop = function(e) {
      e.preventDefault();
      dropzone.style.borderColor = '#cbd5e1';
      dropzone.style.backgroundColor = '#fafbfc';

      const files = e.dataTransfer.files;
      for (const file of files) {
        if (file.type.indexOf('image') === 0) {
          const reader = new FileReader();
          reader.onload = function(event) {
            addImageToGallery(gallery, event.target.result);
          };
          reader.readAsDataURL(file);
        }
      }
    };
  });

  // Re-bind image container toolbars and deletion
  document.querySelectorAll('.image-container').forEach(container => {
    bindImageContainerEvents(container);
  });

  // 4. Contenteditable auto-saves
  document.querySelectorAll('[contenteditable="true"]').forEach(el => {
    el.oninput = saveAllData;
  });

  // 5. Ensure all sections on screen have Upload buttons
  ensureUploadButtonsOnAllSections();
}

// Active DOM Upgrader: Attaches Upload buttons strictly to Image Sections & Image spaces
function ensureUploadButtonsOnAllSections() {
  // 1. Remove element-bar upload buttons from all section bars
  document.querySelectorAll('.btn-sec-add.btn-sec-upload').forEach(el => el.remove());

  // 2. Scan every image space across all sections
  const imageSpaces = document.querySelectorAll('.images-space');
  imageSpaces.forEach(space => {
    // Ensure empty prompt card exists
    let prompt = space.querySelector('.empty-dropzone-prompt');
    if (!prompt) {
      prompt = document.createElement('div');
      prompt.className = 'empty-dropzone-prompt';
      prompt.setAttribute('onclick', 'triggerImageFileUpload(this)');
      prompt.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        <span>Click to Upload Image(s) or Drag & Drop / Paste (Ctrl+V)</span>
      `;
      space.appendChild(prompt);
    }

    // Ensure action bar button (+ Upload / Add Image(s)) exists right below the image space
    const parentContainer = space.closest('.images-space-wrapper') || space.parentElement;
    if (parentContainer) {
      let actionContainer = parentContainer.querySelector('.image-section-action-bar');
      if (!actionContainer) {
        actionContainer = document.createElement('div');
        actionContainer.className = 'image-section-action-bar';
        actionContainer.innerHTML = `
          <input type="file" class="hidden-file-input" accept="image/*" multiple style="display: none;" onchange="handleImageFileUpload(this)">
          <button class="btn-upload-more-img" onclick="triggerImageFileUpload(this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            + Upload / Add Image(s)
          </button>
        `;
        if (space.nextSibling) {
          parentContainer.insertBefore(actionContainer, space.nextSibling);
        } else {
          parentContainer.appendChild(actionContainer);
        }
      }
    }
  });

// Toggle Section Page Break (Start Section on Next Page when printing)
function toggleSectionPageBreak(btn) {
  if (isMathRendered) return;
  const section = btn.closest('.report-section');
  if (!section) return;

  saveHistoryState();

  const isBreakActive = section.getAttribute('data-page-break') === 'true';
  const newBreakState = !isBreakActive;

  section.setAttribute('data-page-break', newBreakState.toString());

  if (newBreakState) {
    section.classList.add('section-page-break');
    btn.classList.add('active');
    btn.setAttribute('title', 'Page break ACTIVE: Section starts on a fresh new page when printing');
    
    let headerRow = section.querySelector('.section-header-row');
    if (headerRow && !headerRow.querySelector('.sec-break-indicator')) {
      const badge = document.createElement('span');
      badge.className = 'sec-break-indicator';
      badge.innerHTML = '📄 Starts on Next Page';
      const titleContainer = headerRow.querySelector('.section-title-container');
      if (titleContainer) {
        titleContainer.appendChild(badge);
      }
    }
  } else {
    section.classList.remove('section-page-break');
    btn.classList.remove('active');
    btn.setAttribute('title', 'Toggle: Start this section on a fresh new A4 page when printing');

    let badge = section.querySelector('.sec-break-indicator');
    if (badge) badge.remove();
  }

  saveAllData();
}

  // 3. For all Sections, ensure header controls include 📄 Next Page button, and 📷 Upload Image button for Image Sections
  const sections = document.querySelectorAll('.report-section');
  sections.forEach(sec => {
    const titleText = sec.querySelector('.section-title-text');
    const hasImageSpace = sec.querySelector('.images-space');
    const titleString = titleText ? titleText.textContent.toUpperCase() : '';
    const isImageSec = (hasImageSpace || titleString.includes('IMAGE') || titleString.includes('SIMULATION') || titleString.includes('SCREENSHOT'));

    let controls = sec.querySelector('.section-controls');
    if (controls) {
      // Ensure 📄 Next Page button exists
      let breakBtn = controls.querySelector('.section-page-break-btn');
      if (!breakBtn) {
        breakBtn = document.createElement('button');
        breakBtn.className = 'section-control-btn section-page-break-btn';
        breakBtn.title = 'Toggle: Start this section on a fresh new A4 page when printing';
        breakBtn.setAttribute('onclick', 'toggleSectionPageBreak(this)');
        breakBtn.innerHTML = '📄 Next Page';
        const delBtn = controls.querySelector('.delete');
        if (delBtn) {
          controls.insertBefore(breakBtn, delBtn);
        } else {
          controls.appendChild(breakBtn);
        }
      }

      // Re-apply section page break active state if stored
      if (sec.getAttribute('data-page-break') === 'true') {
        sec.classList.add('section-page-break');
        breakBtn.classList.add('active');
        let headerRow = sec.querySelector('.section-header-row');
        if (headerRow && !headerRow.querySelector('.sec-break-indicator')) {
          const badge = document.createElement('span');
          badge.className = 'sec-break-indicator';
          badge.innerHTML = '📄 Starts on Next Page';
          const titleContainer = headerRow.querySelector('.section-title-container');
          if (titleContainer) {
            titleContainer.appendChild(badge);
          }
        }
      }

      let headerUploadBtn = controls.querySelector('.upload-img-btn');
      let studioOpenBtn = controls.querySelector('.studio-open-btn');

      if (isImageSec) {
        if (!studioOpenBtn) {
          studioOpenBtn = document.createElement('button');
          studioOpenBtn.className = 'section-control-btn studio-open-btn';
          studioOpenBtn.title = 'Open Image Studio & Slide Builder';
          studioOpenBtn.setAttribute('onclick', 'openImageStudio(this)');
          studioOpenBtn.innerHTML = '🖼️ Studio';
          if (breakBtn) {
            controls.insertBefore(studioOpenBtn, breakBtn);
          } else {
            const delBtn = controls.querySelector('.delete');
            if (delBtn) {
              controls.insertBefore(studioOpenBtn, delBtn);
            } else {
              controls.appendChild(studioOpenBtn);
            }
          }
        }

        if (!headerUploadBtn) {
          headerUploadBtn = document.createElement('button');
          headerUploadBtn.className = 'section-control-btn upload-img-btn';
          headerUploadBtn.title = 'Upload Image to Section';
          headerUploadBtn.setAttribute('onclick', 'triggerImageFileUpload(this)');
          headerUploadBtn.innerHTML = '📷 Upload Image';
          if (studioOpenBtn) {
            controls.insertBefore(headerUploadBtn, studioOpenBtn);
          } else if (breakBtn) {
            controls.insertBefore(headerUploadBtn, breakBtn);
          } else {
            const delBtn = controls.querySelector('.delete');
            if (delBtn) {
              controls.insertBefore(headerUploadBtn, delBtn);
            } else {
              controls.appendChild(headerUploadBtn);
            }
          }
        }
      } else {
        if (headerUploadBtn) headerUploadBtn.remove();
        if (studioOpenBtn) studioOpenBtn.remove();
      }
    }
  });
}

// Image Studio & Slide Layout Builder State & Handlers
let activeStudioSection = null;
let studioImagesPerPage = 2;
let studioImagesData = [];

function openImageStudio(btn) {
  if (isMathRendered) return;
  const section = btn.closest('.report-section') || btn.closest('.sub-block-wrapper');
  if (!section) return;

  activeStudioSection = section;
  studioImagesData = [];

  // Extract images from section with geometry
  const containers = section.querySelectorAll('.image-container');
  let hasStoredPageIndex = false;

  containers.forEach(c => {
    const img = c.querySelector('.pasted-image');
    const captionSpan = c.querySelector('.img-caption');
    const rot = c.getAttribute('data-rotation') || '0';
    const xVal = c.getAttribute('data-x');
    const yVal = c.getAttribute('data-y');
    const wVal = c.getAttribute('data-width');
    const hVal = c.getAttribute('data-height');
    const zVal = c.getAttribute('data-zindex');
    const pVal = c.getAttribute('data-pageindex');

    if (pVal !== null && pVal !== undefined && pVal !== '') {
      hasStoredPageIndex = true;
    }

    if (img) {
      studioImagesData.push({
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        src: img.src,
        title: captionSpan ? captionSpan.textContent.trim() : '',
        rotation: parseInt(rot, 10),
        x: xVal ? parseFloat(xVal) : 10,
        y: yVal ? parseFloat(yVal) : 15,
        width: wVal ? parseFloat(wVal) : 190,
        height: hVal ? parseFloat(hVal) : 120,
        zIndex: zVal ? parseInt(zVal, 10) : 1,
        pageIndex: pVal !== null && pVal !== undefined && pVal !== '' ? parseInt(pVal, 10) : 0
      });
    }
  });

  // Extract stored grid preset if any
  const storedGrid = section.getAttribute('data-images-per-page');
  studioImagesPerPage = storedGrid ? (storedGrid === 'freeform' ? 'freeform' : parseInt(storedGrid, 10)) : (studioImagesData.length > 2 ? 4 : 2);

  const modal = document.getElementById('image-studio-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.querySelectorAll('.studio-preset-btn').forEach(btn => {
      const gridVal = btn.getAttribute('data-grid');
      if (gridVal == studioImagesPerPage) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (!hasStoredPageIndex) {
      reflowStudioPagination();
    } else {
      renderStudioCanvas();
    }
  }
}

function closeImageStudio() {
  const modal = document.getElementById('image-studio-modal');
  if (modal) modal.style.display = 'none';
  activeStudioSection = null;
}

function setStudioImagesPerPage(count) {
  studioImagesPerPage = count;
  document.querySelectorAll('.studio-preset-btn').forEach(btn => {
    const gridVal = btn.getAttribute('data-grid');
    if (gridVal == count) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  reflowStudioPagination();
}

function reflowStudioPagination() {
  const count = studioImagesPerPage;
  let capacityPerPage = parseInt(count, 10);
  if (isNaN(capacityPerPage) || capacityPerPage < 1) {
    capacityPerPage = 2; // Default 2 images per page for freeform or unassigned
  }

  const numImages = studioImagesData.length;
  const numPagesNeeded = Math.max(1, Math.ceil(numImages / capacityPerPage));

  // Re-build studioPagesList cleanly matching required pages
  studioPagesList = [];
  for (let p = 0; p < numPagesNeeded; p++) {
    studioPagesList.push({
      id: `page-${p + 1}`,
      layout: count
    });
  }

  // Automatically assign pageIndex to images based on layout preset
  studioImagesData.forEach((img, idx) => {
    img.pageIndex = Math.floor(idx / capacityPerPage);
  });

  renderStudioCanvas();
}

function addStudioTextBox() {
  studioImagesData.push({
    id: `txt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    isText: true,
    text: '[Type custom text box / note here...]',
    rotation: 0
  });
  renderStudioCanvas();
}

// Multi-Page Studio State & Page Handlers
let studioPagesList = [
  { id: 'page-1', layout: 2 }
];

function addStudioPage() {
  const newId = `page-${Date.now()}`;
  studioPagesList.push({ id: newId, layout: 2 });
  renderStudioCanvas();
}

function deleteStudioPage(pageId) {
  if (studioPagesList.length <= 1) return;
  const pageIdx = studioPagesList.findIndex(p => p.id === pageId);
  if (pageIdx !== -1) {
    const targetIdx = Math.max(0, pageIdx - 1);
    studioImagesData.forEach(img => {
      if (img.pageIndex === pageIdx) {
        img.pageIndex = targetIdx;
      } else if (img.pageIndex > pageIdx) {
        img.pageIndex--;
      }
    });
    studioPagesList.splice(pageIdx, 1);
    renderStudioCanvas();
  }
}

function changeStudioPageLayout(pageId, layoutVal) {
  const page = studioPagesList.find(p => p.id === pageId);
  if (page) {
    page.layout = layoutVal;
    renderStudioCanvas();
  }
}

function moveStudioItemToPage(itemId, targetPageIndex) {
  const item = studioImagesData.find(x => x.id === itemId);
  if (item) {
    item.pageIndex = parseInt(targetPageIndex, 10);
    renderStudioCanvas();
  }
}

function renderStudioCanvas() {
  const canvas = document.getElementById('studio-a4-canvas');
  if (!canvas) return;

  canvas.innerHTML = '';

  if (studioImagesData.length === 0) {
    canvas.innerHTML = `
      <div class="empty-dropzone-prompt" onclick="triggerStudioFileUpload()">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        <span>No images added yet. Click to Upload Images or Paste (Ctrl+V)</span>
      </div>
    `;
    return;
  }

  // Ensure every image has a valid pageIndex
  studioImagesData.forEach(img => {
    if (img.pageIndex === undefined || img.pageIndex < 0) {
      img.pageIndex = 0;
    }
  });

  // Calculate required pages if not existing
  const maxAssignedPage = Math.max(...studioImagesData.map(img => img.pageIndex || 0));
  while (studioPagesList.length <= maxAssignedPage) {
    studioPagesList.push({ id: `page-${Date.now()}-${studioPagesList.length}`, layout: 2 });
  }

  // Render Page Cards (Page 1, Page 2, Page 3...)
  studioPagesList.forEach((page, pIdx) => {
    const pageCard = document.createElement('div');
    pageCard.className = 'studio-a4-page-card';
    pageCard.setAttribute('data-page-index', pIdx);

    // Page Header Bar
    const headerBar = document.createElement('div');
    headerBar.className = 'studio-page-header-bar';

    const pageBadge = document.createElement('div');
    pageBadge.className = 'studio-page-badge';
    pageBadge.innerHTML = `📄 Page ${pIdx + 1} (A4 Sheet)`;

    const controlsGroup = document.createElement('div');
    controlsGroup.className = 'studio-page-actions';

    // Layout Dropdown for this page
    const layoutSelect = document.createElement('select');
    layoutSelect.className = 'studio-page-layout-select';
    layoutSelect.setAttribute('onchange', `changeStudioPageLayout('${page.id}', this.value)`);
    layoutSelect.innerHTML = `
      <option value="1" ${page.layout == 1 ? 'selected' : ''}>1 Image / Page (Full Hero)</option>
      <option value="2" ${page.layout == 2 ? 'selected' : ''}>2 Images / Page (Dual Split)</option>
      <option value="3" ${page.layout == 3 ? 'selected' : ''}>3 Images / Page (1 Top + 2 Bottom)</option>
      <option value="4" ${page.layout == 4 ? 'selected' : ''}>4 Images / Page (2x2 Quad)</option>
      <option value="freeform" ${page.layout == 'freeform' ? 'selected' : ''}>Freeform Drag</option>
    `;

    controlsGroup.appendChild(layoutSelect);

    if (studioPagesList.length > 1) {
      const delPageBtn = document.createElement('button');
      delPageBtn.className = 'studio-item-btn danger';
      delPageBtn.title = 'Delete Page';
      delPageBtn.innerHTML = '🗑 Delete Page';
      delPageBtn.setAttribute('onclick', `deleteStudioPage('${page.id}')`);
      controlsGroup.appendChild(delPageBtn);
    }

    // Click empty page card space to clear selection
    pageCard.addEventListener('pointerdown', (e) => {
      if (e.target === pageCard || e.target.classList.contains('studio-grid-container')) {
        clearStudioSelection();
      }
    });

    pageCard.appendChild(headerBar);

    // Grid Container for Page Items
    const pageItems = studioImagesData.filter(img => (img.pageIndex || 0) === pIdx);
    const layoutClass = page.layout;
    const gridContainer = document.createElement('div');
    gridContainer.className = `studio-grid-container grid-layout-${layoutClass}`;

    pageItems.forEach((item, idx) => {
      const overallIndex = idx + 1;
      const itemEl = document.createElement('div');
      itemEl.className = 'studio-item';
      itemEl.setAttribute('data-id', item.id);

      // Apply Page-Relative Coordinates & Geometry if set
      if (layoutClass === 'freeform') {
        itemEl.classList.add('freeform-item');
        itemEl.style.position = 'absolute';
        if (item.x !== undefined) itemEl.style.left = `${item.x}mm`;
        if (item.y !== undefined) itemEl.style.top = `${item.y}mm`;
        if (item.width !== undefined) itemEl.style.width = `${item.width}mm`;
        if (item.height !== undefined) itemEl.style.height = `${item.height}mm`;
        if (item.zIndex !== undefined) itemEl.style.zIndex = item.zIndex;
      }

      const rotDeg = item.rotation || 0;
      const defaultTitle = item.title ? item.title : `Figure ${overallIndex}:`;

      // Page Assign Dropdown
      let pageOptionsHTML = '';
      studioPagesList.forEach((_, optIdx) => {
        pageOptionsHTML += `<option value="${optIdx}" ${optIdx === pIdx ? 'selected' : ''}>Page ${optIdx + 1}</option>`;
      });

      if (item.isText) {
        itemEl.innerHTML = `
          <div class="studio-item-actions">
            <select class="studio-item-page-select" onchange="moveStudioItemToPage('${item.id}', this.value)" title="Move to Page">
              ${pageOptionsHTML}
            </select>
            <button class="studio-item-btn danger" onclick="deleteStudioItem('${item.id}')" title="Delete">🗑</button>
          </div>
          <div class="studio-item-title" contenteditable="true" style="font-size: 13px; font-weight: 600; width: 100%; border: none;" oninput="updateStudioItemText('${item.id}', this)">${item.text}</div>
        `;
      } else {
        itemEl.innerHTML = `
          <div class="studio-item-actions">
            <select class="studio-item-page-select" onchange="moveStudioItemToPage('${item.id}', this.value)" title="Move to Page">
              ${pageOptionsHTML}
            </select>
            <button class="studio-item-btn" onclick="rotateStudioItem('${item.id}')" title="Rotate 90°">🔄</button>
            <button class="studio-item-btn danger" onclick="deleteStudioItem('${item.id}')" title="Delete">🗑</button>
          </div>
          <div class="studio-item-title" contenteditable="true" oninput="updateStudioItemTitle('${item.id}', this)">${defaultTitle}</div>
          <img src="${item.src}" style="transform: rotate(${rotDeg}deg);">
        `;
      }

      // Attach Pointer Drag Event Listener
      itemEl.addEventListener('pointerdown', (e) => startStudioPointerDrag(e, item.id));

      gridContainer.appendChild(itemEl);
    });

    pageCard.appendChild(gridContainer);
    canvas.appendChild(pageCard);
  });

  updateStudioSelectionUI();

  // Render "+ Add New Page" button at bottom
  const addPageBtnContainer = document.createElement('div');
  addPageBtnContainer.style.margin = '20px 0';
  addPageBtnContainer.innerHTML = `
    <button class="btn btn-secondary" onclick="addStudioPage()" style="padding: 10px 24px; font-weight: 700; border-radius: 8px;">
      📄 + Add New Page (A4 Sheet)
    </button>
  `;
  canvas.appendChild(addPageBtnContainer);
}

function updateStudioItemText(id, editable) {
  const item = studioImagesData.find(x => x.id === id);
  if (item) {
    item.text = editable.textContent.trim();
  }
}

// Object Selection & Clipboard State
let selectedStudioItemIds = new Set();
let studioClipboardItem = null;

function selectStudioItem(id, isMultiSelect = false) {
  if (!isMultiSelect) {
    selectedStudioItemIds.clear();
  }
  if (id) {
    if (isMultiSelect && selectedStudioItemIds.has(id)) {
      selectedStudioItemIds.delete(id);
    } else {
      selectedStudioItemIds.add(id);
    }
  }
  updateStudioSelectionUI();
}

function clearStudioSelection() {
  selectedStudioItemIds.clear();
  updateStudioSelectionUI();
}

function updateStudioSelectionUI() {
  document.querySelectorAll('.studio-item').forEach(el => {
    const id = el.getAttribute('data-id');
    if (selectedStudioItemIds.has(id)) {
      el.classList.add('is-selected');
      ensureStudioSelectionBox(el, id);
    } else {
      el.classList.remove('is-selected');
      const box = el.querySelector('.studio-selection-box');
      if (box) box.remove();
    }
  });
}

function ensureStudioSelectionBox(itemEl, id) {
  if (itemEl.querySelector('.studio-selection-box')) return;

  const box = document.createElement('div');
  box.className = 'studio-selection-box';

  // Append 8 Handles
  ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].forEach(handleType => {
    const h = document.createElement('div');
    h.className = `studio-handle studio-handle-${handleType}`;
    h.setAttribute('data-handle', handleType);
    h.setAttribute('data-id', id);
    h.addEventListener('pointerdown', (e) => startStudioResize(e, id, handleType));
    box.appendChild(h);
  });

  // Rotation Knob
  const rotLine = document.createElement('div');
  rotLine.className = 'studio-rotate-line';
  const rotKnob = document.createElement('div');
  rotKnob.className = 'studio-rotate-knob';
  rotKnob.setAttribute('title', 'Drag to rotate (Hold Shift to snap 15°)');
  rotKnob.addEventListener('pointerdown', (e) => startStudioRotation(e, id));

  box.appendChild(rotLine);
  box.appendChild(rotKnob);
  itemEl.appendChild(box);
}

// Pointer Drag Engine (Move selected items together with snapping)
function startStudioPointerDrag(e, targetId) {
  if (e.target.closest('.studio-handle') || e.target.closest('.studio-rotate-knob') || e.target.closest('.studio-item-actions') || e.target.closest('[contenteditable="true"]')) {
    return;
  }

  e.preventDefault();
  const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
  selectStudioItem(targetId, isMulti);

  if (selectedStudioItemIds.size === 0) return;

  const startX = e.clientX;
  const startY = e.clientY;

  const initialGeometries = [];
  selectedStudioItemIds.forEach(id => {
    const item = studioImagesData.find(x => x.id === id);
    if (item) {
      initialGeometries.push({
        id,
        x: item.x || 10,
        y: item.y || 15,
        width: item.width || 190,
        height: item.height || 120,
        element: document.querySelector(`.studio-item[data-id="${id}"]`)
      });
    }
  });

  const pageCard = document.querySelector('.studio-a4-page-card');
  const pageRect = pageCard ? pageCard.getBoundingClientRect() : { width: 793, height: 1122 };
  const pxToMmRatio = 210 / pageRect.width;

  function onPointerMove(moveEvent) {
    const deltaXMm = (moveEvent.clientX - startX) * pxToMmRatio;
    const deltaYMm = (moveEvent.clientY - startY) * pxToMmRatio;

    initialGeometries.forEach(geo => {
      const item = studioImagesData.find(x => x.id === geo.id);
      if (!item) return;

      let newX = geo.x + deltaXMm;
      let newY = geo.y + deltaYMm;

      const snapTolerance = 3;
      const snapLinesContainer = getOrCreateSnapGuidesContainer(geo.element);

      if (Math.abs(newX + (item.width || 190) / 2 - 105) < snapTolerance) {
        newX = 105 - (item.width || 190) / 2;
        showSnapGuide(snapLinesContainer, 'y', '105mm');
      } else {
        hideSnapGuide(snapLinesContainer, 'y');
      }

      if (Math.abs(newY + (item.height || 120) / 2 - 148.5) < snapTolerance) {
        newY = 148.5 - (item.height || 120) / 2;
        showSnapGuide(snapLinesContainer, 'x', '148.5mm');
      } else {
        hideSnapGuide(snapLinesContainer, 'x');
      }

      item.x = Math.max(0, Math.min(210 - (item.width || 190), newX));
      item.y = Math.max(0, Math.min(297 - (item.height || 120), newY));

      if (geo.element) {
        geo.element.style.left = `${item.x}mm`;
        geo.element.style.top = `${item.y}mm`;
      }
    });
  }

  function onPointerUp() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    clearSnapGuides();
    saveAllData();
  }

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

// 8-Point Handle Resizing Engine
function startStudioResize(e, id, handleType) {
  e.stopPropagation();
  e.preventDefault();

  const item = studioImagesData.find(x => x.id === id);
  if (!item) return;

  const startX = e.clientX;
  const startY = e.clientY;
  const startW = item.width || 190;
  const startH = item.height || 120;
  const startPosX = item.x || 10;
  const startPosY = item.y || 15;
  const aspectRatio = item.aspectRatio || (startW / startH);

  const itemEl = document.querySelector(`.studio-item[data-id="${id}"]`);
  const pageCard = itemEl ? itemEl.closest('.studio-a4-page-card') : null;
  const pageRect = pageCard ? pageCard.getBoundingClientRect() : { width: 793 };
  const pxToMmRatio = 210 / pageRect.width;

  function onPointerMove(moveEvent) {
    const deltaX = (moveEvent.clientX - startX) * pxToMmRatio;
    const deltaY = (moveEvent.clientY - startY) * pxToMmRatio;

    let newW = startW;
    let newH = startH;
    let newX = startPosX;
    let newY = startPosY;

    const isCorner = ['nw', 'ne', 'sw', 'se'].includes(handleType);
    const lockAspect = isCorner && !(moveEvent.ctrlKey || moveEvent.metaKey);

    if (handleType.includes('e')) newW = startW + deltaX;
    if (handleType.includes('s')) newH = startH + deltaY;
    if (handleType.includes('w')) {
      newW = startW - deltaX;
      newX = startPosX + deltaX;
    }
    if (handleType.includes('n')) {
      newH = startH - deltaY;
      newY = startPosY + deltaY;
    }

    if (lockAspect) {
      newH = newW / aspectRatio;
    }

    if (newW >= 15 && newH >= 15) {
      item.width = newW;
      item.height = newH;
      item.x = newX;
      item.y = newY;

      if (itemEl) {
        itemEl.style.width = `${newW}mm`;
        itemEl.style.height = `${newH}mm`;
        itemEl.style.left = `${newX}mm`;
        itemEl.style.top = `${newY}mm`;
      }
    }
  }

  function onPointerUp() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    saveAllData();
  }

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

// Free Rotation Engine (Zero-Jump Math with Center Offset & Multi-Selection Support)
function startStudioRotation(e, id) {
  e.stopPropagation();
  e.preventDefault();

  const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
  if (!selectedStudioItemIds.has(id)) {
    selectStudioItem(id, isMulti);
  }

  saveHistoryState();

  const itemEl = document.querySelector(`.studio-item[data-id="${id}"]`);
  if (!itemEl) return;

  const rect = itemEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Record initial pointer angle and initial image rotation
  const initialPointerAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
  
  const targetIds = selectedStudioItemIds.has(id) ? Array.from(selectedStudioItemIds) : [id];
  const initialRotations = new Map();
  targetIds.forEach(targetId => {
    const item = studioImagesData.find(x => x.id === targetId);
    if (item) {
      initialRotations.set(targetId, item.rotation || 0);
    }
  });

  function onPointerMove(moveEvent) {
    const currentPointerAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI);
    let deltaAngle = currentPointerAngle - initialPointerAngle;

    if (moveEvent.shiftKey) {
      deltaAngle = Math.round(deltaAngle / 15) * 15;
    } else {
      deltaAngle = Math.round(deltaAngle);
    }

    targetIds.forEach(targetId => {
      const item = studioImagesData.find(x => x.id === targetId);
      const initialRot = initialRotations.get(targetId) || 0;
      if (item) {
        let newRot = Math.round(initialRot + deltaAngle) % 360;
        if (newRot < 0) newRot += 360;
        item.rotation = newRot;

        const targetEl = document.querySelector(`.studio-item[data-id="${targetId}"]`);
        if (targetEl) {
          const img = targetEl.querySelector('img');
          if (img) img.style.transform = `rotate(${item.rotation}deg)`;
        }
      }
    });
  }

  function onPointerUp() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    saveAllData();
  }

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

function rotateStudioItem(id) {
  saveHistoryState();
  const targetIds = selectedStudioItemIds.has(id) ? Array.from(selectedStudioItemIds) : [id];
  targetIds.forEach(targetId => {
    const item = studioImagesData.find(x => x.id === targetId);
    if (item) {
      item.rotation = ((item.rotation || 0) + 90) % 360;
    }
  });
  renderStudioCanvas();
  saveAllData();
}

function rotateStudioSelected() {
  if (selectedStudioItemIds.size === 0) return;
  saveHistoryState();

  selectedStudioItemIds.forEach(id => {
    const item = studioImagesData.find(x => x.id === id);
    if (item) {
      item.rotation = ((item.rotation || 0) + 90) % 360;
      const targetEl = document.querySelector(`.studio-item[data-id="${id}"]`);
      if (targetEl) {
        const img = targetEl.querySelector('img');
        if (img) img.style.transform = `rotate(${item.rotation}deg)`;
      }
    }
  });

  renderStudioCanvas();
  saveAllData();
}

function resetStudioRotation() {
  if (selectedStudioItemIds.size === 0) return;
  saveHistoryState();

  selectedStudioItemIds.forEach(id => {
    const item = studioImagesData.find(x => x.id === id);
    if (item) {
      item.rotation = 0;
      const targetEl = document.querySelector(`.studio-item[data-id="${id}"]`);
      if (targetEl) {
        const img = targetEl.querySelector('img');
        if (img) img.style.transform = `rotate(0deg)`;
      }
    }
  });

  renderStudioCanvas();
  saveAllData();
}

// Alignment Operations (Left, Center, Right, Top, Middle, Bottom)
function alignStudioObjects(mode) {
  if (selectedStudioItemIds.size === 0) return;
  saveHistoryState();

  const selectedItems = studioImagesData.filter(x => selectedStudioItemIds.has(x.id));
  if (!selectedItems.length) return;

  if (mode === 'left') {
    const minX = Math.min(...selectedItems.map(i => i.x || 10));
    selectedItems.forEach(i => i.x = minX);
  } else if (mode === 'center') {
    const avgCenterX = selectedItems.reduce((acc, i) => acc + (i.x || 10) + (i.width || 190) / 2, 0) / selectedItems.length;
    selectedItems.forEach(i => i.x = avgCenterX - (i.width || 190) / 2);
  } else if (mode === 'right') {
    const maxRight = Math.max(...selectedItems.map(i => (i.x || 10) + (i.width || 190)));
    selectedItems.forEach(i => i.x = maxRight - (i.width || 190));
  } else if (mode === 'top') {
    const minY = Math.min(...selectedItems.map(i => i.y || 15));
    selectedItems.forEach(i => i.y = minY);
  } else if (mode === 'middle') {
    const avgCenterY = selectedItems.reduce((acc, i) => acc + (i.y || 15) + (i.height || 120) / 2, 0) / selectedItems.length;
    selectedItems.forEach(i => i.y = avgCenterY - (i.height || 120) / 2);
  } else if (mode === 'bottom') {
    const maxBottom = Math.max(...selectedItems.map(i => (i.y || 15) + (i.height || 120)));
    selectedItems.forEach(i => i.y = maxBottom - (i.height || 120));
  }

  renderStudioCanvas();
  saveAllData();
}

// Distribution Operations (Horizontal / Vertical)
function distributeStudioObjects(direction) {
  const selectedItems = studioImagesData.filter(x => selectedStudioItemIds.has(x.id));
  if (selectedItems.length < 3) return;

  saveHistoryState();

  if (direction === 'horizontal') {
    selectedItems.sort((a, b) => (a.x || 0) - (b.x || 0));
    const minX = selectedItems[0].x || 0;
    const maxX = selectedItems[selectedItems.length - 1].x || 0;
    const step = (maxX - minX) / (selectedItems.length - 1);
    selectedItems.forEach((item, idx) => {
      item.x = minX + idx * step;
    });
  } else if (direction === 'vertical') {
    selectedItems.sort((a, b) => (a.y || 0) - (b.y || 0));
    const minY = selectedItems[0].y || 0;
    const maxY = selectedItems[selectedItems.length - 1].y || 0;
    const step = (maxY - minY) / (selectedItems.length - 1);
    selectedItems.forEach((item, idx) => {
      item.y = minY + idx * step;
    });
  }

  renderStudioCanvas();
  saveAllData();
}

// Layer Stacking Order (Front, Forward, Backward, Back)
function changeStudioObjectLayer(action) {
  if (selectedStudioItemIds.size === 0) return;
  saveHistoryState();

  selectedStudioItemIds.forEach(id => {
    const item = studioImagesData.find(x => x.id === id);
    if (!item) return;

    let currentZ = item.zIndex || 1;
    if (action === 'front') item.zIndex = 999;
    else if (action === 'forward') item.zIndex = currentZ + 1;
    else if (action === 'backward') item.zIndex = Math.max(1, currentZ - 1);
    else if (action === 'back') item.zIndex = 1;
  });

  renderStudioCanvas();
  saveAllData();
}

// Duplicate, Copy, Paste & Delete Selected Objects
function duplicateStudioSelected() {
  if (selectedStudioItemIds.size === 0) return;
  saveHistoryState();

  const newSelection = new Set();
  selectedStudioItemIds.forEach(id => {
    const item = studioImagesData.find(x => x.id === id);
    if (item) {
      const dup = {
        ...JSON.parse(JSON.stringify(item)),
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        x: (item.x || 10) + 5,
        y: (item.y || 15) + 5
      };
      studioImagesData.push(dup);
      newSelection.add(dup.id);
    }
  });

  selectedStudioItemIds = newSelection;
  renderStudioCanvas();
  saveAllData();
}

function copyStudioSelected() {
  if (selectedStudioItemIds.size === 0) return;
  const firstId = Array.from(selectedStudioItemIds)[0];
  const item = studioImagesData.find(x => x.id === firstId);
  if (item) {
    studioClipboardItem = JSON.parse(JSON.stringify(item));
  }
}

function pasteStudioClipboard() {
  if (!studioClipboardItem) return;
  saveHistoryState();

  const pasted = {
    ...JSON.parse(JSON.stringify(studioClipboardItem)),
    id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    x: (studioClipboardItem.x || 10) + 8,
    y: (studioClipboardItem.y || 15) + 8
  };

  studioImagesData.push(pasted);
  selectedStudioItemIds = new Set([pasted.id]);
  renderStudioCanvas();
  saveAllData();
}

function deleteStudioSelected() {
  if (selectedStudioItemIds.size === 0) return;
  saveHistoryState();

  studioImagesData = studioImagesData.filter(x => !selectedStudioItemIds.has(x.id));
  selectedStudioItemIds.clear();
  renderStudioCanvas();
  saveAllData();
}

// Snapping Helpers
function getOrCreateSnapGuidesContainer(itemEl) {
  if (!itemEl) return null;
  const pageCard = itemEl.closest('.studio-a4-page-card');
  return pageCard;
}

function showSnapGuide(container, axis, pos) {
  if (!container) return;
  let guide = container.querySelector(`.studio-snap-guide-${axis}`);
  if (!guide) {
    guide = document.createElement('div');
    guide.className = `studio-snap-guide studio-snap-guide-${axis}`;
    container.appendChild(guide);
  }
  if (axis === 'x') guide.style.top = pos;
  if (axis === 'y') guide.style.left = pos;
  guide.style.display = 'block';
}

function hideSnapGuide(container, axis) {
  if (!container) return;
  const guide = container.querySelector(`.studio-snap-guide-${axis}`);
  if (guide) guide.style.display = 'none';
}

function clearSnapGuides() {
  document.querySelectorAll('.studio-snap-guide').forEach(g => g.style.display = 'none');
}

// Keyboard Shortcuts Listener for Image Studio
window.addEventListener('keydown', function(e) {
  const modal = document.getElementById('image-studio-modal');
  if (!modal || modal.style.display === 'none') return;

  if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteStudioSelected();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault();
    copyStudioSelected();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault();
    pasteStudioClipboard();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    duplicateStudioSelected();
  } else if (e.key === 'Escape') {
    clearStudioSelection();
  } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    if (selectedStudioItemIds.size > 0) {
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      selectedStudioItemIds.forEach(id => {
        const item = studioImagesData.find(x => x.id === id);
        if (item) {
          if (e.key === 'ArrowLeft') item.x = Math.max(0, (item.x || 10) - step);
          if (e.key === 'ArrowRight') item.x = Math.min(210, (item.x || 10) + step);
          if (e.key === 'ArrowUp') item.y = Math.max(0, (item.y || 15) - step);
          if (e.key === 'ArrowDown') item.y = Math.min(297, (item.y || 15) + step);
        }
      });
      renderStudioCanvas();
    }
  }
});

function triggerStudioFileUpload() {
  const input = document.getElementById('studio-file-input');
  if (input) input.click();
}

function handleStudioFileUpload(input) {
  const files = input.files;
  if (!files || !files.length) return;

  Array.from(files).forEach(file => {
    if (file.type.indexOf('image') === 0) {
      const reader = new FileReader();
      reader.onload = function(e) {
        studioImagesData.push({
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          src: e.target.result,
          title: '',
          rotation: 0
        });
        renderStudioCanvas();
      };
      reader.readAsDataURL(file);
    }
  });

  input.value = '';
}

function applyStudioToSection() {
  if (!activeStudioSection) return;

  saveHistoryState();

  activeStudioSection.setAttribute('data-images-per-page', studioImagesPerPage.toString());
  
  let gallery = activeStudioSection.querySelector('.image-gallery');
  if (!gallery) {
    const space = activeStudioSection.querySelector('.images-space');
    if (space) {
      gallery = document.createElement('div');
      gallery.className = 'image-gallery';
      space.insertBefore(gallery, space.firstChild);
    }
  }

  if (gallery) {
    gallery.innerHTML = '';

    studioImagesData.forEach((item, idx) => {
      const overallIndex = idx + 1;
      const titleText = item.title ? item.title : `Figure ${overallIndex}:`;

      const imgContainer = document.createElement('div');
      imgContainer.className = 'image-container';
      if (studioImagesPerPage === 1) {
        imgContainer.classList.add('print-one-per-page');
        imgContainer.setAttribute('data-page-break', 'true');
      }
      imgContainer.setAttribute('data-rotation', (item.rotation || 0).toString());
      if (item.x !== undefined) imgContainer.setAttribute('data-x', item.x.toString());
      if (item.y !== undefined) imgContainer.setAttribute('data-y', item.y.toString());
      if (item.width !== undefined) imgContainer.setAttribute('data-width', item.width.toString());
      if (item.height !== undefined) imgContainer.setAttribute('data-height', item.height.toString());
      if (item.zIndex !== undefined) imgContainer.setAttribute('data-zindex', item.zIndex.toString());
      if (item.pageIndex !== undefined) imgContainer.setAttribute('data-pageindex', item.pageIndex.toString());

      const titleWrapper = document.createElement('div');
      titleWrapper.className = 'img-title-wrapper';

      const numSpan = document.createElement('span');
      numSpan.className = 'img-number-label';
      numSpan.textContent = `Figure ${overallIndex}: `;

      const captionSpan = document.createElement('span');
      captionSpan.className = 'img-caption';
      captionSpan.contentEditable = 'true';
      captionSpan.textContent = titleText.replace(/^Figure\s+\d+:\s*/i, '');

      titleWrapper.appendChild(numSpan);
      titleWrapper.appendChild(captionSpan);

      const img = document.createElement('img');
      img.src = item.src;
      img.className = 'pasted-image';
      img.style.transform = `rotate(${item.rotation}deg)`;

      imgContainer.appendChild(titleWrapper);
      imgContainer.appendChild(img);

      // Append 4 Corner Handles
      ['nw', 'ne', 'sw', 'se'].forEach(dir => {
        const h = document.createElement('div');
        h.className = `resize-handle resize-handle-${dir}`;
        h.setAttribute('data-handle', dir);
        imgContainer.appendChild(h);
      });

      // Append Floating Contextual Toolbar
      const floatBar = document.createElement('div');
      floatBar.className = 'image-floating-bar';
      floatBar.innerHTML = `
        <button class="img-bar-btn" onclick="setImageSize(this, '50%')">50%</button>
        <button class="img-bar-btn" onclick="setImageSize(this, '75%')">75%</button>
        <button class="img-bar-btn" onclick="setImageSize(this, '100%')">100%</button>
        <div class="img-bar-divider"></div>
        <button class="img-bar-btn" onclick="rotateImage(this)" title="Rotate image 90° clockwise">🔄 Rotate</button>
        <button class="img-bar-btn toggle-page-break-btn" onclick="toggleImagePageBreak(this)" title="Print 1 image on dedicated A4 page">📄 1/Page</button>
        <div class="img-bar-divider"></div>
        <button class="img-bar-btn danger" onclick="deleteImageContainer(this)">🗑 Delete</button>
      `;
      imgContainer.appendChild(floatBar);

      gallery.appendChild(imgContainer);
      bindImageContainerEvents(imgContainer);
    });

    updateImageNumbers();
  }

  saveAllData();
  closeImageStudio();
}

// LaTeX Status Diagnostic Badge Handler
function updateMathJaxStatus() {
  const badge = document.getElementById('math-status-badge');
  if (!badge) return;
  if (window.MathJax && window.MathJax.typesetPromise) {
    badge.textContent = '● LaTeX Ready';
    badge.style.color = '#4ade80';
    badge.style.backgroundColor = 'rgba(74, 222, 128, 0.1)';
  } else {
    badge.textContent = '● LaTeX Offline';
    badge.style.color = '#f87171';
    badge.style.backgroundColor = 'rgba(248, 113, 113, 0.1)';
  }
}

// Check loader status
window.addEventListener('load', function() {
  setTimeout(updateMathJaxStatus, 500);
  setTimeout(updateMathJaxStatus, 1500);
  setTimeout(updateMathJaxStatus, 3000);
});

function parseRichText(text) {
  // 1. Escape HTML to prevent injection first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  let mathBlocks = [];
  let blockCount = 0;
  
  // 2. Extract block math $$ ... $$
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, function(match, formula) {
    const placeholder = `<!--MATHBLOCK_${blockCount}-->`;
    mathBlocks.push({ placeholder, formula: `$$${formula}$$` });
    blockCount++;
    return placeholder;
  });
  
  // 3. Extract inline math $ ... $
  html = html.replace(/\$([\s\S]*?)\$/g, function(match, formula) {
    const cleanFormula = formula.replace(/[\r\n]/g, '').trim();
    const placeholder = `<!--MATHBLOCK_${blockCount}-->`;
    mathBlocks.push({ placeholder, formula: `$${cleanFormula}$` });
    blockCount++;
    return placeholder;
  });
  
  // Headers: # Title, ## Sub, ### Mini
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  
  // Formatting tags
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/__(.*?)__/g, '<u>$1</u>');
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Bullet list items parsing
  let lines = html.split('\n');
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.startsWith('- ') || line.startsWith('* ')) {
      let content = line.substring(2);
      if (!inList) {
        lines[i] = '<ul><li>' + content + '</li>';
        inList = true;
      } else {
        lines[i] = '<li>' + content + '</li>';
      }
    } else {
      if (inList) {
        lines[i - 1] = lines[i - 1] + '</ul>';
        inList = false;
      }
    }
  }
  if (inList) {
    lines[lines.length - 1] = lines[lines.length - 1] + '</ul>';
  }
  
  html = lines.join('<br>'); // Join lines back preserving standard linebreaks

  // 4. Restore LaTeX blocks safely back into placeholders
  mathBlocks.forEach(block => {
    html = html.replace(block.placeholder, block.formula);
  });
  
  return html;
}

// Render LaTeX Math & Markdown on page
function renderMathOnPage() {
  if (isMathRendered) return Promise.resolve();
  
  if (!window.MathJax || !window.MathJax.typesetPromise) {
    console.warn("MathJax not loaded yet. Check your internet connection.");
    alert("MathJax LaTeX renderer is not loaded. Please connect to the internet to preview formatted equations.");
    mathToggle.checked = false;
    return Promise.resolve();
  }

  // Save current input state
  saveAllData();
  
  // Lock editing and store raw html in a data attribute
  const elementsToRender = document.querySelectorAll(
    '.writing-space:not(.images-space), #exp-num-field, #exp-date-field, .editable-th, .lab-table td[contenteditable="true"], .section-title-text, .table-caption, .img-caption'
  );
  
  elementsToRender.forEach(el => {
    el.setAttribute('data-raw-content', el.innerHTML);
    
    // Compile markdown & LaTeX formulas
    const plainText = el.innerText;
    el.innerHTML = parseRichText(plainText);
    
    el.contentEditable = "false";
  });
  
  isMathRendered = true;
  
  // Trigger MathJax to typeset the modified elements
  MathJax.typesetClear(elementsToRender);
  return MathJax.typesetPromise(elementsToRender);
}

// Restore raw LaTeX text for editing
function restoreRawText() {
  if (!isMathRendered) return;
  
  const elementsToRestore = document.querySelectorAll('[data-raw-content]');
  elementsToRestore.forEach(el => {
    const raw = el.getAttribute('data-raw-content');
    if (raw !== null) {
      el.innerHTML = raw;
      el.removeAttribute('data-raw-content');
    }
    el.contentEditable = "true";
  });
  
  isMathRendered = false;
  bindAllEvents();
  updateUndoRedoButtons();
}

// Toggle Math Preview Listener
mathToggle.addEventListener('change', function(e) {
  if (e.target.checked) {
    renderMathOnPage().then(() => {
      updateUndoRedoButtons();
    });
  } else {
    restoreRawText();
  }
});

// Custom Document Printing workflow (Typesets math, prints, and restores editing state)
function printDocument() {
  renderMathOnPage().then(() => {
    setTimeout(() => {
      window.print();
      if (!mathToggle.checked) {
        restoreRawText();
      }
    }, 300);
  });
}

// Toggle Ruled CSS Class helper
function toggleRuledClass(isRuled) {
  const spaces = document.querySelectorAll('.writing-space:not(.images-space)');
  spaces.forEach(space => {
    if (isRuled) {
      space.classList.add('ruled');
    } else {
      space.classList.remove('ruled');
    }
  });
}

// Handle Ruled Lines Toggle
ruledToggle.addEventListener('change', function(e) {
  saveHistoryState();
  toggleRuledClass(e.target.checked);
  saveAllData();
});

// Global Paste Image Router
window.addEventListener('paste', function(e) {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (const item of items) {
    if (item.type.indexOf('image') === 0) {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = function(event) {
        // Find appropriate gallery
        let targetGallery = null;
        if (lastActiveEditable && lastActiveEditable.classList.contains('images-space')) {
          targetGallery = lastActiveEditable.querySelector('.image-gallery');
        }
        if (!targetGallery) {
          targetGallery = sectionsContainer.querySelector('.image-gallery');
        }
        
        if (targetGallery) {
          addImageToGallery(targetGallery, event.target.result);
        } else {
          alert("Please insert an Image Space section first using the sidebar controls!");
        }
      };
      reader.readAsDataURL(blob);
      e.preventDefault();
    }
  }
});

// Sub-Block Element Creators
function createSubTableBlockHTML() {
  const tableId = `table-${Date.now()}`;
  return `
    <div class="sub-block-wrapper table-container">
      <div class="table-caption" contenteditable="true">Table Caption</div>
      <table class="lab-table" id="${tableId}">
        <colgroup>
          <col style="width: 50%;">
          <col style="width: 40%;">
          <col style="width: 10%;" class="table-actions-column">
        </colgroup>
        <thead>
          <tr>
            <th>
              <div class="th-content-wrapper">
                <span contenteditable="true" class="editable-th">Parameter</span>
              </div>
            </th>
            <th>
              <div class="th-content-wrapper">
                <span contenteditable="true" class="editable-th">Value</span>
                <button class="delete-col-btn" title="Delete Column">&times;</button>
              </div>
            </th>
            <th class="table-actions-header"></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td contenteditable="true">Parameter Name</td>
            <td contenteditable="true"></td>
            <td class="row-actions-cell"><button class="delete-row-btn">&times;</button></td>
          </tr>
        </tbody>
      </table>
      <div class="table-actions-row">
        <button class="btn-add-row" data-action="add-row" data-table="${tableId}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Row
        </button>
        <button class="btn-add-col" data-action="add-col" data-table="${tableId}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Column
        </button>
        <button class="btn-delete-block" onclick="deleteSubBlock(this)">Delete Table</button>
      </div>
    </div>
  `;
}

function createSubImagesBlockHTML() {
  const dropzoneId = `dropzone-${Date.now()}`;
  const galleryId = `gallery-${Date.now()}`;
  return `
    <div class="sub-block-wrapper images-space-wrapper">
      <div class="writing-space images-space" id="${dropzoneId}" tabindex="0">
        <div class="image-gallery" id="${galleryId}"></div>
        <div class="empty-dropzone-prompt" onclick="triggerImageFileUpload(this)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          <span>Click to Upload Image(s) or Drag & Drop / Paste (Ctrl+V)</span>
        </div>
      </div>
      <div class="image-section-action-bar">
        <input type="file" class="hidden-file-input" accept="image/*" multiple style="display: none;" onchange="handleImageFileUpload(this)">
        <button class="btn-upload-more-img" onclick="triggerImageFileUpload(this)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          + Upload / Add More Images
        </button>
      </div>
      <div class="block-controls-row">
        <button class="btn-delete-block" onclick="deleteSubBlock(this)">Delete Image Space</button>
      </div>
    </div>
  `;
}

function createSubTextBlockHTML() {
  const savedRuledState = ruledToggle.checked;
  const ruledClass = savedRuledState ? "ruled" : "";
  return `
    <div class="sub-block-wrapper text-block-wrapper">
      <div class="writing-space ${ruledClass}" contenteditable="true" placeholder="[Type text content here...]"></div>
      <div class="block-controls-row">
        <button class="btn-delete-block" onclick="deleteSubBlock(this)">Delete Text Area</button>
      </div>
    </div>
  `;
}

// Add elements inside a section body
function addTableToSectionBody(btn) {
  if (isMathRendered) return;
  saveHistoryState();
  const body = btn.closest('.report-section').querySelector('.section-body');
  const temp = document.createElement('div');
  temp.innerHTML = createSubTableBlockHTML();
  body.appendChild(temp.firstElementChild);
  bindAllEvents();
  saveAllData();
}

function addImageSpaceToSectionBody(btn) {
  if (isMathRendered) return;
  saveHistoryState();
  const body = btn.closest('.report-section').querySelector('.section-body');
  const temp = document.createElement('div');
  temp.innerHTML = createSubImagesBlockHTML();
  body.appendChild(temp.firstElementChild);
  bindAllEvents();
  saveAllData();
}

function addTextBlockToSectionBody(btn) {
  if (isMathRendered) return;
  saveHistoryState();
  const body = btn.closest('.report-section').querySelector('.section-body');
  const temp = document.createElement('div');
  temp.innerHTML = createSubTextBlockHTML();
  body.appendChild(temp.firstElementChild);
  bindAllEvents();
  saveAllData();
}

// --- Dynamic Section Adding ---

// 1. Text Section Creator (Top-Level)
document.getElementById('btn-new-text-sec').onclick = function() {
  if (isMathRendered) return;
  const section = document.createElement('div');
  section.className = 'report-section';
  section.setAttribute('data-type', 'text');
  section.innerHTML = `
    <div class="section-header-row">
      <div class="section-title-container">
        <span class="section-number"></span>
        <span class="section-title-text" contenteditable="true">NEW SECTION</span>
      </div>
      <div class="section-controls">
        <button class="section-control-btn move-up-btn" title="Move Up">↑</button>
        <button class="section-control-btn move-down-btn" title="Move Down">↓</button>
        <button class="section-control-btn delete" title="Delete Section">&times;</button>
      </div>
    </div>
    <div class="section-body">
      <div class="writing-space" contenteditable="true" placeholder="[Type content here. Supports LaTeX equations.]"></div>
    </div>
    <div class="section-element-bar">
      <button class="btn-sec-add" onclick="addTableToSectionBody(this)">+ Add Table Grid</button>
      <button class="btn-sec-add" onclick="addImageSpaceToSectionBody(this)">+ Add Image Dropzone</button>
      <button class="btn-sec-add" onclick="addTextBlockToSectionBody(this)">+ Add Text Area</button>
    </div>
  `;
  sectionsContainer.appendChild(section);
  
  updateSectionNumbers();
  bindAllEvents();
  saveAllData();
  
  section.querySelector('.section-title-text').focus();
};

// 2. Table Section Creator (Top-Level)
document.getElementById('btn-new-table-sec').onclick = function() {
  if (isMathRendered) return;
  const tableId = `table-${Date.now()}`;
  const section = document.createElement('div');
  section.className = 'report-section';
  section.setAttribute('data-type', 'table');
  section.innerHTML = `
    <div class="section-header-row">
      <div class="section-title-container">
        <span class="section-number"></span>
        <span class="section-title-text" contenteditable="true">NEW TABLE SECTION</span>
      </div>
      <div class="section-controls">
        <button class="section-control-btn move-up-btn" title="Move Up">↑</button>
        <button class="section-control-btn move-down-btn" title="Move Down">↓</button>
        <button class="section-control-btn delete" title="Delete Section">&times;</button>
      </div>
    </div>
    <div class="section-body">
      <div class="table-container">
        <div class="table-caption" contenteditable="true">Table Caption</div>
        <table class="lab-table" id="${tableId}">
          <thead>
            <tr>
              <th style="width: 50%;">
                <div class="th-content-wrapper">
                  <span contenteditable="true" class="editable-th">Parameter</span>
                </div>
              </th>
              <th style="width: 40%;">
                <div class="th-content-wrapper">
                  <span contenteditable="true" class="editable-th">Value</span>
                  <button class="delete-col-btn" title="Delete Column">&times;</button>
                </div>
              </th>
              <th style="width: 10%;" class="table-actions-header"></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td contenteditable="true">Parameter Name</td>
              <td contenteditable="true"></td>
              <td class="row-actions-cell"><button class="delete-row-btn">&times;</button></td>
            </tr>
          </tbody>
        </table>
        <div class="table-actions-row">
          <button class="btn-add-row" data-action="add-row" data-table="${tableId}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Row
          </button>
          <button class="btn-add-col" data-action="add-col" data-table="${tableId}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Column
          </button>
          <button class="btn-delete-block" onclick="deleteSubBlock(this)">Delete Table</button>
        </div>
      </div>
    </div>
    <div class="section-element-bar">
      <button class="btn-sec-add" onclick="addTableToSectionBody(this)">+ Add Table Grid</button>
      <button class="btn-sec-add" onclick="addImageSpaceToSectionBody(this)">+ Add Image Dropzone</button>
      <button class="btn-sec-add" onclick="addTextBlockToSectionBody(this)">+ Add Text Area</button>
    </div>
  `;
  sectionsContainer.appendChild(section);
  
  updateSectionNumbers();
  bindAllEvents();
  saveAllData();
  
  section.querySelector('.section-title-text').focus();
};

// 3. Images Section Creator (Top-Level)
document.getElementById('btn-new-images-sec').onclick = function() {
  if (isMathRendered) return;
  const dropzoneId = `dropzone-${Date.now()}`;
  const galleryId = `gallery-${Date.now()}`;
  
  const section = document.createElement('div');
  section.className = 'report-section';
  section.setAttribute('data-type', 'images');
  section.innerHTML = `
    <div class="section-header-row">
      <div class="section-title-container">
        <span class="section-number"></span>
        <span class="section-title-text" contenteditable="true">NEW IMAGES SECTION</span>
      </div>
      <div class="section-controls">
        <button class="section-control-btn move-up-btn" title="Move Up">↑</button>
        <button class="section-control-btn move-down-btn" title="Move Down">↓</button>
        <button class="section-control-btn delete" title="Delete Section">&times;</button>
      </div>
    </div>
    <div class="section-body">
      <div class="writing-space images-space" id="${dropzoneId}" tabindex="0" placeholder="[Leave a large blank section for pasting experiment screenshots/images. Paste image (Ctrl+V) or Drag & Drop screenshot file directly here.]">
        <div class="image-gallery" id="${galleryId}"></div>
      </div>
    </div>
    <div class="section-element-bar">
      <button class="btn-sec-add" onclick="addTableToSectionBody(this)">+ Add Table Grid</button>
      <button class="btn-sec-add" onclick="addImageSpaceToSectionBody(this)">+ Add Image Dropzone</button>
      <button class="btn-sec-add" onclick="addTextBlockToSectionBody(this)">+ Add Text Area</button>
    </div>
  `;
  sectionsContainer.appendChild(section);
  
  updateSectionNumbers();
  bindAllEvents();
  saveAllData();
  
  section.querySelector('.section-title-text').focus();
};

// Save Backup JSON file trigger
document.getElementById('save-file-btn').addEventListener('click', function() {
  if (isMathRendered) {
    alert("Please turn off 'Preview Math' before exporting the backup.");
    return;
  }
  
  const expDateField = document.getElementById('exp-date-field');
  const startNumInput = document.getElementById('start-num-input');
  const backupData = {
    version: "1.3",
    exp_num: document.getElementById('exp-num-field').innerHTML,
    exp_date: expDateField ? expDateField.innerHTML : "",
    start_num: startNumInput ? startNumInput.value : "1",
    sections_markup: sectionsContainer.innerHTML,
    ruled_state: ruledToggle.checked,
    font_choice: fontSelect.value,
    margin_choice: marginSelect.value
  };
  
  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const rawExpNum = document.getElementById('exp-num-field').innerText.trim() || "______";
  const filename = `VLSI_Exp_Record_${rawExpNum.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Trigger Load file dialog
const fileInputHidden = document.getElementById('file-input-hidden');
document.getElementById('load-file-btn').addEventListener('click', function() {
  if (isMathRendered) {
    alert("Please turn off 'Preview Math' before loading a backup.");
    return;
  }
  fileInputHidden.click();
});

// Read and import selected JSON file
fileInputHidden.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const importedData = JSON.parse(evt.target.result);
      
      if (!importedData.sections_markup) {
        throw new Error("Invalid backup file structure.");
      }
      
      if (confirm("Loading this backup will overwrite your current workspace. Are you sure?")) {
        document.getElementById('exp-num-field').innerHTML = importedData.exp_num || "";
        
        const expDateField = document.getElementById('exp-date-field');
        if (expDateField) {
          expDateField.innerHTML = importedData.exp_date || "";
        }
        
        const startNumInput = document.getElementById('start-num-input');
        if (startNumInput) {
          startNumInput.value = importedData.start_num !== undefined ? importedData.start_num : "1";
        }
        
        sectionsContainer.innerHTML = migrateAndSanitizeHTML(importedData.sections_markup);
        
        const isRuled = importedData.ruled_state === true;
        ruledToggle.checked = isRuled;
        toggleRuledClass(isRuled);

        const fontChoice = importedData.font_choice || 'font-times';
        applyFontClass(fontChoice);

        const marginChoice = importedData.margin_choice || 'margin-standard';
        applyMarginClass(marginChoice);
        
        updateSectionNumbers();
        updateImageNumbers();
        bindAllEvents();
        saveAllData();
        
        alert("Backup loaded successfully!");
      }
    } catch (err) {
      alert("Error loading backup: " + err.message);
    }
    fileInputHidden.value = "";
  };
  reader.readAsText(file);
});

// Clear Button Handler
clearBtn.addEventListener('click', function() {
  if (confirm('Are you sure you want to clear the entire record? This deletes all text inputs, custom rows/columns, and screenshots.')) {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    window.location.reload();
  }
});

// Sidebar toggle and overlay dismissal handlers
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebar = document.querySelector('.sidebar');

sidebarToggleBtn.addEventListener('click', function(e) {
  sidebar.classList.toggle('active');
  e.stopPropagation();
});

// Close sidebar drawer when clicking outside it on narrow viewports
document.addEventListener('click', function(e) {
  if (window.innerWidth < 1200) {
    if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== sidebarToggleBtn && !sidebarToggleBtn.contains(e.target)) {
      sidebar.classList.remove('active');
    }
  }
});

// Prevent Enter key in single-line contenteditables (titles, headers, captions)
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const activeEl = document.activeElement;
    if (activeEl && (
      activeEl.classList.contains('section-title-text') || 
      activeEl.classList.contains('editable-th') || 
      activeEl.id === 'exp-num-field' ||
      activeEl.id === 'exp-date-field' ||
      activeEl.classList.contains('editable-exp-num') ||
      activeEl.classList.contains('table-caption') ||
      activeEl.classList.contains('img-caption')
    )) {
      e.preventDefault();
    }
  }
});

// Bind Starting Section Number listener
const startNumInput = document.getElementById('start-num-input');
if (startNumInput) {
  startNumInput.addEventListener('input', function() {
    saveHistoryState();
    updateSectionNumbers();
    saveAllData();
  });
}

// Bind sidebar Undo/Redo button clicks
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
if (undoBtn && redoBtn) {
  undoBtn.onclick = undo;
  redoBtn.onclick = redo;
}

// Keyboard Shortcuts listener (Ctrl+Z and Ctrl+Y)
document.addEventListener('keydown', function(e) {
  if (isMathRendered) return;

  // Ctrl + Z (Undo / Redo if Shift pressed)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    if (e.shiftKey) {
      e.preventDefault();
      redo();
    } else {
      e.preventDefault();
      undo();
    }
  }
  
  // Ctrl + Y (Redo)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
  }
});

// Initialize application data
loadAllData();
