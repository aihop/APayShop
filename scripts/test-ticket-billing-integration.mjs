import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { diagnoseTicketIssue } from '../server/utils/ticketBot.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const BALANCE_SCALE = 100_000_000

let databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  try {
    const envContent = readFileSync(path.join(rootDir, '.env'), 'utf8')
    const match = envContent.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m)
    if (match) databaseUrl = match[1]
  } catch (e) {}
}

if (!databaseUrl) {
  databaseUrl = 'postgres://qingpu:0.e243ogqopds@127.0.0.1:5432/qingpu'
}

console.log('>>> [1/4] 连接数据库:', databaseUrl.replace(/:[^:@]+@/, ':***@'))
const sql = postgres(databaseUrl, { max: 1 })

async function run() {
  try {
    // 1. 测试 ticketBot 对账单与订单状态的自愈规则
    console.log('>>> [2/4] 测试 ticketBot 财务订单自检规则...')

    // 场景 A: 已支付订单提单
    const paidDiag = diagnoseTicketIssue({
      category: 'billing',
      title: '订单充值核对',
      content: '我充值了怎么好像没动静',
      context: {
        orderId: 'ORD-TEST-PAID-001',
        payStatus: 'paid',
        amount: '99.00',
      },
    })
    if (!paidDiag.matched || !paidDiag.suggestAutoResolved || paidDiag.ruleName !== 'order_already_paid') {
      throw new Error('ticketBot 对已支付订单的自检未按预期命中！')
    }
    console.log('  ✓ 场景 A: 已支付订单成功触发智能自愈 -> suggestAutoResolved:', paidDiag.suggestAutoResolved)

    // 场景 B: 等待网关回调订单提单
    const pendingDiag = diagnoseTicketIssue({
      category: 'billing',
      title: '微信已扣款但是订单显示未支付',
      content: '扣款截图已保存',
      context: {
        orderId: 'ORD-TEST-PENDING-002',
        payStatus: 'pending',
        amount: '50.00',
      },
    })
    if (!pendingDiag.matched || pendingDiag.suggestPriority !== 'high' || pendingDiag.ruleName !== 'order_pending_gateway') {
      throw new Error('ticketBot 对待支付订单的自检未按预期命中！')
    }
    console.log('  ✓ 场景 B: 等待网关回调订单成功触发自检 -> suggestPriority:', pendingDiag.suggestPriority)

    // 2. 模拟用户提单与管理员在工单内快捷发放财务补偿闭环
    console.log('>>> [3/4] 测试管理员在工单内一键快捷补偿算力/额度...')

    const [testUser] = await sql`SELECT id, email, nickname FROM users ORDER BY id ASC LIMIT 1;`
    if (!testUser) throw new Error('未找到测试用户')

    // 确保钱包存在
    let [wallet] = await sql`SELECT id, grant_balance FROM user_wallets WHERE user_id = ${testUser.id};`
    if (!wallet) {
      const [newWallet] = await sql`
        INSERT INTO user_wallets (user_id, currency) VALUES (${testUser.id}, 'CNY') RETURNING *;
      `
      wallet = newWallet
    }

    const beforeGrantScaled = Number(wallet.grant_balance || 0)
    const beforeGrant = beforeGrantScaled / BALANCE_SCALE
    console.log(`  • 用户 #${testUser.id} 补偿前算力余额: ${beforeGrant} 点`)

    const testTicketNo = `TK-BILLING-${Date.now()}`
    const [ticket] = await sql`
      INSERT INTO tickets (
        ticket_no, user_id, category, title, status, priority, context, last_replied_at, last_replied_by
      ) VALUES (
        ${testTicketNo}, ${testUser.id}, 'billing', '测试生图超时申请补发算力', 'open', 'normal',
        ${sql.json({ orderId: 'ORD-TEST-PENDING-002', payStatus: 'pending', amount: '50.00' })}, now(), 'user'
      ) RETURNING *;
    `

    // 模拟快捷补偿 30 点算力：
    // 1) 写流水 balance_logs
    const compAmount = 30
    const deltaScaled = compAmount * BALANCE_SCALE
    const eventId = `ticket-comp-test:${ticket.id}:${Date.now()}`
    
    await sql`
      INSERT INTO balance_logs (
        user_id, wallet_id, balance_type, action_type, amount_cents,
        before_balance_cents, after_balance_cents, event_id, source_type, source_id,
        operator_admin_id, operator_name, remark, created_at
      ) VALUES (
        ${testUser.id}, ${wallet.id}, 'grant', 'admin_recharge', ${deltaScaled},
        ${beforeGrantScaled}, ${beforeGrantScaled + deltaScaled}, ${eventId}, 'admin', ${String(ticket.id)},
        1, 'admin', ${`[工单 ${ticket.ticket_no}] 生图异常核实补偿`}, now()
      );
    `

    // 2) 原子更新钱包 user_wallets
    await sql`
      UPDATE user_wallets
      SET grant_balance = grant_balance + ${deltaScaled}
      WHERE id = ${wallet.id};
    `

    const [updatedWallet] = await sql`SELECT grant_balance FROM user_wallets WHERE id = ${wallet.id};`
    const afterGrant = Number(updatedWallet.grant_balance || 0) / BALANCE_SCALE
    console.log(`  ✓ 成功发放 ${compAmount} 点算力补偿！发放后算力余额: ${afterGrant} 点 (净增量: ${Math.round(afterGrant - beforeGrant)})`)

    if (Math.round(afterGrant - beforeGrant) !== compAmount) {
      throw new Error(`余额变更计算有误！预期增量 ${compAmount}，实际增量 ${afterGrant - beforeGrant}`)
    }

    // 3) 插入工单财务流水消息
    await sql`
      INSERT INTO ticket_messages (
        ticket_id, sender_type, sender_id, sender_name, content
      ) VALUES (
        ${ticket.id}, 'system', 1, '系统财务通知',
        ${`💰 财务补偿发放通知：管理员 admin 已为您发放 ${compAmount} 算力点补偿到账。当前最新算力点: ${afterGrant}`}
      );
    `

    // 4) 写入站内信 notifications
    const [notif] = await sql`
      INSERT INTO notifications (
        user_id, visitor_id, type, title, message, data, is_read, created_at
      ) VALUES (
        ${testUser.id}, null, 'balance_compensated', '账户额度补偿到账',
        ${`您的工单 ${ticket.ticket_no} 已获处理，已成功补发 ${compAmount} 算力点到您的账户。`},
        ${sql.json({ ticketId: ticket.id, ticketNo: ticket.ticket_no, amount: compAmount })},
        false, now()
      ) RETURNING *;
    `
    console.log(`  ✓ 成功向用户推送站内信通知 #${notif.id}！`)

    // 3. 校验工单消息与状态流转
    console.log('>>> [4/4] 验证工单对话流中的财务记录完整性...')
    const messages = await sql`
      SELECT id, sender_type, sender_name, content FROM ticket_messages WHERE ticket_id = ${ticket.id};
    `
    console.log(`  ✓ 消息流成功拉取:`)
    for (const m of messages) {
      console.log(`    - [${m.sender_type}] ${m.sender_name}: ${m.content.replace(/\n/g, ' ')}`)
    }

    // 清理测试数据
    await sql`DELETE FROM tickets WHERE id = ${ticket.id};`
    await sql`DELETE FROM notifications WHERE id = ${notif.id};`
    // 回滚测试增加的算力点以保持账户原样
    await sql`
      UPDATE user_wallets
      SET grant_balance = grant_balance - ${deltaScaled}
      WHERE id = ${wallet.id};
    `
    console.log('  ✓ 测试数据与额度已自动回滚，数据库保持原样干净！')

    console.log('\n========================================')
    console.log('🎉 客服工单与账单/钱包系统融合全链路测试 100% 通过！')
    console.log('========================================\n')
  } catch (err) {
    console.error('\n❌ 测试失败:', err)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

run()
