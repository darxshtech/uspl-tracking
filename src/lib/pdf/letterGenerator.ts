import jsPDF from "jspdf";

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
  signatory_name?: string;
  signatory_title?: string;
  custom_remarks?: string;
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

export function generateLetterPDF(data: LetterData, autoDownload: boolean = true): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 20;
  let currentY = 22;

  // Colors
  const primaryNavy = [15, 23, 42]; // #0f172a
  const accentBlue = [37, 99, 235]; // #2563eb
  const textDark = [30, 41, 59]; // #1e293b
  const textMuted = [100, 116, 139]; // #64748b
  const lineLight = [226, 232, 240]; // #e2e8f0

  // 1. TOP HEADER - Company Branding
  doc.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.rect(marginX, currentY, 6, 18, "F"); // Colored accent bar

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text("UNITGLO SOLUTIONS", marginX + 10, currentY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("Empowering Digital Innovation & Technology Excellence", marginX + 10, currentY + 12);
  doc.text("Pune, Maharashtra, India | contact@unitglo.com | www.unitglo.com", marginX + 10, currentY + 16.5);

  currentY += 24;

  // Decorative Rule
  doc.setDrawColor(lineLight[0], lineLight[1], lineLight[2]);
  doc.setLineWidth(0.6);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);

  doc.setDrawColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.setLineWidth(1.2);
  doc.line(marginX, currentY, marginX + 35, currentY); // Highlight segment

  currentY += 8;

  // 2. REFERENCE NO & DATE BAR
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`Ref: ${data.reference_no}`, marginX, currentY);

  const formattedDate = formatDateString(data.issue_date || new Date().toISOString().split("T")[0]);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Date: ${formattedDate}`, pageWidth - marginX, currentY, { align: "right" });

  currentY += 8;

  // 3. RECIPIENT DETAILS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text("To,", marginX, currentY);
  currentY += 4.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(data.user_name || "Employee", marginX, currentY);
  currentY += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  if (data.designation) {
    doc.text(`Designation: ${data.designation}`, marginX, currentY);
    currentY += 4;
  }
  if (data.department) {
    doc.text(`Department: ${data.department}`, marginX, currentY);
    currentY += 4;
  }
  if (data.user_email) {
    doc.text(`Email: ${data.user_email}`, marginX, currentY);
    currentY += 4;
  }

  currentY += 4;

  // 4. SUBJECT LINE
  let subjectText = "";
  if (data.letter_type === "Joining Letter") {
    subjectText = `Subject: Letter of Appointment - ${data.designation || "Software Professional"}`;
  } else if (data.letter_type === "Experience Letter") {
    subjectText = `Subject: Experience & Relieving Certificate - ${data.user_name}`;
  } else {
    subjectText = `Subject: Certificate of Internship Completion - ${data.user_name}`;
  }

  // Draw light background pill for subject
  doc.setFillColor(241, 245, 249); // #f1f5f9
  doc.roundedRect(marginX, currentY - 1, pageWidth - 2 * marginX, 8, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(subjectText, marginX + 3, currentY + 4.2);

  currentY += 13;

  // 5. SALUTATION
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`Dear ${data.user_name},`, marginX, currentY);
  currentY += 6;

  // 6. DYNAMIC BODY CONTENT
  const bodyWidth = pageWidth - 2 * marginX;
  const lineHeight = 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);

  if (data.letter_type === "Joining Letter") {
    const formattedJoinDate = formatDateString(data.joining_date || data.issue_date);
    const ctcStr = data.annual_ctc ? `₹${data.annual_ctc} per annum` : (data.monthly_salary ? `₹${data.monthly_salary} per month` : "As agreed during discussion");
    const probationStr = data.probation_period || "3 (Three) months";
    const locationStr = data.work_location || "Pune / Hybrid";

    const p1 = `We are pleased to offer you the position of "${data.designation}" at Unitglo Solutions Private Limited ("Company"). Your joining date is effective from ${formattedJoinDate}. We believe that your skills and expertise will be an invaluable asset to our engineering and development team.`;
    const linesP1 = doc.splitTextToSize(p1, bodyWidth);
    doc.text(linesP1, marginX, currentY);
    currentY += linesP1.length * lineHeight + 3;

    // Key Terms Sub-table/bullets
    doc.setFont("helvetica", "bold");
    doc.text("Key Terms & Conditions of Employment:", marginX, currentY);
    currentY += 5;

    doc.setFont("helvetica", "normal");
    const terms = [
      `Designation & Department: ${data.designation} (${data.department || "Engineering"})`,
      `Date of Commencement: ${formattedJoinDate}`,
      `Total Compensation (CTC): ${ctcStr}`,
      `Probation Period: ${probationStr} from the date of joining`,
      `Working Hours & Location: Standard hours (10:00 AM - 7:00 PM IST), based at ${locationStr}`,
      `Reporting To: ${data.reporting_manager || "Project Manager / Director"}`,
    ];

    terms.forEach((term) => {
      doc.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
      doc.circle(marginX + 2, currentY - 1, 0.8, "F");
      const splitTerm = doc.splitTextToSize(term, bodyWidth - 6);
      doc.text(splitTerm, marginX + 6, currentY);
      currentY += splitTerm.length * lineHeight;
    });

    currentY += 3;
    const p2 = `During your tenure, you agree to adhere to all company policies, confidentiality agreements, and code of conduct. The company reserves the right to modify responsibilities in accordance with ongoing project requirements.`;
    const linesP2 = doc.splitTextToSize(p2, bodyWidth);
    doc.text(linesP2, marginX, currentY);
    currentY += linesP2.length * lineHeight + 3;

    if (data.custom_remarks) {
      const pRemarks = `Additional Terms: ${data.custom_remarks}`;
      const linesRemarks = doc.splitTextToSize(pRemarks, bodyWidth);
      doc.text(linesRemarks, marginX, currentY);
      currentY += linesRemarks.length * lineHeight + 3;
    }

    const p3 = `Please sign and return the duplicate copy of this letter as confirmation of your acceptance. We look forward to a rewarding and successful working relationship with you at Unitglo Solutions.`;
    const linesP3 = doc.splitTextToSize(p3, bodyWidth);
    doc.text(linesP3, marginX, currentY);
    currentY += linesP3.length * lineHeight + 4;

  } else if (data.letter_type === "Experience Letter") {
    const formattedJoin = formatDateString(data.joining_date);
    const formattedRelieve = formatDateString(data.relieving_date || data.issue_date);

    const p1 = `This is to certify that ${data.user_name} was formally employed with Unitglo Solutions Private Limited as "${data.designation}" in the ${data.department || "Engineering"} department from ${formattedJoin} to ${formattedRelieve}.`;
    const linesP1 = doc.splitTextToSize(p1, bodyWidth);
    doc.text(linesP1, marginX, currentY);
    currentY += linesP1.length * lineHeight + 4;

    const p2 = `During their tenure with Unitglo Solutions, ${data.user_name} contributed diligently to software development, client deliveries, and technical initiatives. They demonstrated commendable problem-solving abilities, adherence to deadlines, and maintained a collaborative team attitude.`;
    const linesP2 = doc.splitTextToSize(p2, bodyWidth);
    doc.text(linesP2, marginX, currentY);
    currentY += linesP2.length * lineHeight + 4;

    const p3 = `They have been relieved from all their duties and responsibilities at Unitglo Solutions at the close of business hours on ${formattedRelieve}. All company assets and project handovers have been properly settled and completed.`;
    const linesP3 = doc.splitTextToSize(p3, bodyWidth);
    doc.text(linesP3, marginX, currentY);
    currentY += linesP3.length * lineHeight + 4;

    if (data.custom_remarks) {
      const pRemarks = `Management Remarks: ${data.custom_remarks}`;
      const linesRemarks = doc.splitTextToSize(pRemarks, bodyWidth);
      doc.text(linesRemarks, marginX, currentY);
      currentY += linesRemarks.length * lineHeight + 4;
    }

    const p4 = `We appreciate their contributions to our organization and wish them every success and prosperity in all their future endeavors and career paths.`;
    const linesP4 = doc.splitTextToSize(p4, bodyWidth);
    doc.text(linesP4, marginX, currentY);
    currentY += linesP4.length * lineHeight + 4;

  } else {
    // Internship Completion Letter
    const formattedStart = formatDateString(data.joining_date);
    const formattedEnd = formatDateString(data.relieving_date || data.issue_date);

    const p1 = `This is to certify that ${data.user_name} has successfully completed a professional internship program as "${data.designation || "Software Engineering Intern"}" at Unitglo Solutions Private Limited. The internship tenure was from ${formattedStart} to ${formattedEnd}.`;
    const linesP1 = doc.splitTextToSize(p1, bodyWidth);
    doc.text(linesP1, marginX, currentY);
    currentY += linesP1.length * lineHeight + 4;

    const p2 = `During this period, ${data.user_name} was actively involved in software design, development workflows, feature testing, and team sprint deliverables under the guidance of our senior engineering mentors. They demonstrated exemplary enthusiasm, quick learning aptitude, and professional work ethics throughout the program.`;
    const linesP2 = doc.splitTextToSize(p2, bodyWidth);
    doc.text(linesP2, marginX, currentY);
    currentY += linesP2.length * lineHeight + 4;

    if (data.custom_remarks) {
      const pRemarks = `Project & Performance Highlights: ${data.custom_remarks}`;
      const linesRemarks = doc.splitTextToSize(pRemarks, bodyWidth);
      doc.text(linesRemarks, marginX, currentY);
      currentY += linesRemarks.length * lineHeight + 4;
    }

    const p3 = `We commend their dedication, intellectual curiosity, and positive contribution during the internship. We wish ${data.user_name} outstanding success in all their future academic and professional endeavors.`;
    const linesP3 = doc.splitTextToSize(p3, bodyWidth);
    doc.text(linesP3, marginX, currentY);
    currentY += linesP3.length * lineHeight + 4;
  }

  // 7. SIGNATURE & AUTHORIZED SIGNATORY BLOCK
  // Ensure enough space before bottom
  if (currentY > 230) {
    currentY = 230;
  } else {
    currentY = Math.max(currentY + 6, 215);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text("Sincerely,", marginX, currentY);
  currentY += 4;

  doc.setFont("helvetica", "bold");
  doc.text("For Unitglo Solutions Private Limited,", marginX, currentY);
  currentY += 16; // space for physical or digital signature stamp

  // Official Seal Badge (Graphic element on right)
  const sealX = pageWidth - marginX - 45;
  doc.setDrawColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.setLineWidth(0.8);
  doc.roundedRect(sealX, currentY - 14, 45, 20, 2, 2, "D");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.text("UNITGLO SOLUTIONS", sealX + 22.5, currentY - 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("OFFICIAL SEAL / HR DEPT", sealX + 22.5, currentY - 3.5, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(0, 150, 80);
  doc.text("VERIFIED & ISSUED", sealX + 22.5, currentY + 1.5, { align: "center" });

  // Signatory Name & Title on left
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

  // 8. FOOTER
  const footerY = pageHeight - 14;
  doc.setDrawColor(lineLight[0], lineLight[1], lineLight[2]);
  doc.setLineWidth(0.5);
  doc.line(marginX, footerY - 3, pageWidth - marginX, footerY - 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    "Unitglo Solutions Private Limited | CIN: U72900PN2023PTC220000 | This is an authentic computer-generated official document.",
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  if (autoDownload) {
    const filenameSafe = (data.reference_no || "Official_Letter").replace(/[\/\\?%*:|"<>]/g, "_");
    doc.save(`${filenameSafe}.pdf`);
  }

  return doc;
}
