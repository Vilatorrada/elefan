import PDFDocument from 'pdfkit';
import { getActiveLotLamps, getEffectiveLampCount } from './algorithm.js';

export function generateReportPdf(dbData, res) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  doc.pipe(res);

  // Header Banner - Official Colors of Sant Joan de Vilatorrada
  doc.rect(0, 0, doc.page.width, 70).fill('#4a7729');

  doc.fillColor('#FFFFFF')
     .fontSize(16)
     .font('Helvetica-Bold')
     .text("AJUNTAMENT DE SANT JOAN DE VILATORRADA", 40, 20);

  doc.fontSize(10)
     .font('Helvetica')
     .text("Oficina d'Estadística i Procés Electoral | Propaganda Electoral", 40, 42);

  doc.moveDown(3);

  // Document Title
  doc.fillColor('#1E293B')
     .fontSize(16)
     .font('Helvetica-Bold')
     .text("ACTA D'ASSIGNACIÓ DE FANALS I EMPLAÇAMENTS", 40, 95);

  doc.fontSize(11)
     .font('Helvetica')
     .fillColor('#64748B')
     .text(`Procés Electoral: ${dbData.electionInfo.title} (${dbData.electionInfo.date})`);

  doc.moveDown(1);
  doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, 140).lineTo(550, 140).stroke();

  // Section 1: Summary Table of Parties
  doc.moveDown(1);
  doc.fillColor('#1E293B').fontSize(12).font('Helvetica-Bold').text("1. Resum d'Assignació per Partit Polític", 40, 155);

  let y = 180;
  doc.rect(40, y, 510, 22).fill('#F1F5F9');
  doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold');
  doc.text("Candidatura", 50, y + 6);
  doc.text("Quota Fanals", 260, y + 6);
  doc.text("Fanals Assignats", 340, y + 6);
  doc.text("Emplaçaments", 440, y + 6);

  y += 25;
  doc.font('Helvetica').fontSize(9);

  const results = dbData.allocationResults;
  dbData.parties.forEach((party, idx) => {
    if (y > 700) {
      doc.addPage();
      y = 40;
    }

    const assignedCount = results ? (results.partyAssignedLamps?.[party.id] || 0) : 0;
    const assignedLocs = results ? (results.partyAssignedLocations?.[party.id] || 0) : 0;

    if (idx % 2 === 1) {
      doc.rect(40, y - 2, 510, 20).fill('#F8FAFC');
    }

    doc.fillColor('#0F172A').text(`${party.name} (${party.acronym})`, 50, y, { width: 200, lineBreak: false });
    doc.fillColor('#475569').text(`${party.allocatedStreetlampsQuota}`, 260, y);
    doc.fillColor(assignedCount >= party.allocatedStreetlampsQuota ? '#047857' : '#B45309')
       .font('Helvetica-Bold')
       .text(`${assignedCount} / ${party.allocatedStreetlampsQuota}`, 340, y);

    doc.fillColor('#475569')
       .font('Helvetica')
       .text(`${assignedLocs} / ${party.allocatedLocationsQuota}`, 440, y);

    y += 20;
  });

  // Section 2: Fixed Locations Allocation
  y += 15;
  if (y > 650) {
    doc.addPage();
    y = 40;
  }

  doc.fillColor('#1E293B').fontSize(12).font('Helvetica-Bold').text("2. Detall d'Emplaçaments Fixos Assignats", 40, y);
  y += 22;

  if (!dbData.locations || dbData.locations.length === 0) {
    doc.fillColor('#64748B').font('Helvetica').fontSize(9).text("Cap emplaçament fix registrat.", 40, y);
    y += 20;
  } else {
    doc.rect(40, y, 510, 22).fill('#F1F5F9');
    doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold');
    doc.text("Codi", 50, y + 6);
    doc.text("Emplaçament", 110, y + 6);
    doc.text("Capacitat", 320, y + 6);
    doc.text("Candidatures Adjudicatàries", 385, y + 6);

    y += 25;
    doc.font('Helvetica').fontSize(9);

    dbData.locations.forEach((loc, idx) => {
      if (y > 730) {
        doc.addPage();
        y = 40;
      }

      if (idx % 2 === 1) {
        doc.rect(40, y - 2, 510, 20).fill('#F8FAFC');
      }

      const assignedIds = results?.locationAssignments?.[loc.id] || [];
      const acronyms = assignedIds
        .map(pid => dbData.parties.find(p => p.id === pid)?.acronym || pid)
        .join(', ');

      doc.fillColor('#0F172A').text(loc.id, 50, y);
      doc.fillColor('#334155').text(loc.name, 110, y, { width: 200, height: 16 });
      doc.fillColor('#475569').text(`${loc.capacity}`, 320, y);
      doc.fillColor(acronyms ? '#047857' : '#94A3B8')
         .font(acronyms ? 'Helvetica-Bold' : 'Helvetica')
         .text(acronyms || 'Pendent / Lliure', 385, y, { width: 160, height: 16 });

      doc.font('Helvetica');
      y += 20;
    });
  }

  // Section 3: Detailed Streetlamp Allocation Inside Each Lot
  y += 15;
  if (y > 650) {
    doc.addPage();
    y = 40;
  }

  doc.fillColor('#1E293B').fontSize(12).font('Helvetica-Bold').text("3. Detall de Fanals Assignats per Lot", 40, y);
  y += 22;

  if (!dbData.lots || dbData.lots.length === 0) {
    doc.fillColor('#64748B').font('Helvetica').fontSize(9).text("Cap lot de fanals creat.", 40, y);
    y += 20;
  } else {
    dbData.lots.forEach((lot) => {
      if (y > 680) {
        doc.addPage();
        y = 40;
      }

      const effectiveLamps = getEffectiveLampCount(lot);
      const activeLamps = getActiveLotLamps(lot);
      const lotLampMap = results?.lotLampAssignments?.[lot.id] || {};

      doc.rect(40, y, 510, 22).fill('#ECFDF5');
      doc.fillColor('#14532D').font('Helvetica-Bold').fontSize(9.5)
         .text(`${lot.id} — ${lot.name} (${lot.street})`, 48, y + 6, { width: 320, lineBreak: false });

      if (lot.reserved) {
        doc.fillColor('#DC2626').text("RESERVAT (ACTES MUNICIPALS)", 375, y + 6);
        y += 28;
        return;
      }
      if (effectiveLamps === 0) {
        doc.fillColor('#B45309').text("SENSE FANALS SELECCIONATS", 375, y + 6);
        y += 28;
        return;
      }

      doc.fillColor('#166534').text(`${effectiveLamps} fanals seleccionats`, 420, y + 6);
      y += 25;

      // Sub-header for lamps in this lot
      doc.rect(40, y, 510, 18).fill('#F1F5F9');
      doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8.5);
      doc.text("Codi Farola", 50, y + 4);
      doc.text("Adreça / Número", 130, y + 4);
      doc.text("Suport", 320, y + 4);
      doc.text("Candidatura Adjudicatària", 405, y + 4);
      y += 20;

      doc.font('Helvetica').fontSize(8.5);
      activeLamps.forEach((lamp, lIdx) => {
        if (y > 740) {
          doc.addPage();
          y = 40;
        }
        if (lIdx % 2 === 1) {
          doc.rect(40, y - 2, 510, 17).fill('#F8FAFC');
        }

        const pid = lotLampMap[lamp.codi] || results?.lampAssignments?.[lamp.codi] || null;
        const party = pid ? dbData.parties.find(p => p.id === pid) : null;
        const numText = lamp.num && lamp.num !== 's/n' ? `Núm. ${lamp.num}` : 's/n';

        doc.fillColor('#0F172A').font('Helvetica-Bold').text(lamp.codi, 50, y);
        doc.fillColor('#334155').font('Helvetica').text(`${lamp.carrer} (${numText})`, 130, y, { width: 185, lineBreak: false });
        doc.fillColor('#475569').text(lamp.suport || '-', 320, y, { width: 80, lineBreak: false });
        doc.fillColor(party ? '#047857' : '#94A3B8')
           .font(party ? 'Helvetica-Bold' : 'Helvetica')
           .text(party ? `${party.acronym} (${party.name})` : 'Pendent / Lliure', 405, y, { width: 140, lineBreak: false });

        doc.font('Helvetica');
        y += 17;
      });

      y += 10;
    });
  }

  // Footer
  if (y > 680) doc.addPage();

  y = doc.page.height - 95;
  doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, y).lineTo(550, y).stroke();

  y += 12;
  doc.fontSize(8).fillColor('#64748B').text("Ajuntament de Sant Joan de Vilatorrada - Plaça Major, 1, 08250 Sant Joan de Vilatorrada", 40, y);
  doc.text(`Document generat automàticament el ${new Date().toLocaleDateString('ca-ES')} a les ${new Date().toLocaleTimeString('ca-ES')}`, 40, y + 12);

  doc.end();
}
