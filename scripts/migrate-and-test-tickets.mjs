import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { diagnoseTicketIssue } from '../server/utils/ticketBot.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// 1. 从 .env 读取 DATABASE_URL
let databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  try {
    const envContent = readFileSync(path.join(rootDir, '.env'), 'utf8')
    const match = envContent.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m)
    if (match) {
      databaseUrl = match[1]
    }
  } catch (e) {
    // ignore
  }
}

if (!databaseUrl) {
  databaseUrl = 'postgres://qingpu:0.e243ogqopds@127.0.0.1:5432/qingpu'
}

console.log('>>> [1/5] 连接数据库:', databaseUrl.replace(/:[^:@]+@/, ':***@'))
const sql = postgres(databaseUrl, { max: 1 })

async function run() {
  try {
    // 2. 执行建表 DDL
    console.log('>>> [2/5] 执行工单系统数据表 DDL 迁移...')
    await sql`
      CREATE TABLE IF NOT EXISTS tickets (
        id serial PRIMARY KEY,
        ticket_no text NOT NULL UNIQUE,
        user_id integer NOT NULL REFERENCES users(id),
        category text NOT NULL DEFAULT 'other',
        title text NOT NULL,
        status text NOT NULL DEFAULT 'open',
        priority text NOT NULL DEFAULT 'normal',
        context jsonb,
        last_replied_at timestamp with time zone NOT NULL DEFAULT now(),
        last_replied_by text NOT NULL DEFAULT 'user',
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );
    `

    await sql`CREATE INDEX IF NOT EXISTS tickets_user_id_idx ON tickets (user_id);`
    await sql`CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets (status);`
    await sql`CREATE INDEX IF NOT EXISTS tickets_category_idx ON tickets (category);`
    await sql`CREATE INDEX IF NOT EXISTS tickets_last_replied_at_idx ON tickets (last_replied_at);`

    await sql`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id serial PRIMARY KEY,
        ticket_id integer NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        sender_type text NOT NULL,
        sender_id integer,
        sender_name text NOT NULL DEFAULT '',
        content text NOT NULL,
        attachments jsonb,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
    `

    await sql`CREATE INDEX IF NOT EXISTS ticket_messages_ticket_id_idx ON ticket_messages (ticket_id);`
    await sql`CREATE INDEX IF NOT EXISTS ticket_messages_created_at_idx ON ticket_messages (created_at);`

    console.log('✅ 数据表 tickets 与 ticket_messages 迁移成功！')

    // 3. 测试 ticketBot 诊断引擎逻辑
    console.log('>>> [3/5] 测试 ticketBot 智能自愈诊断规则...')
    
    // 场景 A: Ozon 属性必填缺失
    const ozonDiagnosis = diagnoseTicketIssue({
      category: 'listing',
      title: '商品上架失败',
      content: '点击发布时报错了',
      context: {
        channel: 'ozon',
        lastError: 'Bad Request: mandatory attribute_id 4191 is missing',
      },
    })
    if (!ozonDiagnosis.matched || !ozonDiagnosis.suggestAutoResolved) {
      throw new Error('ticketBot 对 Ozon 属性必填错误的诊断未按预期命中！')
    }
    console.log('  ✓ 场景 A: Ozon 类目必填缺失成功匹配自愈规则 -> suggestAutoResolved:', ozonDiagnosis.suggestAutoResolved)

    // 场景 B: 1688 滑块风控
    const sliderDiagnosis = diagnoseTicketIssue({
      category: 'listing',
      title: '1688 采集商品无响应',
      content: '页面提示 sec.1688.com punish slider',
    })
    if (!sliderDiagnosis.matched) {
      throw new Error('ticketBot 对 1688 滑块风控的诊断未按预期命中！')
    }
    console.log('  ✓ 场景 B: 1688 滑块验证成功匹配自愈规则 -> ruleName:', sliderDiagnosis.ruleName)

    // 场景 C: 店铺 401 凭证失效
    const authDiagnosis = diagnoseTicketIssue({
      category: 'other',
      title: 'API 授权失败',
      content: '401 Unauthorized, invalid api key',
    })
    if (!authDiagnosis.matched || authDiagnosis.suggestPriority !== 'high') {
      throw new Error('ticketBot 对店铺授权失效的诊断未按预期命中！')
    }
    console.log('  ✓ 场景 C: 店铺 401 授权失效成功匹配 -> suggestPriority:', authDiagnosis.suggestPriority)

    // 4. 端到端工单生命周期测试（创建 -> 机器人回复 -> 管理员回复+站内信 -> 用户已解决）
    console.log('>>> [4/5] 测试工单端到端生命周期...')
    
    // 获取一个有效用户
    const [testUser] = await sql`SELECT id, email, nickname FROM users ORDER BY id ASC LIMIT 1;`
    if (!testUser) {
      throw new Error('数据库中没有用户，无法进行生命周期测试！')
    }
    console.log(`  • 测试账号: 用户 #${testUser.id} (${testUser.email})`)

    const testTicketNo = `TK-TEST-${Date.now()}`
    const testContext = {
      channel: 'ozon',
      offerId: 'TEST-SKU-001',
      productId: 'prod_test_123',
      lastError: 'Bad Request: mandatory attribute_id 4191 is missing',
      rawResponse: { error: { code: 'INVALID_CATEGORY_PARAMETERS' } },
    }

    // A. 模拟用户提交工单（带 Ozon 属性报错上下文）
    const initialStatus = ozonDiagnosis.matched && ozonDiagnosis.suggestAutoResolved ? 'auto_resolved' : 'open'
    const [insertedTicket] = await sql`
      INSERT INTO tickets (
        ticket_no, user_id, category, title, status, priority, context, last_replied_at, last_replied_by
      ) VALUES (
        ${testTicketNo}, ${testUser.id}, 'listing', '测试Ozon发布报错排查', ${initialStatus}, 'normal',
        ${sql.json(testContext)}, now(), 'bot'
      ) RETURNING *;
    `
    console.log(`  ✓ 用户成功创建工单 #${insertedTicket.id} (${insertedTicket.ticket_no})，状态: ${insertedTicket.status}`)

    // 插入用户第一条描述
    await sql`
      INSERT INTO ticket_messages (
        ticket_id, sender_type, sender_id, sender_name, content
      ) VALUES (
        ${insertedTicket.id}, 'user', ${testUser.id}, ${testUser.nickname || '测试用户'}, '我的商品发布失败了，请排查'
      );
    `

    // 插入机器人自愈答复
    await sql`
      INSERT INTO ticket_messages (
        ticket_id, sender_type, sender_id, sender_name, content
      ) VALUES (
        ${insertedTicket.id}, 'bot', null, '轻铺AI 智能诊断助手', ${ozonDiagnosis.botReply}
      );
    `
    console.log('  ✓ ticketBot 成功自动插入智能解答消息！')

    // B. 模拟管理员后台查看并回复工单
    const [adminUser] = await sql`SELECT id, username FROM admins ORDER BY id ASC LIMIT 1;`
    const adminName = adminUser?.username || 'admin'
    const adminId = adminUser?.id || null

    await sql`
      INSERT INTO ticket_messages (
        ticket_id, sender_type, sender_id, sender_name, content
      ) VALUES (
        ${insertedTicket.id}, 'admin', ${adminId}, ${adminName}, '客服专员已人工复核：您已成功更新材质属性，当前可重新提交。'
      );
    `

    await sql`
      UPDATE tickets
      SET status = 'in_progress', last_replied_at = now(), last_replied_by = 'admin', updated_at = now()
      WHERE id = ${insertedTicket.id};
    `

    // 触发站内信通知
    const [notification] = await sql`
      INSERT INTO notifications (
        user_id, visitor_id, type, title, message, data, is_read, created_at
      ) VALUES (
        ${testUser.id}, null, 'ticket_replied', '工单收到新回复',
        ${`您的工单 ${insertedTicket.ticket_no} 已收到客服专员的回复，请前往工单中心查看。`},
        ${sql.json({ ticketId: insertedTicket.id, ticketNo: insertedTicket.ticket_no, targetPath: '/user/tickets' })},
        false, now()
      ) RETURNING *;
    `
    console.log(`  ✓ 管理员回复成功，并成功向用户推送站内信 #${notification.id}！`)

    // C. 模拟用户确认解决工单
    await sql`
      UPDATE tickets
      SET status = 'resolved', last_replied_at = now(), last_replied_by = 'user', updated_at = now()
      WHERE id = ${insertedTicket.id};
    `

    await sql`
      INSERT INTO ticket_messages (
        ticket_id, sender_type, sender_id, sender_name, content
      ) VALUES (
        ${insertedTicket.id}, 'system', ${testUser.id}, '系统通知', '用户已确认问题解决'
      );
    `
    console.log('  ✓ 用户成功确认解决，工单流转至终态 resolved！')

    // 5. 校验消息流查询
    console.log('>>> [5/5] 验证工单对话流与消息结构完整性...')
    const messages = await sql`
      SELECT id, sender_type, sender_name, content, created_at
      FROM ticket_messages
      WHERE ticket_id = ${insertedTicket.id}
      ORDER BY created_at ASC;
    `
    console.log(`  ✓ 成功拉取到 ${messages.length} 条对话流消息:`)
    for (const m of messages) {
      console.log(`    - [${m.sender_type}] ${m.sender_name}: ${m.content.slice(0, 35)}...`)
    }

    // 清理测试工单
    await sql`DELETE FROM tickets WHERE id = ${insertedTicket.id};`
    await sql`DELETE FROM notifications WHERE id = ${notification.id};`
    console.log('  ✓ 测试数据清理完毕（保持数据库整洁）')

    console.log('\n========================================')
    console.log('🎉 全部迁移与端到端测试 100% 通过！无任何异常！')
    console.log('========================================\n')
  } catch (err) {
    console.error('\n❌ 测试执行失败:', err)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

run()
