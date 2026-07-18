/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { Transaction, ShopSettings } from '../types';

export function downloadReceiptPDF(tx: Transaction, settings: ShopSettings, currentLanguage: 'en' | 'sw') {
  // Estimate height: base height of 95mm + 6mm per item + 30mm for messages/footers
  const calculatedHeight = Math.max(140, 95 + tx.items.length * 6 + (tx.discount > 0 ? 10 : 0));
  
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, calculatedHeight],
  });

  // Load custom mono font
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  
  // 1. SHOP NAME
  doc.text(settings.name, 40, 10, { align: 'center' });
  
  // 2. SHOP ADDRESS & PHONE
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.text(settings.address, 40, 14, { align: 'center' });
  doc.text(`Simu: ${settings.phone}`, 40, 18, { align: 'center' });
  
  // Status check
  if (tx.status === 'cancelled') {
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.text('** BATILI / VOIDED **', 40, 23, { align: 'center' });
  } else {
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.text('** RISITI / RECEIPT **', 40, 23, { align: 'center' });
  }
  
  // 3. METADATA
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Risiti No: ${tx.receiptNo}`, 5, 29);
  doc.text(`Tarehe: ${new Date(tx.date).toLocaleString('en-GB')}`, 5, 33);
  doc.text(`Muuza (Cashier): ${tx.cashierName}`, 5, 37);
  if (tx.customerName) {
    doc.setFont('courier', 'bold');
    doc.text(`Mteja (Customer): ${tx.customerName}`, 5, 41);
    doc.setFont('courier', 'normal');
  }
  
  const startY = tx.customerName ? 44 : 40;
  doc.line(5, startY, 75, startY); // Divider line
  
  // 4. ITEMS TABLE HEADERS
  doc.setFont('courier', 'bold');
  doc.text('Bidhaa (Item)', 5, startY + 3.5);
  doc.text('Idadi', 46, startY + 3.5, { align: 'center' });
  doc.text('Bei', 75, startY + 3.5, { align: 'right' });
  
  doc.line(5, startY + 5, 75, startY + 5);
  
  // 5. ITEMS ROWS
  doc.setFont('courier', 'normal');
  let y = startY + 9;
  tx.items.forEach((itm) => {
    const name = currentLanguage === 'sw' ? itm.productNameSw : itm.productNameEn;
    // Truncate name to fit comfortably in columns
    const dispName = name.length > 21 ? name.substring(0, 19) + '..' : name;
    
    doc.text(dispName, 5, y);
    doc.text(`${itm.quantity} ${itm.selectedUnit}`, 46, y, { align: 'center' });
    doc.text(itm.totalPrice.toLocaleString(), 75, y, { align: 'right' });
    y += 5.5;
  });
  
  doc.line(5, y - 2, 75, y - 2);
  y += 2;
  
  // 6. TOTALS BLOCK
  doc.text('Subtotal:', 5, y);
  doc.text(tx.subtotal.toLocaleString(), 75, y, { align: 'right' });
  y += 4.5;
  
  if (tx.discount > 0) {
    doc.setFont('courier', 'bold');
    doc.text('Punguzo (Discount):', 5, y);
    doc.text(`-${tx.discount.toLocaleString()}`, 75, y, { align: 'right' });
    y += 4.5;
    doc.setFont('courier', 'normal');
  }
  
  doc.text(`Kodi / VAT (${settings.taxRate}%):`, 5, y);
  doc.text(tx.tax.toLocaleString(), 75, y, { align: 'right' });
  y += 5;
  
  doc.line(5, y - 1, 75, y - 1);
  
  // Grand Total in bold display
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text('JUMLA / TOTAL:', 5, y + 2.5);
  doc.text(`${tx.total.toLocaleString()} TSh`, 75, y + 2.5, { align: 'right' });
  y += 8.5;
  
  // 7. FOOTER DETAILS
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.text(`LIPA KWA (PAYMENT): ${tx.paymentMethod.toUpperCase()}`, 40, y, { align: 'center' });
  y += 5.5;
  
  const receiptMessage = currentLanguage === 'sw' ? settings.receiptMessageSw : settings.receiptMessageEn;
  const splitMsg = doc.splitTextToSize(receiptMessage, 68);
  doc.text(splitMsg, 40, y, { align: 'center' });
  y += splitMsg.length * 3.5 + 2;
  
  if (tx.status === 'cancelled') {
    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.text(`FUTA NA (VOID BY): ${tx.cancelledBy}`, 40, y, { align: 'center' });
    y += 3.5;
    doc.text(`SABABU (REASON): ${tx.cancelledReason}`, 40, y, { align: 'center' });
    y += 4;
  }
  
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.text('*** AHANTE NA KARIBU TENA ***', 40, y, { align: 'center' });
  
  // Save the PDF
  doc.save(`risiti_${tx.receiptNo}.pdf`);
}
