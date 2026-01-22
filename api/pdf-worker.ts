import type { VercelRequest, VercelResponse } from "@vercel/node";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

import { buildReportPdfDocument } from "../src/lib/pdf/build-report-pdf";

export const config = {
  api: {
    bodyParser: { sizeLimit: "2mb" },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const payload = req.body as {
      reportId: string;
      logoSrc?: string;
      report: {
        id: string;
        createdTime?: string;
        fields: Record<string, unknown>;
      };
    };

    const doc = buildReportPdfDocument(payload);
    const buf = await renderToBuffer(doc);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="report-${payload.reportId}.pdf"`,
    );

    return res.status(200).send(Buffer.from(buf));
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e),
      stack: String(e?.stack || ""),
    });
  }
}
