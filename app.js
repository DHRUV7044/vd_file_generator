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
  localStorage.setItem(STORAGE_PREFIX + 'sections_markup', sectionsContainer.innerHTML);
  localStorage.setItem(STORAGE_PREFIX + 'ruled_state', ruledToggle.checked);
  localStorage.setItem(STORAGE_PREFIX + 'font_choice', fontSelect.value);
  localStorage.setItem(STORAGE_PREFIX + 'margin_choice', marginSelect.value);
}

// Load Data Function (Restores full serialized markup)
function loadAllData() {
  const expNum = localStorage.getItem(STORAGE_PREFIX + 'exp_num');
  if (expNum !== null) document.getElementById('exp-num-field').innerHTML = expNum;

  const savedSections = localStorage.getItem(STORAGE_PREFIX + 'sections_markup');
  if (savedSections !== null) {
    sectionsContainer.innerHTML = savedSections;
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
}

// Update Section numbers sequentially (e.g. 1. AIM, 2. TOOL, etc.)
function updateSectionNumbers() {
  const titles = sectionsContainer.querySelectorAll('.report-section');
  titles.forEach((sec, idx) => {
    const numSpan = sec.querySelector('.section-number');
    if (numSpan) {
      numSpan.textContent = `${idx + 1}. `;
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
  const table = thElement.closest('table');
  const theadRow = table.querySelector('thead tr');
  const index = Array.from(theadRow.children).indexOf(thElement);

  if (index === -1) return;

  thElement.remove();

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

  const deleteBtn = document.createElement('button');
  deleteBtn.innerHTML = '&times;';
  deleteBtn.className = 'delete-image-btn';
  deleteBtn.title = 'Delete Image';
  deleteBtn.onclick = function() {
    imgContainer.remove();
    updateImageNumbers();
    saveAllData();
  };

  imgContainer.appendChild(titleWrapper);
  imgContainer.appendChild(img);
  imgContainer.appendChild(deleteBtn);
  galleryElement.appendChild(imgContainer);

  updateImageNumbers();
  saveAllData();
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

  // Re-bind image deletion overlays
  document.querySelectorAll('.delete-image-btn').forEach(btn => {
    btn.onclick = function() {
      btn.parentElement.remove();
      updateImageNumbers();
      saveAllData();
    };
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

// Custom Parser converting Markdown styles and protecting LaTeX segments
function parseRichText(text) {
  let mathBlocks = [];
  let blockCount = 0;
  
  // 1. Extract block math $$ ... $$
  let tempText = text.replace(/\$\$([\s\S]*?)\$\$/g, function(match, formula) {
    const placeholder = `<!--MATHBLOCK_${blockCount}-->`;
    mathBlocks.push({ placeholder, formula: `$$${formula}$$` });
    blockCount++;
    return placeholder;
  });
  
  // 2. Extract inline math $ ... $
  tempText = tempText.replace(/\$([\s\S]*?)\$/g, function(match, formula) {
    const placeholder = `<!--MATHBLOCK_${blockCount}-->`;
    mathBlocks.push({ placeholder, formula: `$${formula}$` });
    blockCount++;
    return placeholder;
  });
  
  // 3. Escape HTML to prevent injection and compile Markdown syntax
  let html = tempText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
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
    '.writing-space:not(.images-space), #exp-num-field, .editable-th, .lab-table td[contenteditable="true"], .section-title-text, .table-caption, .img-caption'
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
}

// Toggle Math Preview Listener
mathToggle.addEventListener('change', function(e) {
  if (e.target.checked) {
    renderMathOnPage();
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
  const body = btn.closest('.report-section').querySelector('.section-body');
  const temp = document.createElement('div');
  temp.innerHTML = createSubTableBlockHTML();
  body.appendChild(temp.firstElementChild);
  bindAllEvents();
  saveAllData();
}

function addImageSpaceToSectionBody(btn) {
  if (isMathRendered) return;
  const body = btn.closest('.report-section').querySelector('.section-body');
  const temp = document.createElement('div');
  temp.innerHTML = createSubImagesBlockHTML();
  body.appendChild(temp.firstElementChild);
  bindAllEvents();
  saveAllData();
}

function addTextBlockToSectionBody(btn) {
  if (isMathRendered) return;
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
  
  const backupData = {
    version: "1.2",
    exp_num: document.getElementById('exp-num-field').innerHTML,
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
        sectionsContainer.innerHTML = importedData.sections_markup;
        
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
      activeEl.classList.contains('editable-exp-num') ||
      activeEl.classList.contains('table-caption') ||
      activeEl.classList.contains('img-caption')
    )) {
      e.preventDefault();
    }
  }
});

// Initialize application data
loadAllData();
