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

  const asString = (value: unknown): string => {
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
    return text ? [text] : [];
  };

  const metaRow = (label: string, value: unknown, keyPrefix: string) => (
    <View key={keyPrefix} style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{asString(value) || "—"}</Text>
    </View>
  );

  const section = (label: string, value: unknown, keyPrefix: string) => (
    <View key={keyPrefix} style={styles.section}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <Text style={styles.sectionBody}>{asString(value) || "—"}</Text>
    </View>
  );

  const renderBulletList = (items: string[]) => {
    if (!items.length) {
      return <Text style={[styles.sectionBody, styles.muted]}>—</Text>;
    }

    return (
      <View style={styles.list}>
        {items.map((item, index) => (
          <View key={`item-${index}`} style={styles.listRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  };

  const listSection = (label: string, value: unknown, keyPrefix: string) => (
    <View key={keyPrefix} style={styles.section}>
      <Text style={styles.sectionTitle}>{label}</Text>
      {renderBulletList(asStringArray(value))}
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoSrc ? <Image style={styles.logo} src={logoSrc} /> : null}
          <Text style={styles.title}>LUMA Report</Text>
        </View>
        <View style={styles.metaGrid}>
          {metaRow("Report ID", (fields as any).ReportID ?? report.id, "meta-reportid")}
          {metaRow("Candidate Email", (fields as any).CandidateEmail, "meta-email")}
          {metaRow("CEFR", (fields as any).CEFR_Level, "meta-cefr")}
          {metaRow("Accent", (fields as any).Accent, "meta-accent")}
          {metaRow("Exam Date", (fields as any).ExamDate, "meta-examdate")}
        </View>
        {listSection("Strengths", (fields as any).Strengths, "strengths")}
        {listSection("Weaknesses", (fields as any).Weaknesses, "weaknesses")}
        {listSection(
          "Recommendations",
          (fields as any).Recommendations,
          "recommendations",
        )}
        {section("Overall Comment", (fields as any).OverallComment, "overall")}
      </Page>
    </Document>
  );
}
