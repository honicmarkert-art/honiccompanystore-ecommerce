/**
 * Shared layout for Honic emails (welcome, verification, ...).
 *
 * Built for real inboxes: tables + inline styles only (Gmail strips <style> classes, Outlook ignores
 * flexbox, nobody shows SVG), a hidden preheader, a logo made from HTML (no image to block), and a
 * plain-text fallback. Every caller-supplied value must go through `esc()`.
 */

export const BRAND = {
  orange: '#ea580c',
  orangeLight: '#fb923c',
  ink: '#0f172a',
  text: '#334155',
  muted: '#64748b',
  line: '#e2e8f0',
  soft: '#f8fafc',
  page: '#f1f5f9',
}

export const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`

/** Escape text for HTML. Use for every value that came from a user or the database. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Only http(s) links (or Supabase template tags) may go into an href. */
export function safeUrl(url: string): string {
  if (/^\{\{\s*\.[A-Za-z]+\s*\}\}$/.test(url)) return url
  return /^https?:\/\//i.test(url) ? esc(url) : '#'
}

/** Big orange call-to-action button that also works in Outlook. */
export function button(label: string, url: string): string {
  const href = safeUrl(url)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px">
  <tr><td align="center" bgcolor="${BRAND.orange}" style="border-radius:12px;background:${BRAND.orange};background-image:linear-gradient(135deg,${BRAND.orangeLight},${BRAND.orange})">
    <a href="${href}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:12px">${esc(label)}&nbsp;&rarr;</a>
  </td></tr>
</table>`
}

/** A list of features: small orange badge + bold title + one line of text. */
export function featureList(items: { icon: string; title: string; text: string }[]): string {
  const rows = items
    .map(
      (it) => `<tr>
    <td width="44" valign="top" style="padding:0 14px 18px 0">
      <div style="width:40px;height:40px;line-height:40px;border-radius:12px;background:#fff7ed;text-align:center;font-size:19px">${it.icon}</div>
    </td>
    <td valign="top" style="padding:0 0 18px 0;font-family:${FONT}">
      <div style="font-size:15px;font-weight:700;color:${BRAND.ink};line-height:20px">${esc(it.title)}</div>
      <div style="font-size:14px;color:${BRAND.muted};line-height:21px;padding-top:2px">${esc(it.text)}</div>
    </td>
  </tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`
}

/** Numbered steps (1, 2, 3). */
export function steps(items: { title: string; text: string }[]): string {
  const rows = items
    .map(
      (it, i) => `<tr>
    <td width="40" valign="top" style="padding:0 14px 16px 0">
      <div style="width:30px;height:30px;line-height:30px;border-radius:50%;background:${BRAND.ink};color:#ffffff;text-align:center;font-family:${FONT};font-size:14px;font-weight:700">${i + 1}</div>
    </td>
    <td valign="top" style="padding:3px 0 16px 0;font-family:${FONT}">
      <div style="font-size:15px;font-weight:700;color:${BRAND.ink};line-height:20px">${esc(it.title)}</div>
      <div style="font-size:14px;color:${BRAND.muted};line-height:21px;padding-top:2px">${esc(it.text)}</div>
    </td>
  </tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`
}

/** Soft box with a label, e.g. an account status. `tone` changes the accent colour. */
export function callout(title: string, text: string, tone: 'orange' | 'green' | 'slate' = 'slate'): string {
  const c = { orange: ['#fff7ed', '#fed7aa', '#9a3412'], green: ['#f0fdf4', '#bbf7d0', '#166534'], slate: [BRAND.soft, BRAND.line, BRAND.ink] }[tone]
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">
  <tr><td style="background:${c[0]};border:1px solid ${c[1]};border-radius:14px;padding:16px 18px;font-family:${FONT}">
    <div style="font-size:14px;font-weight:700;color:${c[2]};line-height:20px">${esc(title)}</div>
    <div style="font-size:14px;color:${BRAND.text};line-height:21px;padding-top:4px">${text}</div>
  </td></tr>
</table>`
}

export const divider = `<div style="height:1px;line-height:1px;background:${BRAND.line};margin:28px 0">&nbsp;</div>`

export const heading = (text: string) =>
  `<div style="font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.muted};padding-bottom:16px">${esc(text)}</div>`

export const paragraph = (html: string) =>
  `<p style="margin:0 0 14px;font-family:${FONT};font-size:16px;line-height:26px;color:${BRAND.text}">${html}</p>`

export interface EmailLayout {
  /** Grey text shown next to the subject in the inbox list */
  preheader: string
  /** Small orange label above the title */
  eyebrow: string
  /** Main title (already escaped / trusted HTML) */
  title: string
  /** Main content (trusted HTML built with the helpers above) */
  body: string
  /** Small grey note under the card, e.g. "you got this because ..." (trusted HTML) */
  footnote?: string
  siteUrl: string
  supportEmail: string
  companyName?: string
}

/** Wrap content in the Honic email frame (logo header, white card, footer). */
export function renderEmail(o: EmailLayout): string {
  const name = esc(o.companyName || 'Honic')
  const site = safeUrl(o.siteUrl)
  const support = esc(o.supportEmail)
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(o.eyebrow)}</title>
<style>
  @media only screen and (max-width:600px){
    .card{padding:28px 22px !important;border-radius:0 !important}
    .title{font-size:25px !important;line-height:32px !important}
    .outer{padding:0 !important}
    .edge{padding-left:18px !important;padding-right:18px !important}
    .logo{padding:18px 18px 14px !important}
  }
  a{color:${BRAND.orange}}
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(o.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.page}" style="background:${BRAND.page}">
<tr><td align="center" class="outer" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
    <!-- logo -->
    <tr><td class="logo" style="padding:0 4px 20px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="36" height="36" align="center" valign="middle" bgcolor="${BRAND.orange}" style="width:36px;height:36px;border-radius:10px;background:${BRAND.orange};background-image:linear-gradient(135deg,${BRAND.orangeLight},${BRAND.orange});font-family:${FONT};font-size:19px;font-weight:800;color:#ffffff;line-height:36px">H</td>
        <td style="padding-left:10px;font-family:${FONT};font-size:19px;font-weight:800;color:${BRAND.ink};letter-spacing:-.01em"><a href="${site}" style="color:${BRAND.ink};text-decoration:none">${name}</a></td>
      </tr></table>
    </td></tr>
    <!-- card -->
    <tr><td class="card" bgcolor="#ffffff" style="background:#ffffff;border-radius:20px;padding:40px 40px 32px;border-top:4px solid ${BRAND.orange}">
      <div style="font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.orange};padding-bottom:10px">${esc(o.eyebrow)}</div>
      <h1 class="title" style="margin:0 0 18px;font-family:${FONT};font-size:30px;line-height:38px;font-weight:800;color:${BRAND.ink};letter-spacing:-.02em">${o.title}</h1>
      ${o.body}
    </td></tr>
    ${o.footnote ? `<tr><td class="edge" style="padding:20px 8px 0;font-family:${FONT};font-size:13px;line-height:20px;color:${BRAND.muted};text-align:center">${o.footnote}</td></tr>` : ''}
    <!-- footer -->
    <tr><td class="edge" style="padding:24px 8px 24px;font-family:${FONT};font-size:12px;line-height:19px;color:#94a3b8;text-align:center">
      ${name} &middot; Tanzania&rsquo;s online marketplace<br>
      Questions? <a href="mailto:${support}" style="color:${BRAND.muted};text-decoration:underline">${support}</a> &middot; <a href="${site}" style="color:${BRAND.muted};text-decoration:underline">Visit the store</a><br>
      &copy; ${year} ${name}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}


/** Money for emails: TSh 98,000 */
export const tzs = (n: number) => `TSh ${Math.round(Number(n) || 0).toLocaleString('en-US')}`

/** Label / value rows (order number, date, payment...). Values are escaped. */
export function details(rows: [string, string][]): string {
  const tr = rows.filter(([, v]) => v).map(([k, v]) => `<tr>
    <td style="padding:7px 0;font-family:${FONT};font-size:14px;color:${BRAND.muted}">${esc(k)}</td>
    <td align="right" style="padding:7px 0;font-family:${FONT};font-size:14px;font-weight:700;color:${BRAND.ink}">${esc(v)}</td>
  </tr>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;border-top:1px solid ${BRAND.line};border-bottom:1px solid ${BRAND.line}">${tr}</table>`
}

/** Item lines with quantity, plus totals. Names are escaped. */
export function itemTable(items: { name: string; quantity: number; price?: number; total?: number }[], totals: [string, string, boolean?][] = []): string {
  const rows = items.map((it) => `<tr>
    <td style="padding:12px 0;border-bottom:1px solid ${BRAND.line};font-family:${FONT}">
      <div style="font-size:15px;font-weight:600;color:${BRAND.ink};line-height:21px">${esc(it.name)}</div>
      <div style="font-size:13px;color:${BRAND.muted};padding-top:2px">Qty ${esc(it.quantity)}${it.price != null ? ` &times; ${esc(tzs(it.price))}` : ''}</div>
    </td>
    <td align="right" valign="top" style="padding:12px 0 12px 12px;border-bottom:1px solid ${BRAND.line};font-family:${FONT};font-size:15px;font-weight:700;color:${BRAND.ink};white-space:nowrap">${it.total != null ? esc(tzs(it.total)) : ''}</td>
  </tr>`).join('')
  const sums = totals.map(([k, v, strong]) => `<tr>
    <td style="padding:${strong ? '12px' : '6px'} 0 0;font-family:${FONT};font-size:${strong ? 17 : 14}px;font-weight:${strong ? 800 : 400};color:${strong ? BRAND.ink : BRAND.muted}">${esc(k)}</td>
    <td align="right" style="padding:${strong ? '12px' : '6px'} 0 0;font-family:${FONT};font-size:${strong ? 17 : 14}px;font-weight:${strong ? 800 : 600};color:${BRAND.ink};white-space:nowrap">${esc(v)}</td>
  </tr>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px">${rows}${sums}</table>`
}

/** Product card: image (when it is a public https URL), name, price line. */
export function productCard(p: { name: string; image?: string; priceHtml: string; url: string }): string {
  const img = p.image && /^https:\/\//i.test(p.image)
    ? `<td width="96" valign="top" style="padding-right:16px"><a href="${safeUrl(p.url)}"><img src="${esc(p.image)}" width="96" height="96" alt="" style="display:block;width:96px;height:96px;object-fit:contain;border-radius:12px;border:1px solid ${BRAND.line};background:#ffffff"></a></td>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;border:1px solid ${BRAND.line};border-radius:16px"><tr><td style="padding:16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${img}
      <td valign="top" style="font-family:${FONT}">
        <a href="${safeUrl(p.url)}" style="font-size:16px;font-weight:700;color:${BRAND.ink};line-height:22px;text-decoration:none">${esc(p.name)}</a>
        <div style="padding-top:8px;font-size:15px;line-height:22px;color:${BRAND.text}">${p.priceHtml}</div>
      </td>
    </tr></table>
  </td></tr></table>`
}

/** Big one-time code. */
export function codeBox(code: string): string {
  return `<div style="margin:24px 0;padding:18px;border-radius:14px;background:${BRAND.soft};border:1px dashed ${BRAND.line};text-align:center;font-family:'SFMono-Regular',Consolas,monospace;font-size:32px;font-weight:800;letter-spacing:.3em;color:${BRAND.ink}">${esc(code)}</div>`
}
