import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, TabStopType } from "docx";
import FileSaver from "file-saver";
const { saveAs } = FileSaver;
import type { ResumeData, SectionId } from "./types";

function hex(h: string) { return h.replace("#", "").toUpperCase(); }

function heading(text: string, color: string) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 1 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color, size: 22, characterSpacing: 30 })],
  });
}

function bullet(text: string) {
  return new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text, size: 21 })] });
}

function line(text: string, opts: { bold?: boolean; right?: string } = {}) {
  if (opts.right) {
    return new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
      children: [
        new TextRun({ text, bold: opts.bold, size: 21 }),
        new TextRun({ text: `\t${opts.right}`, size: 21, color: "555555" }),
      ],
    });
  }
  return new Paragraph({ children: [new TextRun({ text, bold: opts.bold, size: 21 })] });
}

function buildSections(data: ResumeData, color: string): Record<SectionId, Paragraph[]> {
  return {
    summary: data.summary ? [heading("Summary", color), new Paragraph({ children: [new TextRun({ text: data.summary, size: 21 })] })] : [],
    experience: data.experience.length
      ? [
          heading("Experience", color),
          ...data.experience.flatMap(e => [
            line(`${e.title || "Role"} · ${e.company}`, { bold: true, right: e.date }),
            ...e.bullets.split("\n").filter(Boolean).map(bullet),
            new Paragraph({ children: [new TextRun({ text: "", size: 10 })] }),
          ]),
        ]
      : [],
    education: data.education.length
      ? [heading("Education", color), ...data.education.map(ed => line(`${ed.degree} · ${ed.school}`, { right: ed.date }))]
      : [],
    skills: data.skills ? [heading("Skills", color), new Paragraph({ children: [new TextRun({ text: data.skills, size: 21 })] })] : [],
  };
}

export async function exportDocx(data: ResumeData) {
  const color = hex(data.accentHex);
  const sectionMap = buildSections(data, color);

  const header: Paragraph[] = [
    new Paragraph({
      alignment: data.template === "modern" ? AlignmentType.LEFT : AlignmentType.CENTER,
      children: [new TextRun({ text: data.name || "Your Name", bold: true, size: 52, color })],
    }),
    new Paragraph({
      alignment: data.template === "modern" ? AlignmentType.LEFT : AlignmentType.CENTER,
      children: [new TextRun({ text: data.headline, size: 24, color: "444444" })],
    }),
    new Paragraph({
      alignment: data.template === "modern" ? AlignmentType.LEFT : AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: [data.email, data.phone, data.location, data.links].filter(Boolean).join(" · "), size: 18, color: "555555" })],
    }),
  ];

  let body: Paragraph[] | Table[] = [];

  if (data.template === "two-column") {
    // Build two-column layout using a table
    const leftChildren: Paragraph[] = [
      new Paragraph({ children: [new TextRun({ text: data.name || "Your Name", bold: true, size: 36, color: "FFFFFF" })] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: data.headline, size: 20, color: "FFFFFF" })] }),
      new Paragraph({ children: [new TextRun({ text: "CONTACT", bold: true, size: 18, color: "FFFFFF", characterSpacing: 30 })] }),
      ...[data.email, data.phone, data.location, data.links].filter(Boolean).map(t =>
        new Paragraph({ children: [new TextRun({ text: t, size: 18, color: "FFFFFF" })] })
      ),
      new Paragraph({ children: [new TextRun({ text: "" })] }),
      ...(data.skills ? [
        new Paragraph({ children: [new TextRun({ text: "SKILLS", bold: true, size: 18, color: "FFFFFF", characterSpacing: 30 })] }),
        ...data.skills.split(",").map(s => s.trim()).filter(Boolean).map(s =>
          new Paragraph({ children: [new TextRun({ text: `• ${s}`, size: 18, color: "FFFFFF" })] })
        ),
        new Paragraph({ children: [new TextRun({ text: "" })] }),
      ] : []),
      ...(data.education.length ? [
        new Paragraph({ children: [new TextRun({ text: "EDUCATION", bold: true, size: 18, color: "FFFFFF", characterSpacing: 30 })] }),
        ...data.education.flatMap(ed => [
          new Paragraph({ children: [new TextRun({ text: ed.degree, bold: true, size: 18, color: "FFFFFF" })] }),
          new Paragraph({ children: [new TextRun({ text: ed.school, size: 18, color: "FFFFFF" })] }),
          new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: ed.date, size: 16, color: "EEEEEE" })] }),
        ]),
      ] : []),
    ];

    const rightChildren: Paragraph[] = data.sectionOrder
      .filter(id => id === "summary" || id === "experience")
      .flatMap(id => sectionMap[id]);

    const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const borders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

    body = [
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 6240],
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3120, type: WidthType.DXA },
                shading: { fill: color, type: ShadingType.CLEAR, color: "auto" },
                margins: { top: 400, bottom: 400, left: 300, right: 300 },
                children: leftChildren,
              }),
              new TableCell({
                borders,
                width: { size: 6240, type: WidthType.DXA },
                margins: { top: 400, bottom: 400, left: 300, right: 300 },
                children: rightChildren.length ? rightChildren : [new Paragraph({ children: [new TextRun({ text: "" })] })],
              }),
            ],
          }),
        ],
      }),
    ];
  } else {
    const ordered: Paragraph[] = data.sectionOrder.flatMap(id => sectionMap[id]);
    body = [...header, ...ordered];
  }

  const doc = new Document({
    creator: "ResumeForge",
    title: `${data.name || "Resume"} — Resume`,
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: body as never,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const name = (data.name || "resume").replace(/\s+/g, "_");
  saveAs(blob, `${name}.docx`);
}
