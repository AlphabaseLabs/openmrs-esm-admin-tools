export interface ReportFile {
  filename: string;
  fileContent: string;
}

function decodeReport(file: ReportFile) {
  const decoded = window.atob(file.fileContent);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function downloadReportFile(file: ReportFile) {
  const url = URL.createObjectURL(new Blob([decodeReport(file)]));
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Allow the browser to start the download before releasing its URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

export async function printReportFile(
  load: () => Promise<ReportFile>,
  messages: { loading: string; popupBlocked: string; invalidPdf: string },
  onManualPrint: () => void,
) {
  // Open during the click, before awaiting the authenticated download, to avoid popup blocking.
  const preview = window.open('', '_blank');
  if (!preview) {
    throw new Error(messages.popupBlocked);
  }
  let url: string | undefined;
  try {
    preview.opener = null;
    preview.document.title = messages.loading;
    preview.document.body.textContent = messages.loading;
    const file = await load();
    if (preview.closed) return;
    const bytes = decodeReport(file);
    if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') {
      throw new Error(messages.invalidPdf);
    }
    url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    preview.addEventListener('pagehide', () => URL.revokeObjectURL(url), { once: true });
    preview.document.title = file.filename;
    const frame = preview.document.createElement('iframe');
    frame.title = file.filename;
    frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
    frame.addEventListener(
      'load',
      () => {
        if (preview.closed) return;
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        } catch {
          // Some browsers restrict PDF scripting; their PDF toolbar remains available for printing.
          onManualPrint();
        }
      },
      { once: true },
    );
    frame.src = url;
    preview.document.body.replaceChildren(frame);
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    preview.close();
    throw error;
  }
}
