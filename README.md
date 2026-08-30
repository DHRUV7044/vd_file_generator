# VLSI Design Lab Sheet & Report Generator

A web application designed for engineering students to write, format, preview, and generate structured VLSI Design laboratory records and reports.

## Features
- **Visual Document Editor**: Custom UI for drafting aims, apparatus, logic gates circuits descriptions, and observations.
- **LaTeX Math Support**: Integrates **MathJax** to write, render, and preview complex math equations and equations (e.g., $V_{DD}$, $t_{pHL}$, $NM_L$).
- **Tabular Observation Grids**: Interactive tables for entering parameters or observations. Allows adding/deleting rows and columns on the fly.
- **Image Dropzones**: Drag-and-drop file interface that encodes circuit schematics and waveforms to base64 strings, saving them inline.
- **Style Customization**: Options to set serif/sans-serif fonts (Times, Arial, Georgia), standard/narrow margins, and toggle a ruled background layout.
- **LocalStorage Auto-Caching**: Automatically saves draft data in the browser cache, preventing loss of report drafts.
- **Print Optimization**: Premium print stylesheet (`style.css`) formatting the final web document into standard A4 lab sheets.

## Tech Stack
- Frontend: HTML5, CSS3, Vanilla JS
- Math Rendering: MathJax Engine\n