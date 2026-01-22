import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export function buildReportPdfDocument(payload: {
  reportId: string;
  logoSrc?: string;
  report: { id: string; createdTime?: string; fields: Record<string, unknown> };
}) {
  const { logoSrc, report } = payload;
  const fields = report.fields ?? {};

  const styles = StyleSheet.create({
    page: {
      paddingTop: 38,
      paddingBottom: 44,
      paddingHorizontal: 40,
      fontSize: 11,
      color: "#0B1220",
      fontFamily: "Helvetica",
      backgroundColor: "#FFFFFF",
    },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },
    logo: {
      width: 28,
      height: 28,
      marginRight: 10,
    },
    headerText: {
      flexDirection: "column",
      flexGrow: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: 700 as any,
      letterSpacing: -0.3,
    },
    subtitle: {
      marginTop: 3,
      fontSize: 10,
      color: "#52607A",
    },

    divider: {
      height: 1,
      backgroundColor: "#E6ECF5",
      marginVertical: 14,
    },

    // Section title
    sectionTitle: {
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: 1.2,
      color: "#52607A",
      marginBottom: 10,
    },

    // Cards
    card: {
      backgroundColor: "#F6F8FC",
      borderWidth: 1,
      borderColor: "#E3E8F2",
      borderRadius: 12,
      padding: 14,
    },
    cardTitle: {
      fontSize: 11,
      fontWeight: 700 as any,
      color: "#0B1220",
      marginBottom: 10,
    },

    // Summary grid (2 cols)
    row: {
      flexDirection: "row",
    },
    col: {
      flex: 1,
    },
    gap12: {
      marginRight: 12,
    },

    infoBlock: {
      // inside summary cards
    },
    label: {
      fontSize: 9,
      color: "#52607A",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    value: {
      fontSize: 11,
      color: "#0B1220",
      marginTop: 3,
    },
    valueMono: {
      fontSize: 11,
      color: "#0B1220",
      marginTop: 3,
      fontFamily: "Courier",
    },

    badge: {
      alignSelf: "flex-start",
      backgroundColor: "#E8F1FF",
      borderWidth: 1,
      borderColor: "#CFE3FF",
      color: "#0C3C4A",
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 10,
      fontSize: 10,
      fontWeight: 700 as any,
      marginTop: 6,
    },

    // 3-column cards row
    triColWrap: {
      flexDirection: "row",
    },
    triCol: {
      flex: 1,
    },
    triGap: {
      marginRight: 12,
    },

    // Bullets
    bullets: {
      marginTop: 2,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 6,
    },
    bullet: {
      width: 12,
      fontSize: 12,
      color: "#0B1220",
      lineHeight: 1,
    },
    bulletText: {
      flex: 1,
      fontSize: 11,
      color: "#0B1220",
      lineHeight: 1.35,
    },
    muted: {
      color: "#52607A",
    },

    // Comment
    commentText: {
      fontSize: 11,
      color: "#0B1220",
      lineHeight: 1.45,
    },

    // Footer
    footer: {
      position: "absolute",
      left: 40,
      right: 40,
      bottom: 18,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 9,
      color: "#52607A",
    },
  });

  const asString = (value: unknown): string => {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const asStringArray = (value: unknown): string[] => {
    if (value == null) return [];
    if (Array.isArray(value)) {
      return value
        .flatMap((item) => (item == null ? [] : [asString(item)]))
        .map((item) => item.trim())
        .filter(Boolean);
    }
    const text = asString(value).trim();
    // Support newline separated lists if they come as one string
    if (text.includes("\n")) {
      return text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return text ? [text] : [];
  };

  const safe = (v: unknown, fallback = "—") => {
    const s = asString(v).trim();
    return s ? s : fallback;
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return "";
    // Keep it simple and stable server-side (no locale dependency)
    // If iso is valid, show YYYY-MM-DD HH:mm
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    const mm = pad(d.getUTCMonth() + 1);
    const dd = pad(d.getUTCDate());
    const hh = pad(d.getUTCHours());
    const mi = pad(d.getUTCMinutes());
    return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
  };

  const InfoField = ({
    label,
    value,
    mono,
    right,
  }: {
    label: string;
    value: unknown;
    mono?: boolean;
    right?: boolean;
  }) => (
    <View style={[styles.infoBlock, right ? {} : {}]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={mono ? styles.valueMono : styles.value}>{safe(value)}</Text>
    </View>
  );

  const BulletList = ({ items }: { items: string[] }) => {
    if (!items.length) {
      return <Text style={[styles.bulletText, styles.muted]}>—</Text>;
    }
    return (
      <View style={styles.bullets}>
        {items.map((item, idx) => (
          <View key={`${idx}-${item.slice(0, 12)}`} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  };

  const reportId = (fields as any).ReportID ?? report.id;
  const candidateEmail = (fields as any).CandidateEmail;
  const cefr = (fields as any).CEFR_Level;
  const accent = (fields as any).Accent;
  const examDate = (fields as any).ExamDate;

  const strengths = asStringArray((fields as any).Strengths);
  const weaknesses = asStringArray((fields as any).Weaknesses);
  const recommendations = asStringArray((fields as any).Recommendations);
  const overallComment = safe((fields as any).OverallComment);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {logoSrc ? <Image style={styles.logo} src={logoSrc} /> : null}
          <View style={styles.headerText}>
            <Text style={styles.title}>LUMA Report</Text>
            <Text style={styles.subtitle}>Speaking assessment summary</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Candidate Summary */}
        <Text style={styles.sectionTitle}>Candidate summary</Text>

        <View style={styles.row}>
          <View style={[styles.col, styles.gap12]}>
            <View style={styles.card}>
              <InfoField label="Report ID" value={reportId} mono />
              <View style={{ height: 10 }} />
              <InfoField label="Candidate email" value={candidateEmail} />
              <View style={{ height: 10 }} />
              <InfoField label="Exam date" value={examDate} />
            </View>
          </View>

          <View style={styles.col}>
            <View style={styles.card}>
              <InfoField label="Created at" value={report.createdTime ? formatTimestamp(report.createdTime) : "—"} />
              <View style={{ height: 10 }} />
              <Text style={styles.label}>CEFR</Text>
              <Text style={styles.value}>{safe(cefr)}</Text>
              {/* Badge CEFR (nice visual) */}
              <Text style={styles.badge}>{safe(cefr)}</Text>
              <View style={{ height: 10 }} />
              <InfoField label="Accent" value={accent} />
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Performance Highlights */}
        <Text style={styles.sectionTitle}>Performance highlights</Text>

        <View style={styles.triColWrap}>
          <View style={[styles.triCol, styles.triGap]}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Strengths</Text>
              <BulletList items={strengths} />
            </View>
          </View>

          <View style={[styles.triCol, styles.triGap]}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weaknesses</Text>
              <BulletList items={weaknesses} />
            </View>
          </View>

          <View style={styles.triCol}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recommendations</Text>
              <BulletList items={recommendations} />
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Overall Comment */}
        <Text style={styles.sectionTitle}>Overall comment</Text>
        <View style={styles.card}>
          <Text style={styles.commentText}>{overallComment}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Report ID: {safe(reportId)}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
