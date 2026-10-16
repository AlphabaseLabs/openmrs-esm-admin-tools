import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { downloadReportFile, printReportFile } from './report-files';

const messages = { loading: 'Preparing report', popupBlocked: 'Pop-up blocked', invalidPdf: 'Not a PDF' };
const pdf = { filename: 'dr-danial-ahmed-shares-report-2026-10-01-to-2026-10-31.pdf', fileContent: '' };

describe('report files', () => {
  let preview: Window;
  const createObjectURL = vi.fn((_blob: Blob) => 'blob:report');
  const revokeObjectURL = vi.fn();

  beforeAll(async () => {
    const document = await PDFDocument.create();
    document.setTitle('Original report title');
    document.setAuthor('Clinic');
    document.addPage([400, 600]).drawText('Saved report content');
    pdf.fileContent = await document.saveAsBase64();
  });

  beforeEach(() => {
    preview = Object.assign(new EventTarget(), {
      document: document.implementation.createHTMLDocument(),
      closed: false,
      close: vi.fn(),
      opener: window,
    }) as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(preview);
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('downloads using the returned filename and releases the temporary URL afterward', () => {
    vi.useFakeTimers();
    let filename: string;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      filename = this.download;
    });
    downloadReportFile(pdf);
    expect(filename).toBe(pdf.filename);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report');
  });

  it('reports blocked pop-ups without downloading a file', async () => {
    vi.mocked(window.open).mockReturnValue(null);
    const load = vi.fn();
    await expect(printReportFile(load, messages, vi.fn())).rejects.toThrow(messages.popupBlocked);
    expect(load).not.toHaveBeenCalled();
  });

  it('opens immediately, prints the saved PDF after loading, and cleans up on tab close', async () => {
    let resolve: (value: typeof pdf) => void;
    const file = new Promise<typeof pdf>((done) => {
      resolve = done;
    });
    const result = printReportFile(() => file, messages, vi.fn());
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    // eslint-disable-next-line jest-dom/prefer-to-have-text-content -- The detached popup document has no defaultView for jest-dom's node matcher.
    expect(preview.document.body.textContent).toBe(messages.loading);
    expect(preview.opener).toBeNull();
    resolve(pdf);
    await result;
    const frame = preview.document.querySelector('iframe');
    const print = vi.fn();
    Object.defineProperty(frame, 'contentWindow', { value: { focus: vi.fn(), print } });
    frame.dispatchEvent(new Event('load'));
    expect(print).toHaveBeenCalledOnce();
    expect(createObjectURL.mock.calls[0][0].type).toBe('application/pdf');
    const blob = createObjectURL.mock.calls[0][0];
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    const printedDocument = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(printedDocument.getTitle()).toBe(pdf.filename);
    expect(printedDocument.getAuthor()).toBe('Clinic');
    expect(printedDocument.getPages()).toHaveLength(1);
    expect(printedDocument.getPage(0).getSize()).toEqual({ width: 400, height: 600 });
    expect((await PDFDocument.load(pdf.fileContent)).getTitle()).toBe('Original report title');
    expect(preview.document.title).toBe(pdf.filename);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    preview.dispatchEvent(new Event('pagehide'));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report');
  });

  it('closes the blank tab when the authenticated download fails', async () => {
    await expect(printReportFile(() => Promise.reject(new Error('Forbidden')), messages, vi.fn())).rejects.toThrow(
      'Forbidden',
    );
    expect(preview.close).toHaveBeenCalledOnce();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('rejects a non-PDF response even when the requested format was PDF', async () => {
    await expect(
      printReportFile(async () => ({ filename: 'report.csv', fileContent: btoa('a,b') }), messages, vi.fn()),
    ).rejects.toThrow(messages.invalidPdf);
    expect(preview.close).toHaveBeenCalledOnce();
  });

  it('closes the popup if the PDF cannot be parsed instead of printing a UUID-named file', async () => {
    await expect(
      printReportFile(async () => ({ ...pdf, fileContent: btoa('%PDF-1.4\ninvalid') }), messages, vi.fn()),
    ).rejects.toThrow();
    expect(preview.close).toHaveBeenCalledOnce();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('does not create a file URL if the user closes the tab before the response arrives', async () => {
    Object.defineProperty(preview, 'closed', { value: true });
    await printReportFile(async () => pdf, messages, vi.fn());
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('keeps the PDF open for manual printing when PDF scripting is restricted', async () => {
    const manualPrint = vi.fn();
    await printReportFile(async () => pdf, messages, manualPrint);
    const frame = preview.document.querySelector('iframe');
    Object.defineProperty(frame, 'contentWindow', {
      get: () => {
        throw new Error('Cross-origin PDF viewer');
      },
    });
    frame.dispatchEvent(new Event('load'));
    expect(manualPrint).toHaveBeenCalledOnce();
    expect(preview.close).not.toHaveBeenCalled();
  });
});
