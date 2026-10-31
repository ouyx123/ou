'use strict';
// Keep the workbench upload-only. Download links live inside the existing help dialog.
document.getElementById('helpDialog').insertBefore(
  document.getElementById('inputDownloads').content.cloneNode(true),
  document.getElementById('understoodButton')
);
