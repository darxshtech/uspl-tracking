import jsPDF from "jspdf";
import { UNITGLO_LOGO_BASE64 } from "./logoBase64";
import { DEFAULT_LETTER_POLICIES } from "@/lib/constants/policies";

export interface LetterData {
  reference_no: string;
  letter_type: "Joining Letter" | "Experience Letter" | "Internship Completion";
  title?: string;
  issue_date: string;
  user_name: string;
  user_email?: string;
  user_phone?: string;
  designation: string;
  joining_date?: string;
  relieving_date?: string;
  department?: string;
  reporting_manager?: string;
  annual_ctc?: string;
  monthly_salary?: string;
  probation_period?: string;
  work_location?: string;
  working_days?: string;
  work_timing?: string;
  signatory_name?: string;
  signatory_title?: string;
  custom_remarks?: string;
  company_policies?: string[] | string;
}

export function formatDateString(dateStr?: string): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Reusable official Unitglo letterhead with logo, registered corporate credentials, and styling
 */
function renderCorporateHeader(doc: jsPDF, pageWidth: number, marginX: number, startY: number = 16): number {
  const primaryNavy = [15, 23, 42];
  const accentBlue = [37, 99, 235];
  const textMuted = [100, 116, 139];

  try {
    // Official Unitglo Logo (Aspect ratio ~2.8:1)
    doc.addImage(UNITGLO_LOGO_BASE64, "JPEG", marginX, startY - 2, 45, 16.1);
  } catch (err) {
    console.warn("Could not render logo in PDF, rendering fallback text:", err);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text("UNITGLO SOLUTIONS", marginX, startY + 8);
  }

  // Company Address & Registration info on right side
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text("UNITGLO SOLUTIONS PRIVATE LIMITED", pageWidth - marginX, startY + 2, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("CIN: U72900PN2016PTC165210 | GSTIN: 27AABCU9538R1ZD", pageWidth - marginX, startY + 6, { align: "right" });
  doc.text("Regd. Office: Flat No 9, Shri Sai Samarth Heights, A wing, Mohan Nagar,", pageWidth - marginX, startY + 9.5, { align: "right" });
  doc.text("MIDC, Chinchwad, Pimpri-Chinchwad, Maharashtra - 411019", pageWidth - marginX, startY + 13, { align: "right" });
  doc.text("Email: info@unitglo.com | Web: www.unitglo.com | Tel: +91 73875 11539", pageWidth - marginX, startY + 16.5, { align: "right" });

  const lineY = startY + 23;

  // Double Decorative Rule
  doc.setDrawColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setLineWidth(0.8);
  doc.line(marginX, lineY, pageWidth - marginX, lineY);

  doc.setDrawColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.setLineWidth(1.4);
  doc.line(marginX, lineY + 1.2, marginX + 45, lineY + 1.2);

  return lineY + 8;
}

export function generateLetterPDF(data: LetterData, autoDownload: boolean = true): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 18;
  const printableWidth = pageWidth - 2 * marginX; // 174mm

  // Colors
  const primaryNavy = [15, 23, 42]; // #0f172a
  const accentBlue = [37, 99, 235]; // #2563eb
  const textDark = [30, 41, 59]; // #1e293b
  const textMuted = [100, 116, 139]; // #64748b
  const lineLight = [226, 232, 240]; // #e2e8f0
  const bgTable = [248, 250, 252]; // #f8fafc

  // =========================================================================
  // 1. TOP HEADER - Official Unitglo Logo & Corporate Letterhead (Page 1)
  // =========================================================================
  let currentY = renderCorporateHeader(doc, pageWidth, marginX, 16);

  // =========================================================================
  // 2. REFERENCE NO & DATE BAR
  // =========================================================================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(`Ref. No: ${data.reference_no}`, marginX, currentY);

  const formattedDate = formatDateString(data.issue_date || new Date().toISOString().split("T")[0]);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`Date of Issue: ${formattedDate}`, pageWidth - marginX, currentY, { align: "right" });

  currentY += 8;

  // =========================================================================
  // 3. RECIPIENT INFORMATION (JOINING LETTER ONLY; OTHERS USE FORMAL SALUTATION)
  // =========================================================================
  if (data.letter_type === "Joining Letter") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("To,", marginX, currentY);
    currentY += 4.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(data.user_name || "Candidate", marginX, currentY);
    currentY += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    if (data.designation) {
      doc.text(`Designation: ${data.designation}`, marginX, currentY);
      currentY += 4;
    }
    if (data.user_email) {
      doc.text(`Email: ${data.user_email}`, marginX, currentY);
      currentY += 4;
    }
    currentY += 2;
  }

  // =========================================================================
  // 4. SUBJECT / TITLE BANNER
  // =========================================================================
  let subjectText = "";
  if (data.letter_type === "Joining Letter") {
    subjectText = `OFFER & LETTER OF APPOINTMENT - ${data.designation?.toUpperCase() || "SOFTWARE PROFESSIONAL"}`;
  } else if (data.letter_type === "Experience Letter") {
    subjectText = `EXPERIENCE & RELIEVING CERTIFICATE`;
  } else {
    subjectText = `CERTIFICATE OF INTERNSHIP COMPLETION`;
  }

  // Draw elegant rounded banner for subject
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(marginX, currentY, printableWidth, 7.5, 1.2, 1.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(subjectText, pageWidth / 2, currentY + 5.2, { align: "center" });

  currentY += 13;

  // =========================================================================
  // 5. BODY TEMPLATES (JOINING, EXPERIENCE, INTERNSHIP)
  // =========================================================================
  const lineHeight = 4.6;

  if (data.letter_type === "Joining Letter") {
    // SALUTATION
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(`Dear ${data.user_name},`, marginX, currentY);
    currentY += 5.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);

    const formattedJoinDate = formatDateString(data.joining_date || data.issue_date);
    const p1 = `With reference to your application and the subsequent technical evaluation rounds, we are pleased to offer you the position of "${data.designation}" with Unitglo Solutions Private Limited ("Company"). We believe your expertise and skills will be an integral asset to our software development and client initiatives.`;
    const linesP1 = doc.splitTextToSize(p1, printableWidth);
    doc.text(linesP1, marginX, currentY);
    currentY += linesP1.length * lineHeight + 3;

    // Structured Terms of Employment Table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text("Terms of Employment & Compensation Structure:", marginX, currentY);
    currentY += 4;

    const ctcStr = data.annual_ctc ? `INR ${data.annual_ctc}/- Per Annum` : "As mutually agreed";
    const monthlyStr = data.monthly_salary ? `INR ${data.monthly_salary}/- Per Month` : "As per company policy";
    const probationStr = data.probation_period || "3 (Three) Months from joining date";
    const daysStr = data.working_days || "Monday to Friday (5 Days / Week)";
    const hoursStr = data.work_timing || "10:00 AM - 7:00 PM (IST)";
    const locationStr = data.work_location || "Pune, Maharashtra / Hybrid";
    const managerStr = data.reporting_manager || "Project Manager / Director";

    const tableRows = [
      ["Designation & Department", `${data.designation} (${data.department || "Engineering & Development"})`],
      ["Date of Commencement", formattedJoinDate],
      ["Total Remuneration (CTC)", `${ctcStr} (Gross: ${monthlyStr})`],
      ["Probationary Period", probationStr],
      ["Working Days Schedule", daysStr],
      ["Working Hours / Shift", hoursStr],
      ["Work Location / Posting", locationStr],
      ["Reporting Authority", managerStr],
    ];

    const col1Width = 58;
    const col2Width = printableWidth - col1Width;
    const rowHeight = 6.2;

    doc.setFontSize(8.5);
    tableRows.forEach((row, idx) => {
      // Row background
      if (idx % 2 === 0) {
        doc.setFillColor(bgTable[0], bgTable[1], bgTable[2]);
        doc.rect(marginX, currentY, printableWidth, rowHeight, "F");
      }
      doc.setDrawColor(lineLight[0], lineLight[1], lineLight[2]);
      doc.setLineWidth(0.3);
      doc.rect(marginX, currentY, printableWidth, rowHeight, "D");
      doc.line(marginX + col1Width, currentY, marginX + col1Width, currentY + rowHeight);

      // Col 1
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(row[0], marginX + 3, currentY + 4.2);

      // Col 2
      doc.setFont("helvetica", "normal");
      doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
      doc.text(row[1], marginX + col1Width + 3, currentY + 4.2);

      currentY += rowHeight;
    });

    currentY += 4;

    // Employment Terms & Company Policies Enclosure
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text("Employment Terms & Policy Enclosure Undertaking:", marginX, currentY);
    currentY += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);

    const introClause = "This appointment is subject to the comprehensive Company Policies, Attendance Guidelines, Confidentiality Undertakings, Leave Rules, and Code of Conduct set forth in Annexure A attached hereto. Your acceptance of this appointment signifies your explicit agreement to strictly comply with all terms stipulated in this Letter of Appointment and Annexure A.";
    const splitIntro = doc.splitTextToSize(introClause, printableWidth);
    doc.text(splitIntro, marginX, currentY);
    currentY += splitIntro.length * (lineHeight - 0.9) + 2.5;

    if (data.custom_remarks) {
      const remarksText = `Special Remarks: ${data.custom_remarks}`;
      const splitRemarks = doc.splitTextToSize(remarksText, printableWidth);
      doc.setFont("helvetica", "italic");
      doc.text(splitRemarks, marginX, currentY);
      doc.setFont("helvetica", "normal");
      currentY += splitRemarks.length * (lineHeight - 0.9) + 2.5;
    }

    const closingP = "Please sign and return the duplicate copy of this letter along with Annexure A as formal confirmation of your acceptance. We warmly welcome you to Unitglo Solutions Private Limited and look forward to an enriching career together.";
    const splitClosing = doc.splitTextToSize(closingP, printableWidth);
    doc.text(splitClosing, marginX, currentY);
    currentY += splitClosing.length * (lineHeight - 0.9) + 4;

  } else if (data.letter_type === "Experience Letter") {
    // SALUTATION
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text("TO WHOMSOEVER IT MAY CONCERN", pageWidth / 2, currentY, { align: "center" });
    currentY += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);

    const formattedJoin = formatDateString(data.joining_date);
    const formattedRelieve = formatDateString(data.relieving_date || data.issue_date);

    const p1 = `This is to formally certify that ${data.user_name} was employed with Unitglo Solutions Private Limited as "${data.designation}" in the ${data.department || "Engineering & Development"} department from ${formattedJoin} to ${formattedRelieve}.`;
    const linesP1 = doc.splitTextToSize(p1, printableWidth);
    doc.text(linesP1, marginX, currentY);
    currentY += linesP1.length * lineHeight + 5;

    // Service Tenure Summary Box
    doc.setFillColor(bgTable[0], bgTable[1], bgTable[2]);
    doc.roundedRect(marginX, currentY, printableWidth, 24, 2, 2, "F");
    doc.setDrawColor(lineLight[0], lineLight[1], lineLight[2]);
    doc.roundedRect(marginX, currentY, printableWidth, 24, 2, 2, "D");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("EMPLOYEE NAME", marginX + 5, currentY + 6);
    doc.text("DESIGNATION", marginX + 58, currentY + 6);
    doc.text("DATE OF COMMENCEMENT", marginX + 115, currentY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(data.user_name, marginX + 5, currentY + 11);
    doc.text(data.designation, marginX + 58, currentY + 11);
    doc.text(formattedJoin, marginX + 115, currentY + 11);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("DEPARTMENT", marginX + 5, currentY + 17);
    doc.text("RELIEVING DATE", marginX + 58, currentY + 17);
    doc.text("CONDUCT & INTEGRITY", marginX + 115, currentY + 17);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(data.department || "Engineering", marginX + 5, currentY + 22);
    doc.text(formattedRelieve, marginX + 58, currentY + 22);
    doc.setTextColor(0, 150, 80);
    doc.text("Exemplary", marginX + 115, currentY + 22);

    currentY += 30;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);

    const p2 = `During their employment tenure, ${data.user_name} contributed actively to software architecture, client application deliveries, code reviews, and quality engineering. They demonstrated high technical aptitude, problem-solving skills, and a strong professional work ethic.`;
    const linesP2 = doc.splitTextToSize(p2, printableWidth);
    doc.text(linesP2, marginX, currentY);
    currentY += linesP2.length * lineHeight + 4;

    const p3 = `They have been relieved from all their duties and responsibilities at Unitglo Solutions Private Limited at the close of business hours on ${formattedRelieve}. All organization assets, project handovers, and documentation have been settled in order.`;
    const linesP3 = doc.splitTextToSize(p3, printableWidth);
    doc.text(linesP3, marginX, currentY);
    currentY += linesP3.length * lineHeight + 4;

    if (data.custom_remarks) {
      const pRemarks = `Special Remarks: ${data.custom_remarks}`;
      const linesRemarks = doc.splitTextToSize(pRemarks, printableWidth);
      doc.text(linesRemarks, marginX, currentY);
      currentY += linesRemarks.length * lineHeight + 4;
    }

    const p4 = `We appreciate their dedication and contributions to the company and wish them every success in all their future career undertakings.`;
    const linesP4 = doc.splitTextToSize(p4, printableWidth);
    doc.text(linesP4, marginX, currentY);
    currentY += linesP4.length * lineHeight + 6;

  } else {
    // INTERNSHIP COMPLETION CERTIFICATE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text("TO WHOMSOEVER IT MAY CONCERN", pageWidth / 2, currentY, { align: "center" });
    currentY += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);

    const formattedStart = formatDateString(data.joining_date);
    const formattedEnd = formatDateString(data.relieving_date || data.issue_date);

    const p1 = `This is to formally certify that ${data.user_name} has successfully completed a structured professional internship program as "${data.designation || "Software Engineering Intern"}" at Unitglo Solutions Private Limited from ${formattedStart} to ${formattedEnd}.`;
    const linesP1 = doc.splitTextToSize(p1, printableWidth);
    doc.text(linesP1, marginX, currentY);
    currentY += linesP1.length * lineHeight + 5;

    // Internship Scope & Evaluation Box
    doc.setFillColor(bgTable[0], bgTable[1], bgTable[2]);
    doc.roundedRect(marginX, currentY, printableWidth, 24, 2, 2, "F");
    doc.setDrawColor(lineLight[0], lineLight[1], lineLight[2]);
    doc.roundedRect(marginX, currentY, printableWidth, 24, 2, 2, "D");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("INTERN NAME", marginX + 5, currentY + 6);
    doc.text("INTERNSHIP DOMAIN", marginX + 58, currentY + 6);
    doc.text("START DATE", marginX + 115, currentY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(data.user_name, marginX + 5, currentY + 11);
    doc.text(data.designation || "Engineering", marginX + 58, currentY + 11);
    doc.text(formattedStart, marginX + 115, currentY + 11);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("MENTOR / LEAD", marginX + 5, currentY + 17);
    doc.text("COMPLETION DATE", marginX + 58, currentY + 17);
    doc.text("OVERALL RATING", marginX + 115, currentY + 17);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(data.reporting_manager || "Anmol Gadhave (PM)", marginX + 5, currentY + 22);
    doc.text(formattedEnd, marginX + 58, currentY + 22);
    doc.setTextColor(0, 150, 80);
    doc.text("Outstanding / Completed", marginX + 115, currentY + 22);

    currentY += 30;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);

    const p2 = `Throughout the internship period, ${data.user_name} participated in real-world application design, API development, test verification, and team sprint deliverables. They demonstrated commendable intellectual curiosity, quick learning aptitude, and professional work ethics.`;
    const linesP2 = doc.splitTextToSize(p2, printableWidth);
    doc.text(linesP2, marginX, currentY);
    currentY += linesP2.length * lineHeight + 4;

    if (data.custom_remarks) {
      const pRemarks = `Project & Performance Highlights: ${data.custom_remarks}`;
      const linesRemarks = doc.splitTextToSize(pRemarks, printableWidth);
      doc.text(linesRemarks, marginX, currentY);
      currentY += linesRemarks.length * lineHeight + 4;
    }

    const p3 = `We commend their dedication and performance during this tenure and wish them tremendous success in their academics and future engineering career.`;
    const linesP3 = doc.splitTextToSize(p3, printableWidth);
    doc.text(linesP3, marginX, currentY);
    currentY += linesP3.length * lineHeight + 6;
  }

  // =========================================================================
  // 6. SIGNATORY & VERIFIED OFFICIAL SEAL BLOCK
  // =========================================================================
  if (currentY > 235) {
    currentY = 235;
  } else {
    currentY = Math.max(currentY + 4, 218);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text("Sincerely,", marginX, currentY);
  currentY += 4.5;

  doc.setFont("helvetica", "bold");
  doc.text("For Unitglo Solutions Private Limited,", marginX, currentY);
  currentY += 15; // Room for physical or digital signature stamp

  // Official Verified Stamp Badge (on right side)
  const sealWidth = 48;
  const sealHeight = 22;
  const sealX = pageWidth - marginX - sealWidth;

  doc.setDrawColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.setLineWidth(0.8);
  doc.roundedRect(sealX, currentY - 14, sealWidth, sealHeight, 2, 2, "D");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.text("UNITGLO SOLUTIONS PVT. LTD.", sealX + sealWidth / 2, currentY - 8.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("OFFICIAL CORPORATE SEAL", sealX + sealWidth / 2, currentY - 4, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 150, 80);
  doc.text("✔ VERIFIED & AUTHENTIC", sealX + sealWidth / 2, currentY + 1, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("PUNE, MAHARASHTRA", sealX + sealWidth / 2, currentY + 5.5, { align: "center" });

  // Signatory Name & Designation (on left side)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(data.signatory_name || "Anmol Gadhave", marginX, currentY);
  currentY += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(data.signatory_title || "Project Manager / Authorized Signatory", marginX, currentY);
  currentY += 4;
  doc.text("Unitglo Solutions Private Limited", marginX, currentY);

  // =========================================================================
  // 7. CANDIDATE ACCEPTANCE SLIP (JOINING LETTER ONLY)
  // =========================================================================
  if (data.letter_type === "Joining Letter") {
    currentY += 6;
    doc.setFillColor(bgTable[0], bgTable[1], bgTable[2]);
    doc.roundedRect(marginX, currentY, printableWidth, 14, 1.5, 1.5, "F");
    doc.setDrawColor(lineLight[0], lineLight[1], lineLight[2]);
    doc.roundedRect(marginX, currentY, printableWidth, 14, 1.5, 1.5, "D");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text("CANDIDATE ACCEPTANCE:", marginX + 3, currentY + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text("I confirm that I have read, understood, and accept the terms and conditions outlined in this Appointment Letter and Annexure A.", marginX + 3, currentY + 8.5);

    doc.setFont("helvetica", "bold");
    doc.text("Candidate Signature: ___________________________       Date: ________________________", marginX + 3, currentY + 12.5);
  }

  // =========================================================================
  // PAGE 2+: ANNEXURE A - OFFICIAL COMPANY POLICIES & CODE OF CONDUCT
  // (Included for Joining Letters or when policies are explicitly provided)
  // =========================================================================
  if (data.letter_type === "Joining Letter" || data.company_policies) {
    doc.addPage("a4", "portrait");
    let annexureY = renderCorporateHeader(doc, pageWidth, marginX, 16);

    // Reference Bar
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(`Ref. No: ${data.reference_no} | Enclosure: Annexure A`, marginX, annexureY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(`Candidate: ${data.user_name}`, pageWidth - marginX, annexureY, { align: "right" });
    annexureY += 5.5;

    // Annexure Subject Banner
    doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.roundedRect(marginX, annexureY, printableWidth, 7, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("ANNEXURE A — OFFICIAL COMPANY POLICIES, REGULATIONS & CODE OF CONDUCT", pageWidth / 2, annexureY + 4.8, { align: "center" });

    annexureY += 9.5;

    // Render policies
    const rawPolicies = data.company_policies || DEFAULT_LETTER_POLICIES;
    const policyString = Array.isArray(rawPolicies) ? rawPolicies.join("\n\n") : rawPolicies;
    const policyItems = policyString.split(/\n{2,}|\r\n\r\n/).map(p => p.trim()).filter(Boolean);

    policyItems.forEach((item) => {
      // Split into title and description if format is "N. Title: Description"
      const colonIdx = item.indexOf(":");
      let titlePart = "";
      let descPart = item;

      if (colonIdx > 0 && colonIdx < 60) {
        titlePart = item.substring(0, colonIdx + 1).trim();
        descPart = item.substring(colonIdx + 1).trim();
      }

      // Check if space is running low on the page (reserve ~26mm for bottom undertaking + footer)
      if (annexureY > pageHeight - 38) {
        doc.addPage("a4", "portrait");
        annexureY = renderCorporateHeader(doc, pageWidth, marginX, 16);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
        doc.text(`Ref. No: ${data.reference_no} | Annexure A (Continued)`, marginX, annexureY);
        annexureY += 8;
      }

      if (titlePart) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
        doc.text(titlePart, marginX, annexureY);
        annexureY += 3.5;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.3);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const splitDesc = doc.splitTextToSize(descPart, printableWidth);
      doc.text(splitDesc, marginX, annexureY);
      annexureY += splitDesc.length * 3.3 + 2.8;
    });

    // Employee Undertaking Box on Annexure
    if (annexureY > pageHeight - 32) {
      doc.addPage("a4", "portrait");
      annexureY = renderCorporateHeader(doc, pageWidth, marginX, 16);
    }

    annexureY += 2;
    doc.setFillColor(bgTable[0], bgTable[1], bgTable[2]);
    doc.roundedRect(marginX, annexureY, printableWidth, 14, 1.5, 1.5, "F");
    doc.setDrawColor(lineLight[0], lineLight[1], lineLight[2]);
    doc.roundedRect(marginX, annexureY, printableWidth, 14, 1.5, 1.5, "D");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text("EMPLOYEE ACKNOWLEDGEMENT & COMPLIANCE UNDERTAKING:", marginX + 3, annexureY + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(
      "I hereby confirm that I have received, thoroughly reviewed, and agree to strictly comply with all the company policies, attendance guidelines, code of conduct, and confidentiality obligations stated in this Annexure.",
      marginX + 3,
      annexureY + 8.5
    );

    doc.setFont("helvetica", "bold");
    doc.text("Employee Signature: ___________________________       Date: ________________________", marginX + 3, annexureY + 12.5);
  }

  // =========================================================================
  // 8. DYNAMIC FOOTER (ACROSS ALL PAGES)
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 11;
    doc.setDrawColor(lineLight[0], lineLight[1], lineLight[2]);
    doc.setLineWidth(0.5);
    doc.line(marginX, footerY - 3, pageWidth - marginX, footerY - 3);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(
      `Unitglo Solutions Private Limited • Confidential Corporate Document • Valid with Authorized Seal Stamp • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      footerY,
      { align: "center" }
    );
  }

  if (autoDownload) {
    const filenameSafe = (data.reference_no || "Unitglo_Official_Document").replace(/[\/\\?%*:|"<>]/g, "_");
    doc.save(`${filenameSafe}.pdf`);
  }

  return doc;
}
