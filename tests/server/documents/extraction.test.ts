import { describe, expect, it } from "vitest";

import { DocumentExtractionError, extractDocumentText } from "@/server/documents/extraction";

// Minimal uncompressed ZIP fixture, avoiding a new archive dependency for tests.
function docxFixture(text: string): Buffer {
  const entries = [
    ["[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'],
    ["word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`],
  ];
  const localParts: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const [path, xml] of entries) {
    const name = Buffer.from(path);
    const data = Buffer.from(xml);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const index = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(index.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, index, end]);
}

function pdfFixture(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

describe("document extractors with real format fixtures", () => {
  it("normalizes TXT whitespace and UTF-8 content", async () => {
    await expect(extractDocumentText(Buffer.from("  Café\r\nsecond\t line "), "sample.txt"))
      .resolves.toBe("Café\nsecond line");
  });

  it("parses CSV quoting, BOM, and uneven rows", async () => {
    await expect(extractDocumentText(Buffer.from('\uFEFFname,value\n"a,b",1\nlast\n,,\n'), "sample.csv"))
      .resolves.toBe("name | value\na,b | 1\nlast");
  });

  it("extracts actual DOCX XML from its ZIP container", async () => {
    await expect(extractDocumentText(docxFixture("Sample document"), "sample.docx"))
      .resolves.toBe("Sample document");
  });

  it("extracts PDF text with page provenance", async () => {
    await expect(extractDocumentText(pdfFixture("Sample document"), "sample.pdf"))
      .resolves.toBe("[Page 1]\nSample document");
  });

  it.each([
    ["empty.txt", Buffer.from(" \t\r\n")],
    ["empty.csv", Buffer.from(",,\n")],
    ["empty.docx", docxFixture("")],
    ["empty.pdf", pdfFixture("")],
    ["punctuation.pdf", pdfFixture("...")],
    ["malformed.txt", Buffer.from([0xff])],
    ["malformed.csv", Buffer.from('"unterminated')],
    ["malformed.docx", Buffer.from("not a zip")],
    ["malformed.pdf", Buffer.from("not a PDF")],
    ["unsupported.doc", Buffer.from("legacy")],
  ])("rejects %s with a safe extraction error", async (filename, content) => {
    await expect(extractDocumentText(content, filename)).rejects.toBeInstanceOf(DocumentExtractionError);
    await expect(extractDocumentText(content, filename)).rejects.toThrow("The file could not be read or has no usable text.");
  });
});
