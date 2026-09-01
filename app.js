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

  // 6. Clean up old gallery layout bars and upgrade image containers for corner-resize & drag-and-drop
  const oldControls = tempDiv.querySelectorAll('.gallery-controls-bar, .image-toolbar');
  oldControls.forEach(el => el.remove());

  const imgContainers = tempDiv.querySelectorAll('.image-container');
  imgContainers.forEach(container => {
    let handle = container.querySelector('.resize-handle-se');
    if (!handle) {
      handle = document.createElement('div');
      handle.className = 'resize-handle-se';
      handle.title = 'Drag to resize image width';
      container.appendChild(handle);
    }
    let del = container.querySelector('.delete-image-btn');
    if (!del) {
      del = document.createElement('button');
      del.className = 'delete-image-btn';
      del.title = 'Delete Image';
      del.innerHTML = '&times;';
      container.insertBefore(del, container.firstChild);
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

  const deleteBtn = document.createElement('button');
  deleteBtn.innerHTML = '&times;';
  deleteBtn.className = 'delete-image-btn';
  deleteBtn.title = 'Delete Image';

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

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'resize-handle-se';
  resizeHandle.title = 'Drag to resize image width';

  imgContainer.appendChild(deleteBtn);
  imgContainer.appendChild(titleWrapper);
  imgContainer.appendChild(img);
  imgContainer.appendChild(resizeHandle);
  galleryElement.appendChild(imgContainer);

  bindImageContainerEvents(imgContainer);
  updateImageNumbers();
  saveAllData();
}

function bindImageContainerEvents(container) {
  makeImageResizable(container);
  makeImageDraggable(container);

  const deleteBtn = container.querySelector('.delete-image-btn');
  if (deleteBtn) {
    deleteBtn.onclick = function() {
      if (isMathRendered) return;
      saveHistoryState();
      container.remove();
      updateImageNumbers();
      saveAllData();
    };
  }
}

// MS Word-style Corner Drag-to-Resize Handler
function makeImageResizable(container) {
  const handle = container.querySelector('.resize-handle-se');
  if (!handle) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  let galleryWidth = 0;

  handle.onmousedown = function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (isMathRendered) return;

    isResizing = true;
    startX = e.clientX;
    startWidth = container.offsetWidth;
    const gallery = container.parentElement;
    galleryWidth = gallery ? gallery.offsetWidth : 600;

    saveHistoryState();
    document.body.style.cursor = 'se-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  function onMouseMove(e) {
    if (!isResizing) return;
    const dx = e.clientX - startX;
    let newWidthPx = startWidth + dx;
    
    const minWidthPx = 120;
    if (newWidthPx < minWidthPx) newWidthPx = minWidthPx;
    if (newWidthPx > galleryWidth) newWidthPx = galleryWidth;

    const widthPercent = Math.round((newWidthPx / galleryWidth) * 100);
    container.style.width = widthPercent + '%';
  }

  function onMouseUp(e) {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    saveAllData();
  }
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
    const offset = e.clientY - bounding.top - (bounding.height / 2);

    if (offset < 0) {
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
      <div class="writing-space images-space" id="${dropzoneId}" tabindex="0" placeholder="[Paste image (Ctrl+V) or Drag & Drop screenshot here.]">
        <div class="image-gallery" id="${galleryId}"></div>
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
