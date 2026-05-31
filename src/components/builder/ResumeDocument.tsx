1. FILE TO EDIT
================
src/components/builder/ResumeDocument.tsx


2. FIX BASE STYLES
==================

Find:

const base = {

Replace:

width: "8.5in",
minHeight: "11in",

With:

width: "210mm",
minHeight: "297mm",
height: "auto",
overflowWrap: "anywhere",
wordBreak: "break-word",


3. FIX CONTACT ROW CROPPING
===========================

Find entire ContactRow() function and replace ONLY this section:

OLD:

whiteSpace: "nowrap"

overflow: "hidden",
textOverflow: "ellipsis",
whiteSpace: "nowrap",

NEW:

whiteSpace: "normal",
overflowWrap: "anywhere",
wordBreak: "break-word",

AND replace:

{it.text}

WITH:

{insertSoftBreaks(it.text)}


4. GLOBAL FIND & REPLACE
========================

Find ALL:

whiteSpace: "nowrap"

Replace with:

whiteSpace: "normal"


5. FIX FLEX CROPPING
====================

Find ALL:

display: "flex",
justifyContent: "space-between",

Replace with:

display: "flex",
justifyContent: "space-between",
flexWrap: "wrap",
minWidth: 0,


6. ADD GLOBAL CSS
=================

FILE:
src/styles.css

Add at bottom:

.resume-document,
.resume-document * {
  box-sizing: border-box;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.resume-document {
  width: 210mm !important;
  min-height: 297mm !important;
  height: auto !important;
  overflow: visible !important;
  background: white;
}

.resume-document ul,
.resume-document li,
.resume-document p,
.resume-document span,
.resume-document div {
  overflow: visible !important;
  text-overflow: unset !important;
  white-space: normal !important;
}

.resume-entry-header,
.resume-document .flex {
  min-width: 0;
  flex-wrap: wrap;
}

@media print {
  .resume-document {
    width: 210mm !important;
    min-height: 297mm !important;
    overflow: visible !important;
  }

  body {
    margin: 0;
    padding: 0;
  }
}


7. IMPORTANT
============

REMOVE ALL:

overflow: "hidden"
textOverflow: "ellipsis"

from resume preview components.


8. AFTER FIX
=============

Restart preview:

npm run dev

OR refresh Lovable preview.

This fixes:
- text cropping
- PDF cutoff
- long email clipping
- URL clipping
- download mismatch
- flex overflow
- preview overflow