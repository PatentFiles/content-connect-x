import React from 'react';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';
import CCButton from '../ui-custom/CCButton';
import { sanitizeHtml, escapeHtml } from '@/lib/sanitizeHtml';

export default function PrintContract({ contract, signatures = [] }) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const esc = escapeHtml;

    const partiesHtml = (contract.parties || [])
      .map(p => `<p><strong>${esc(p.role_type || 'Party')}:</strong> ${esc(p.stage_name || p.legal_name || p.company_name || p.email || '')}</p>`)
      .join('');

    const sigsHtml = (contract.signatories || [])
      .map(sig => {
        const sigRecord = signatures.find(s => s.user_id === sig.user_id);
        return `
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-name">${sigRecord ? `/s/ ${esc(sigRecord.signature_text || sig.name)}` : '&nbsp;'}</div>
            <div class="sig-label">${esc(sig.name || sig.user_id)}</div>
            <div class="sig-date">${sigRecord ? `Signed: ${esc(format(new Date(sigRecord.signed_at), 'MMMM d, yyyy'))}` : 'Signature pending'}</div>
          </div>`;
      })
      .join('');

    const rawBody = typeof contract.content === 'string' ? contract.content : '';
    const bodyContent = sanitizeHtml(rawBody)
      || (contract.scenes || []).map(s => `<h3>${esc(s.title)}</h3><p>${esc(s.description || '')}</p>`).join('')
      || '<p>No contract content available.</p>';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${esc(contract.title || 'Contract')}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 820px; margin: 0 auto; padding: 48px 40px; color: #111; font-size: 14px; line-height: 1.7; }
    h1 { font-size: 22px; text-align: center; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 8px; }
    .subtitle { text-align: center; font-size: 13px; color: #555; margin-bottom: 32px; }
    .meta-row { display: flex; justify-content: space-between; font-size: 12px; color: #555; margin-bottom: 32px; border-bottom: 1px solid #ddd; padding-bottom: 12px; }
    .section { margin-bottom: 28px; }
    .section h2 { font-size: 15px; border-bottom: 1px solid #ccc; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .content { line-height: 1.8; }
    .signatures { margin-top: 56px; display: flex; gap: 48px; flex-wrap: wrap; page-break-inside: avoid; }
    .sig-block { flex: 1; min-width: 220px; }
    .sig-line { border-top: 1px solid #111; margin-bottom: 6px; }
    .sig-name { font-style: italic; font-size: 15px; color: #222; min-height: 20px; }
    .sig-label { font-weight: bold; font-size: 13px; }
    .sig-date { font-size: 11px; color: #666; margin-top: 2px; }
    .badge { display: inline-block; padding: 2px 8px; border: 1px solid #aaa; border-radius: 4px; font-size: 11px; color: #555; margin-left: 8px; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>${esc(contract.title || 'Content Collaboration Agreement')}</h1>
  <div class="subtitle">Confidential — Content Connect Platform</div>
  <div class="meta-row">
    <span>Version ${esc(contract.version || 1)}</span>
    <span>Created: ${esc(format(new Date(contract.created_date), 'MMMM d, yyyy'))}</span>
    ${contract.effective_date ? `<span>Effective: ${esc(format(new Date(contract.effective_date), 'MMMM d, yyyy'))}</span>` : ''}
    <span>Status: ${esc((contract.status || 'draft').replace(/_/g, ' '))}</span>
  </div>

  ${partiesHtml ? `<div class="section"><h2>Parties</h2>${partiesHtml}</div>` : ''}

  <div class="section content">${bodyContent}</div>

  ${contract.post_scene_rules ? `
    <div class="section">
      <h2>Post-Scene Rules</h2>
      ${contract.post_scene_rules.editing_rules ? `<p><strong>Editing:</strong> ${esc(contract.post_scene_rules.editing_rules)}</p>` : ''}
      ${contract.post_scene_rules.posting_rules ? `<p><strong>Posting:</strong> ${esc(contract.post_scene_rules.posting_rules)}</p>` : ''}
      ${contract.post_scene_rules.platforms?.length ? `<p><strong>Platforms:</strong> ${esc(contract.post_scene_rules.platforms.join(', '))}</p>` : ''}
      ${contract.post_scene_rules.crediting_rules ? `<p><strong>Crediting:</strong> ${esc(contract.post_scene_rules.crediting_rules)}</p>` : ''}
    </div>
  ` : ''}

  <div class="signatures">${sigsHtml}</div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  return (
    <CCButton variant="outline" icon={Printer} onClick={handlePrint}>
      Print
    </CCButton>
  );
}