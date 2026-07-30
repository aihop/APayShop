import {
  brand,
  makeButton,
  makeDivider,
  makeFooter,
  makeHeader,
  makeInfoCard,
  makeInfoRow,
  makeTableWrapper,
} from './emailTemplateBuilder'

export interface EmailTemplatePreset {
  code: string
  name: string
  subject: string
  variables: string[]
  html: string
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
          ${makeButton('{{site_url}}/callback/{{order_id}}', 'View Delivery', 'success')}
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
          ${makeButton('{{site_url}}/callback/{{order_id}}', '查看交付结果', 'success')}
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
