/** Browser-side PDF checks run before upload. The server re-validates everything. */

export function readFileWithProgress(file: File, onProgress: (fraction: number) => void): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error('Could not read the file.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsArrayBuffer(file);
  });
}

/** True if the bytes start with the PDF magic number "%PDF-". */
export function hasPdfHeader(buf: ArrayBuffer): boolean {
  return new TextDecoder('latin1').decode(buf.slice(0, 5)) === '%PDF-';
}

/**
 * Approximate page count: counts "/Type /Page" objects (not "/Pages").
 * Misses pages inside compressed object streams, so treat it as a hint for the
 * live quote; the server's count is authoritative.
 */
export function countPdfPages(buf: ArrayBuffer): number | null {
  const text = new TextDecoder('latin1').decode(buf);
  const matches = text.match(/\/Type\s*\/Page(?![a-z])/g);
  return matches ? matches.length : null;
}

/** Tiny valid-looking PDFs for demos and tests. */
export function makeSamplePdf(name: string, pages: number): File {
  let body = '%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n';
  body += `2 0 obj << /Type /Pages /Count ${pages} >> endobj\n`;
  for (let i = 0; i < pages; i++) {
    body += `${i + 3} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj\n`;
  }
  body += `% ${'ServeNow sample '.repeat(4000)}\n%%EOF\n`;
  return new File([body], name, { type: 'application/pdf' });
}
