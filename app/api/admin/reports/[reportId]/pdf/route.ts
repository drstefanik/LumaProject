import { put } from "@vercel/blob";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

import {
  getFirstReportByFormula,
  getReportByRecordId,
  updateReportByRecordId,
} from "@/src/lib/admin/airtable-admin";
import { normalizeReportId } from "@/src/lib/admin/report-id";
import { getAdminFromRequest } from "@/src/lib/admin/session";

type ReportRecord = { id: string; fields: Record<string, unknown> };

// React-PDF primitives (string match funziona anche in prod)
const ALLOWED_PRIMITIVES = new Set([
  "DOCUMENT",
  "PAGE",
  "VIEW",
  "TEXT",
  "IMAGE",
  "LINK",
]);

function typeLabel(t: any) {
  if (typeof t === "string") return t;
  if (typeof t === "function") return t.displayName || t.name || "(anonymous fn)";
  if (t && typeof t === "object") return String(t);
  return String(t);
}

function getTypeName(typeValue: React.ElementType) {
  if (typeof typeValue === "string") return typeValue;
  return typeValue.displayName || typeValue.name || "";
}

function isReactPdfPrimitive(el: any) {
  if (!React.isValidElement(el)) return false;
  // in react-pdf il type spesso è una function con displayName "Text"/"View"/...
  const name = getTypeName(el.type).toUpperCase();
  return ALLOWED_PRIMITIVES.has(name);
}

// valida:
// - Text children: solo string/number o altri <Text> (nesting ok), NON <View>/<Image>/<Component>
// - tipi di nodo: solo primitives react-pdf (se trovi component custom o HTML -> segnala)
function validatePdfNode(node: any, path: string[] = []) {
  if (node == null || typeof node === "boolean") return;

  // string/number OK come leaf
  if (typeof node === "string" || typeof node === "number") return;

  // array: valida tutti
  if (Array.isArray(node)) {
    node.forEach((n, i) => validatePdfNode(n, path.concat(`[${i}]`)));
    return;
  }

  // React element: valida type + children
  if (React.isValidElement(node)) {
    const tName = getTypeName(node.type).toUpperCase();

    // se NON è primitive react-pdf -> colpevole quasi certo
    if (!isReactPdfPrimitive(node)) {
      throw new Error(
        `[pdf] INVALID NODE TYPE at ${path.join(" > ")}: ${typeLabel(node.type)} (not react-pdf primitive)`,
      );
    }

    // regola dura: dentro TEXT non voglio elementi non-text
    if (tName === "TEXT") {
      const ch: any = (node.props as any)?.children;

      const checkTextChild = (c: any, cpath: string[]) => {
        if (c == null || typeof c === "boolean") return;
        if (typeof c === "string" || typeof c === "number") return;
        if (Array.isArray(c)) return c.forEach((x, i) => checkTextChild(x, cpath.concat(`[${i}]`)));
        if (React.isValidElement(c)) {
          const cn = getTypeName(c.type).toUpperCase();
          if (cn !== "TEXT") {
            throw new Error(
              `[pdf] INVALID CHILD INSIDE <Text> at ${cpath.join(" > ")}: ${typeLabel(c.type)}`,
            );
          }
          return validatePdfNode(c, cpath);
        }
        // oggetti (Airtable attachments/objects) finiscono qui
        throw new Error(
          `[pdf] INVALID RAW CHILD INSIDE <Text> at ${cpath.join(" > ")}: ${Object.prototype.toString.call(c)}`,
        );
      };

      checkTextChild(ch, path.concat("TEXT.children"));
    }

    // valida children in generale
    const children = (node.props as any)?.children;
    validatePdfNode(children, path.concat(typeLabel(node.type)));
    return;
  }

  // qualunque oggetto “raw” -> colpevole (es: attachment Airtable)
  throw new Error(
    `[pdf] INVALID RAW NODE at ${path.join(" > ")}: ${Object.prototype.toString.call(node)}`,
  );
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="16" fill="#0f172a" />
  <text x="50%" y="54%" text-anchor="middle" font-size="32" fill="#ffffff" font-family="Helvetica">L</text>
</svg>`;
const LOGO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`;

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 12,
    color: "#0f172a",
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: 36,
    height: 36,
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  metaGrid: {
    marginBottom: 18,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    color: "#475569",
  },
  metaValue: {
    fontSize: 12,
    color: "#0f172a",
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    color: "#475569",
    marginBottom: 4,
  },
  sectionBody: {
    fontSize: 12,
    color: "#0f172a",
  },
  list: {
    marginTop: 2,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  bullet: {
    width: 12,
    fontSize: 12,
    color: "#0f172a",
  },
  listText: {
    flex: 1,
    fontSize: 12,
    color: "#0f172a",
  },
  muted: {
    color: "#94a3b8",
  },
});

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function asStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (item == null ? [] : [asString(item)]))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const text = asString(value).trim();
  return text ? [text] : [];
}

function assertNotReactElement(label: string, value: unknown) {
  if (React.isValidElement(value)) {
    throw new Error(`[pdf] INVALID React element in "${label}"`);
  }
}

async function loadPublicImageDataUri(relPath: string) {
  const abs = path.join(process.cwd(), "public", relPath);
  const buf = await fs.readFile(abs);
  const b64 = buf.toString("base64");
  const ext = relPath.split(".").pop()?.toLowerCase();
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : "application/octet-stream";
  return `data:${mime};base64,${b64}`;
}

function buildReportDocument(report: ReportRecord, logoSrc: string) {
  const fields = report.fields;

  const metaRow = (label: string, value: unknown, keyPrefix: string) =>
    React.createElement(
      View,
      { key: keyPrefix, style: styles.metaRow },
      React.createElement(Text, { style: styles.metaLabel }, label),
      React.createElement(Text, { style: styles.metaValue }, asString(value) || "—"),
    );

  const section = (label: string, value: unknown, keyPrefix: string) =>
    React.createElement(
      View,
      { key: keyPrefix, style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, label),
      React.createElement(Text, { style: styles.sectionBody }, asString(value) || "—"),
    );

  const BulletList = ({ items }: { items: string[] }) => {
    if (!items.length) {
      return React.createElement(
        Text,
        { style: [styles.sectionBody, styles.muted] },
        "—",
      );
    }

    return React.createElement(
      View,
      { style: styles.list },
      items.map((item, index) =>
        React.createElement(
          View,
          { key: `item-${index}`, style: styles.listRow },
          React.createElement(Text, { style: styles.bullet }, "•"),
          React.createElement(Text, { style: styles.listText }, item),
        ),
      ),
    );
  };

  const listSection = (label: string, value: unknown, keyPrefix: string) =>
    React.createElement(
      View,
      { key: keyPrefix, style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, label),
      React.createElement(BulletList, { items: asStringArray(value) }),
    );

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Image, { style: styles.logo, src: logoSrc }),
        React.createElement(Text, { style: styles.title }, "LUMA Report"),
      ),
      React.createElement(
        View,
        { style: styles.metaGrid },
        metaRow("Report ID", (fields as any).ReportID ?? report.id, "meta-reportid"),
        metaRow("Candidate Email", (fields as any).CandidateEmail, "meta-email"),
        metaRow("CEFR", (fields as any).CEFR_Level, "meta-cefr"),
        metaRow("Accent", (fields as any).Accent, "meta-accent"),
        metaRow("Exam Date", (fields as any).ExamDate, "meta-examdate"),
      ),
      listSection("Strengths", (fields as any).Strengths, "strengths"),
      listSection("Weaknesses", (fields as any).Weaknesses, "weaknesses"),
      listSection(
        "Recommendations",
        (fields as any).Recommendations,
        "recommendations",
      ),
      section("Overall Comment", (fields as any).OverallComment, "overall"),
    ),
  );
}

async function generateReportPdf(report: ReportRecord, logoSrc: string) {
  const fields = report.fields as Record<string, unknown>;

  assertNotReactElement("ReportID", fields.ReportID);
  assertNotReactElement("CandidateEmail", fields.CandidateEmail);
  assertNotReactElement("CEFR_Level", fields.CEFR_Level);
  assertNotReactElement("Accent", fields.Accent);
  assertNotReactElement("ExamDate", fields.ExamDate);
  assertNotReactElement("Strengths", fields.Strengths);
  assertNotReactElement("Weaknesses", fields.Weaknesses);
  assertNotReactElement("Recommendations", fields.Recommendations);
  assertNotReactElement("OverallComment", fields.OverallComment);

  const document = buildReportDocument(report, logoSrc);
  console.log("[pdf] validating doc tree");
  validatePdfNode(document, ["doc"]);
  console.log("[pdf] renderToBuffer start");
  const pdfBuffer = await renderToBuffer(document);
  return Buffer.from(pdfBuffer);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const session = await getAdminFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { reportId } = await params;
  let report: ReportRecord | null = null;

  try {
    console.log("[pdf] start", { reportId });

    const decoded = normalizeReportId(reportId);
    const normalized = decoded.trim();
    const isReportCode = normalized.startsWith("REP-");

    const tableName =
      process.env.LUMA_REPORTS_TABLE || process.env.AIRTABLE_TABLE_REPORTS;

    if (!tableName) {
      throw new Error("LUMA_REPORTS_TABLE is missing.");
    }

    if (isReportCode) {
      const sanitized = normalized.replace(/"/g, "\\\"");
      report = await getFirstReportByFormula(
        tableName,
        `{ReportID} = "${sanitized}"`,
      );
    } else {
      report = await getReportByRecordId(tableName, normalized);
    }

    console.log("[pdf] fetched report");

    if (!report) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const logoSrc =
      (process.env.LUMA_PDF_LOGO_URL || "").trim() ||
      (await loadPublicImageDataUri("luma-logo.png").catch(() => LOGO_DATA_URI));

    console.log("[pdf] building doc");
    console.log("[pdf] renderToBuffer start");

    const pdfBytes = await generateReportPdf(report, logoSrc);

    console.log("[pdf] renderToBuffer ok", { bytes: pdfBytes?.length });

    const reportKey =
      typeof (report.fields as any).ReportID === "string" &&
      (report.fields as any).ReportID.trim()
        ? (report.fields as any).ReportID.trim()
        : report.id;

    // If blob not configured, return inline PDF
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return new NextResponse(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="report-${reportKey}.pdf"`,
        },
      });
    }

    const filename = `reports/${reportKey}.pdf`;
    let blobUrl: string | null = null;

    try {
      console.log("[pdf] blob upload start");
      const blob = await put(filename, pdfBytes, {
        access: "public",
        contentType: "application/pdf",
      });
      blobUrl = blob.url;
      console.log("[pdf] blob upload ok", { url: blob.url });
    } catch (blobError) {
      console.error("[pdf] blob upload failed", {
        reportId,
        message: (blobError as any)?.message,
        name: (blobError as any)?.name,
        stack: (blobError as any)?.stack,
      });

      // fallback: still return inline PDF
      return new NextResponse(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="report-${reportKey}.pdf"`,
        },
      });
    }

    const pdfGeneratedAt = new Date().toISOString();
    let updated: ReportRecord | null = null;

    try {
      console.log("[pdf] airtable update start");
      updated = await updateReportByRecordId(tableName, report.id, {
        PDFUrl: blobUrl,
        PDFStatus: "final",
        PDFGeneratedAt: pdfGeneratedAt,
      });
      console.log("[pdf] airtable update ok");
    } catch (airtableError) {
      console.error("[pdf] airtable update failed", {
        reportId,
        message: (airtableError as any)?.message,
        name: (airtableError as any)?.name,
        stack: (airtableError as any)?.stack,
      });
      // continue; return blob url anyway
    }

    return NextResponse.json({
      ok: true,
      pdfUrl: blobUrl,
      pdfStatus: (updated?.fields as any)?.PDFStatus ?? "final",
      pdfGeneratedAt: (updated?.fields as any)?.PDFGeneratedAt ?? pdfGeneratedAt,
    });
  } catch (err: any) {
    console.error("[pdf] FAILED", {
      reportId,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
      cause: err?.cause,
    });
    return NextResponse.json(
      { ok: false, error: err?.message || "PDF generation failed" },
      { status: 500 },
    );
  }
}
