export const brand = {
  gradient: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #3b82f6 100%)',
  gradientAlt: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
  bgDark: '#0f172a',
  bgCard: '#1e293b',
  bgCardAlt: '#334155',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  accent: '#8b5cf6',
  accentLight: '#a78bfa',
  success: '#10b981',
  border: '#334155',
  borderLight: '#475569',
}

export function makeHeader(title: string): string {
  return `<tr>
    <td align="center" style="padding:40px 36px 32px;background:${brand.gradient};position:relative">
      <!-- Subtle decorative overlay -->
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at 20% 50%,rgba(255,255,255,0.06) 0%,transparent 60%);pointer-events:none"></div>
      <!-- Logo mark -->
      <div style="width:48px;height:48px;margin:0 auto 20px;background:rgba(255,255,255,0.15);border-radius:14px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <h1 style="margin:0;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.3px">${title}</h1>
    </td>
  </tr>`
}

export function makeFooter(siteName: string): string {
  return `<tr>
    <td style="padding:28px 36px;background:${brand.bgCard};border-top:1px solid ${brand.border};border-radius:0 0 16px 16px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding-bottom:12px">
            <a href="{{site_url}}" style="color:${brand.accentLight};font-size:13px;font-weight:600;text-decoration:none">${siteName}</a>
          </td>
        </tr>
        <tr>
          <td align="center">
            <p style="margin:0;font-size:12px;color:${brand.textMuted};line-height:1.6">
              &copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.
            </p>
            <p style="margin:4px 0 0;font-size:12px;color:${brand.textMuted};line-height:1.6">
              If you did not expect this email, you can safely ignore it.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}

export function makeTableWrapper(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${brand.bgDark};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${brand.bgDark};padding:48px 16px">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:${brand.bgCard};border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3),0 0 0 1px ${brand.border}">
          ${content}
        </table>
        <!-- Optional bottom message -->
        <p style="margin:16px 0 0;font-size:11px;color:${brand.textMuted}">${'{{site_name}}'} &mdash; Powered by APay</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function makeButton(url: string, label: string, variant: 'primary' | 'success' | 'warning' = 'primary'): string {
  const colors = {
    primary: { bg: brand.gradient, shadow: 'rgba(124,58,237,0.3)' },
    success: { bg: brand.gradientAlt, shadow: 'rgba(16,185,129,0.3)' },
    warning: { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', shadow: 'rgba(245,158,11,0.3)' },
  }
  const c = colors[variant]
  return `<table cellpadding="0" cellspacing="0" style="margin:28px auto 8px">
    <tr>
      <td align="center" style="border-radius:10px;background:${c.bg};padding:1px;box-shadow:0 4px 14px ${c.shadow}">
        <a href="${url}" style="display:inline-block;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 44px;letter-spacing:0.3px">${label}</a>
      </td>
    </tr>
  </table>`
}

export function makeDivider(): string {
  return `<tr><td style="padding:0 36px"><div style="height:1px;background:${brand.border};margin:0"></div></td></tr>`
}

export function makeInfoRow(label: string, value: string, isLast = false): string {
  return `<tr>
    <td style="padding:14px 24px${isLast ? '' : `;border-bottom:1px solid ${brand.border}`}">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:11px;color:${brand.textMuted};text-transform:uppercase;letter-spacing:0.8px;font-weight:600;padding-bottom:4px">${label}</td>
        </tr>
        <tr>
          <td style="font-size:15px;font-weight:600;color:${brand.textPrimary}">${value}</td>
        </tr>
      </table>
    </td>
  </tr>`
}

export function makeInfoCard(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${brand.bgCardAlt};border-radius:12px;margin:20px 0;border:1px solid ${brand.border};overflow:hidden">
    ${rows}
  </table>`
}
