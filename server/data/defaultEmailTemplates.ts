export interface EmailTemplatePreset {
  code: string
  name: string
  subject: string
  variables: string[]
  html: string
}

// ==========================================
// Brand design tokens (dark, premium, geek)
// ==========================================
const brand = {
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

function makeHeader(title: string): string {
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

function makeFooter(siteName: string): string {
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

function makeTableWrapper(content: string): string {
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
        <p style="margin:16px 0 0;font-size:11px;color:${brand.textMuted}">${'{{site_name}}'} &mdash; Powered by APayShop</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function makeButton(url: string, label: string, variant: 'primary' | 'success' | 'warning' = 'primary'): string {
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

function makeDivider(): string {
  return `<tr><td style="padding:0 36px"><div style="height:1px;background:${brand.border};margin:0"></div></td></tr>`
}

function makeInfoRow(label: string, value: string, isLast = false): string {
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

function makeInfoCard(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${brand.bgCardAlt};border-radius:12px;margin:20px 0;border:1px solid ${brand.border};overflow:hidden">
    ${rows}
  </table>`
}

// ========================================
// English Templates
// ========================================
export const defaultEmailTemplates: EmailTemplatePreset[] = [
  // --- Welcome ---
  {
    code: 'welcome-en',
    name: 'Welcome (English)',
    subject: 'Welcome to {{site_name}}!',
    variables: ['nickname', 'site_name', 'site_url'],
    html: makeTableWrapper(`
      ${makeHeader('Welcome Aboard!')}
      <tr>
        <td style="padding:36px 36px 28px">
          <p style="margin:0 0 16px;font-size:16px;color:${brand.textPrimary};line-height:1.7">Hi <strong>{{nickname}}</strong>,</p>
          <p style="margin:0 0 8px;font-size:15px;color:${brand.textSecondary};line-height:1.7">Thanks for joining <strong>{{site_name}}</strong>! We're stoked to have you on board.</p>
          <p style="margin:0 0 8px;font-size:15px;color:${brand.textSecondary};line-height:1.7">Here's what you can do next:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 8px">
            <tr>
              <td style="padding:4px 0">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:20px;vertical-align:top;padding-top:3px"><span style="color:${brand.accentLight};font-size:14px">&#9656;</span></td>
                    <td style="font-size:14px;color:${brand.textSecondary};line-height:1.6">Browse and purchase our products</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:20px;vertical-align:top;padding-top:3px"><span style="color:${brand.accentLight};font-size:14px">&#9656;</span></td>
                    <td style="font-size:14px;color:${brand.textSecondary};line-height:1.6">Track your orders in real-time</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:20px;vertical-align:top;padding-top:3px"><span style="color:${brand.accentLight};font-size:14px">&#9656;</span></td>
                    <td style="font-size:14px;color:${brand.textSecondary};line-height:1.6">Manage your account and subscription</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ${makeButton('{{site_url}}/user/dashboard', 'Go to Dashboard', 'primary')}
        </td>
      </tr>
      ${makeFooter('{{site_name}}')}
    `),
  },

  // --- Email Verification ---
  {
    code: 'verify_email-en',
    name: 'Verify Email (English)',
    subject: 'Verify your email - {{site_name}}',
    variables: ['nickname', 'verify_link', 'site_name', 'site_url'],
    html: makeTableWrapper(`
      ${makeHeader('Verify Your Email')}
      <tr>
        <td style="padding:36px 36px 28px">
          <p style="margin:0 0 16px;font-size:16px;color:${brand.textPrimary};line-height:1.7">Hi <strong>{{nickname}}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:${brand.textSecondary};line-height:1.7">You're almost there! Please verify your email address to activate your account and get started.</p>
          ${makeButton('{{verify_link}}', 'Verify Email Address', 'primary')}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;background:rgba(251,191,36,0.08);border-radius:10px;border:1px solid rgba(251,191,36,0.2)">
            <tr>
              <td style="padding:14px 18px">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:24px;vertical-align:top;padding-top:1px"><span style="font-size:16px">&#9200;</span></td>
                    <td style="font-size:13px;color:${brand.textSecondary};line-height:1.6">This link expires in <strong style="color:${brand.textPrimary}">24 hours</strong>. If you didn't create an account at {{site_name}}, please ignore this email.</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${makeFooter('{{site_name}}')}
    `),
  },

  // --- Order Success ---
  {
    code: 'order_success-en',
    name: 'Order Success (English)',
    subject: 'Payment Successful - Order #{{order_id}}',
    variables: ['nickname', 'order_id', 'product_name', 'amount', 'site_name', 'site_url'],
    html: makeTableWrapper(`
      ${makeHeader('Payment Successful!')}
      <tr>
        <td style="padding:36px 36px 28px">
          <p style="margin:0 0 16px;font-size:16px;color:${brand.textPrimary};line-height:1.7">Hi <strong>{{nickname}}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:${brand.textSecondary};line-height:1.7">Your order has been confirmed and paid successfully. Here's a quick summary:</p>
          ${makeInfoCard(`
            ${makeInfoRow('Order #', '{{order_id}}')}
            ${makeInfoRow('Product', '{{product_name}}')}
            ${makeInfoRow('Amount Paid', '{{amount}}', true)}
          `)}
          ${makeButton('{{site_url}}/user/orders/{{order_id}}', 'View Order Details', 'success')}
        </td>
      </tr>
      ${makeFooter('{{site_name}}')}
    `),
  },

  {
    code: 'order_pending-en',
    name: 'Pending Payment (English)',
    subject: 'Complete Your Payment - Order #{{order_id}}',
    variables: ['nickname', 'order_id', 'product_name', 'amount', 'site_name', 'site_url', 'payment_link'],
    html: makeTableWrapper(`
      ${makeHeader('Finish Your Payment')}
      <tr>
        <td style="padding:36px 36px 28px">
          <p style="margin:0 0 16px;font-size:16px;color:${brand.textPrimary};line-height:1.7">Hi <strong>{{nickname}}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:${brand.textSecondary};line-height:1.7">Your order has been created and is waiting for payment. You can reopen the payment page anytime from the link below.</p>
          ${makeInfoCard(`
            ${makeInfoRow('Order #', '{{order_id}}')}
            ${makeInfoRow('Product', '{{product_name}}')}
            ${makeInfoRow('Amount Due', '{{amount}}', true)}
          `)}
          ${makeButton('{{payment_link}}', 'Continue To Payment', 'warning')}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;background:rgba(139,92,246,0.08);border-radius:10px;border:1px solid rgba(139,92,246,0.2)">
            <tr>
              <td style="padding:14px 18px;font-size:13px;color:${brand.textSecondary};line-height:1.7">
                If you already completed payment in another tab or device, you can ignore this reminder.
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${makeFooter('{{site_name}}')}
    `),
  },

  // --- Subscription Renewal ---
  {
    code: 'subscription_renewal-en',
    name: 'Subscription Renewal (English)',
    subject: 'Subscription Renewed - {{plan_name}}',
    variables: ['nickname', 'plan_name', 'expire_date', 'site_name', 'site_url'],
    html: makeTableWrapper(`
      ${makeHeader('Subscription Renewed')}
      <tr>
        <td style="padding:36px 36px 28px">
          <p style="margin:0 0 16px;font-size:16px;color:${brand.textPrimary};line-height:1.7">Hi <strong>{{nickname}}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:${brand.textSecondary};line-height:1.7">Your <strong style="color:${brand.textPrimary}">{{plan_name}}</strong> subscription has been renewed successfully. You're all set!</p>
          ${makeInfoCard(`
            ${makeInfoRow('Plan', '{{plan_name}}')}
            ${makeInfoRow('Next Billing Date', '{{expire_date}}', true)}
          `)}
          ${makeButton('{{site_url}}/user/subscription', 'Manage Subscription', 'primary')}
        </td>
      </tr>
      ${makeFooter('{{site_name}}')}
    `),
  },

  // --- Subscription Canceled ---
  {
    code: 'subscription_canceled-en',
    name: 'Subscription Canceled (English)',
    subject: 'Subscription Canceled - {{plan_name}}',
    variables: ['nickname', 'plan_name', 'expire_date', 'site_name', 'site_url'],
    html: makeTableWrapper(`
      ${makeHeader('Subscription Canceled')}
      <tr>
        <td style="padding:36px 36px 28px">
          <p style="margin:0 0 16px;font-size:16px;color:${brand.textPrimary};line-height:1.7">Hi <strong>{{nickname}}</strong>,</p>
          <p style="margin:0 0 8px;font-size:15px;color:${brand.textSecondary};line-height:1.7">Your <strong style="color:${brand.textPrimary}">{{plan_name}}</strong> subscription has been canceled as requested.</p>
          <p style="margin:0 0 20px;font-size:15px;color:${brand.textSecondary};line-height:1.7">You'll continue to have access until <strong style="color:${brand.textPrimary}">{{expire_date}}</strong>. After that, your account will be downgraded to the Free tier.</p>
          ${makeButton('{{site_url}}/user/subscription', 'Reactivate Subscription', 'warning')}
        </td>
      </tr>
      ${makeFooter('{{site_name}}')}
    `),
  },

  // ========================================
  // Chinese Templates
  // ========================================
  {
    code: 'welcome-zh',
    name: '欢迎邮件 (中文)',
    subject: '欢迎加入 {{site_name}}！',
    variables: ['nickname', 'site_name', 'site_url'],
    html: makeTableWrapper(`
      ${makeHeader('欢迎加入！')}
      <tr>
        <td style="padding:36px 36px 28px">
          <p style="margin:0 0 16px;font-size:16px;color:${brand.textPrimary};line-height:1.8">你好，<strong>{{nickname}}</strong>，</p>
          <p style="margin:0 0 8px;font-size:15px;color:${brand.textSecondary};line-height:1.8">感谢你加入 <strong>{{site_name}}</strong>！很高兴见到你。</p>
          <p style="margin:0 0 8px;font-size:15px;color:${brand.textSecondary};line-height:1.8">现在你可以：</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 8px">
            <tr>
              <td style="padding:4px 0">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:20px;vertical-align:top;padding-top:3px"><span style="color:${brand.accentLight};font-size:14px">&#9656;</span></td>
                    <td style="font-size:14px;color:${brand.textSecondary};line-height:1.8">浏览并购买各类商品</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:20px;vertical-align:top;padding-top:3px"><span style="color:${brand.accentLight};font-size:14px">&#9656;</span></td>
                    <td style="font-size:14px;color:${brand.textSecondary};line-height:1.8">实时追踪订单状态</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:20px;vertical-align:top;padding-top:3px"><span style="color:${brand.accentLight};font-size:14px">&#9656;</span></td>
                    <td style="font-size:14px;color:${brand.textSecondary};line-height:1.8">管理账户与订阅信息</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ${makeButton('{{site_url}}/user/dashboard', '进入个人中心', 'primary')}
        </td>
      </tr>
      ${makeFooter('{{site_name}}')}
    `),
  },

  {
    code: 'verify_email-zh',
    name: '邮箱验证 (中文)',
    subject: '验证您的邮箱 - {{site_name}}',
    variables: ['nickname', 'verify_link', 'site_name', 'site_url'],
    html: makeTableWrapper(`
      ${makeHeader('验证您的邮箱')}
      <tr>
        <td style="padding:36px 36px 28px">
          <p style="margin:0 0 16px;font-size:16px;color:${brand.textPrimary};line-height:1.8">你好，<strong>{{nickname}}</strong>，</p>
          <p style="margin:0 0 20px;font-size:15px;color:${brand.textSecondary};line-height:1.8">还差最后一步！请验证您的邮箱地址以激活账户：</p>
          ${makeButton('{{verify_link}}', '立即验证邮箱', 'primary')}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;background:rgba(251,191,36,0.08);border-radius:10px;border:1px solid rgba(251,191,36,0.2)">
            <tr>
              <td style="padding:14px 18px">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:24px;vertical-align:top;padding-top:1px"><span style="font-size:16px">&#9200;</span></td>
                    <td style="font-size:13px;color:${brand.textSecondary};line-height:1.8">此链接有效期 <strong style="color:${brand.textPrimary}">24 小时</strong>。如果您未在 {{site_name}} 注册，请忽略此邮件。</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${makeFooter('{{site_name}}')}
    `),
  },

  {
    code: 'order_success-zh',
    name: '下单成功 (中文)',
    subject: '支付成功 - 订单 #{{order_id}}',
    variables: ['nickname', 'order_id', 'product_name', 'amount', 'site_name', 'site_url'],
    html: makeTableWrapper(`
      ${makeHeader('支付成功！')}
      <tr>
        <td style="padding:36px 36px 28px">
          <p style="margin:0 0 16px;font-size:16px;color:${brand.textPrimary};line-height:1.8">你好，<strong>{{nickname}}</strong>，</p>
          <p style="margin:0 0 20px;font-size:15px;color:${brand.textSecondary};line-height:1.8">您的订单已确认并支付成功。订单摘要如下：</p>
          ${makeInfoCard(`
            ${makeInfoRow('订单号', '{{order_id}}')}
            ${makeInfoRow('商品', '{{product_name}}')}
            ${makeInfoRow('支付金额', '{{amount}}', true)}
          `)}
          ${makeButton('{{site_url}}/user/orders/{{order_id}}', '查看订单详情', 'success')}
        </td>
      </tr>
      ${makeFooter('{{site_name}}')}
    `),
  },

  {
    code: 'order_pending-zh',
    name: '待支付提醒 (中文)',
    subject: '请完成支付 - 订单 #{{order_id}}',
    variables: ['nickname', 'order_id', 'product_name', 'amount', 'site_name', 'site_url', 'payment_link'],
    html: makeTableWrapper(`
      ${makeHeader('继续完成支付')}
      <tr>
        <td style="padding:36px 36px 28px">
          <p style="margin:0 0 16px;font-size:16px;color:${brand.textPrimary};line-height:1.8">你好，<strong>{{nickname}}</strong>，</p>
          <p style="margin:0 0 20px;font-size:15px;color:${brand.textSecondary};line-height:1.8">您的订单已经创建，当前仍在等待支付。您可以通过下方链接随时回到支付页继续完成付款。</p>
          ${makeInfoCard(`
            ${makeInfoRow('订单号', '{{order_id}}')}
            ${makeInfoRow('商品', '{{product_name}}')}
            ${makeInfoRow('待支付金额', '{{amount}}', true)}
          `)}
          ${makeButton('{{payment_link}}', '继续支付', 'warning')}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;background:rgba(139,92,246,0.08);border-radius:10px;border:1px solid rgba(139,92,246,0.2)">
            <tr>
              <td style="padding:14px 18px;font-size:13px;color:${brand.textSecondary};line-height:1.8">
                如果您已经在其他页面或设备完成支付，可以忽略这封提醒邮件。
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${makeFooter('{{site_name}}')}
    `),
  },

  {
    code: 'subscription_renewal-zh',
    name: '续费通知 (中文)',
    subject: '订阅已续费 - {{plan_name}}',
    variables: ['nickname', 'plan_name', 'expire_date', 'site_name', 'site_url'],
    html: makeTableWrapper(`
      ${makeHeader('订阅已续费')}
      <tr>
        <td style="padding:36px 36px 28px">
          <p style="margin:0 0 16px;font-size:16px;color:${brand.textPrimary};line-height:1.8">你好，<strong>{{nickname}}</strong>，</p>
          <p style="margin:0 0 20px;font-size:15px;color:${brand.textSecondary};line-height:1.8">您的 <strong style="color:${brand.textPrimary}">{{plan_name}}</strong> 订阅已成功续费，一切正常！</p>
          ${makeInfoCard(`
            ${makeInfoRow('订阅套餐', '{{plan_name}}')}
            ${makeInfoRow('下次计费日期', '{{expire_date}}', true)}
          `)}
          ${makeButton('{{site_url}}/user/subscription', '管理订阅', 'primary')}
        </td>
      </tr>
      ${makeFooter('{{site_name}}')}
    `),
  },

  {
    code: 'subscription_canceled-zh',
    name: '退订通知 (中文)',
    subject: '订阅已取消 - {{plan_name}}',
    variables: ['nickname', 'plan_name', 'expire_date', 'site_name', 'site_url'],
    html: makeTableWrapper(`
      ${makeHeader('订阅已取消')}
      <tr>
        <td style="padding:36px 36px 28px">
          <p style="margin:0 0 16px;font-size:16px;color:${brand.textPrimary};line-height:1.8">你好，<strong>{{nickname}}</strong>，</p>
          <p style="margin:0 0 8px;font-size:15px;color:${brand.textSecondary};line-height:1.8">您的 <strong style="color:${brand.textPrimary}">{{plan_name}}</strong> 订阅已按请求取消。</p>
          <p style="margin:0 0 20px;font-size:15px;color:${brand.textSecondary};line-height:1.8">在 <strong style="color:${brand.textPrimary}">{{expire_date}}</strong> 之前，您仍然可以正常使用。到期后账户将自动降级为免费方案。</p>
          ${makeButton('{{site_url}}/user/subscription', '重新订阅', 'warning')}
        </td>
      </tr>
      ${makeFooter('{{site_name}}')}
    `),
  },
]
