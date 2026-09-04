import assert from 'node:assert/strict';
import {
  getUserLoginSecurityState,
  recordUserLoginFailure,
  clearUserLoginFailure,
  consumeCaptchaTicket,
} from '../server/utils/userLoginSecurity.ts';
import { issueCaptchaTicket } from '../server/utils/adminLoginSecurity.ts';

console.log('--- 开始前台用户登录安全与滑块防爆破守卫测试 ---');

const testEmail = 'customer_sec_' + Date.now() + '@example.com';
const attackerIp = '198.51.100.1';
const normalUserIp = '203.0.113.88';

clearUserLoginFailure(attackerIp, testEmail);
clearUserLoginFailure(normalUserIp, testEmail);

// 1. 初始状态检查
let state = getUserLoginSecurityState(attackerIp, testEmail);
assert.equal(state.attempts, 0);
assert.equal(state.requiresCaptcha, false);
assert.equal(state.isLocked, false);

// 2. 第 1 次与第 2 次失败（容错宽容期）
state = recordUserLoginFailure(attackerIp, testEmail);
assert.equal(state.attempts, 1);
assert.equal(state.requiresCaptcha, false, '前台输错第 1 次不应弹滑块');

state = recordUserLoginFailure(attackerIp, testEmail);
assert.equal(state.attempts, 2);
assert.equal(state.requiresCaptcha, false, '前台输错第 2 次不应弹滑块');

// 3. 第 3 次失败（触发滑块人机挑战）
state = recordUserLoginFailure(attackerIp, testEmail);
assert.equal(state.attempts, 3);
assert.equal(state.requiresCaptcha, true, '前台输错第 3 次必须触发滑块');
assert.equal(state.isLocked, false);

// 4. 第 4 次失败
state = recordUserLoginFailure(attackerIp, testEmail);
assert.equal(state.attempts, 4);
assert.equal(state.requiresCaptcha, true);
assert.equal(state.isLocked, false);

// 5. 第 5 次失败（触发临时锁定）
state = recordUserLoginFailure(attackerIp, testEmail);
assert.equal(state.attempts, 5);
assert.equal(state.isLocked, true, '前台连续输错 5 次必须锁定当前 IP');
assert.ok(state.lockRemainingMs > 0);
console.log('✓ 阶梯式防护（0~2宽容、3滑块、5锁定）校验通过');

// 6. 核心指标：多 IP 隔离测试（防止针对真实客户的 DoS 骚扰攻击）
const normalState = getUserLoginSecurityState(normalUserIp, testEmail);
assert.equal(normalState.isLocked, false, '黑客 IP 恶意爆破不得导致正常用户 IP 被锁定');
assert.equal(normalState.requiresCaptcha, false, '正常用户 IP 不受黑客 IP 失败次数污染');
console.log('✓ IP + Email 联合隔离（防 DoS 骚扰）校验通过');

// 7. 验证成功清除失败计数
clearUserLoginFailure(attackerIp, testEmail);
state = getUserLoginSecurityState(attackerIp, testEmail);
assert.equal(state.attempts, 0);
assert.equal(state.isLocked, false);
assert.equal(state.requiresCaptcha, false);
console.log('✓ 登录成功后失败状态重置校验通过');

// 8. Ticket 消费与防重放
const ticket = issueCaptchaTicket(normalUserIp);
assert.equal(consumeCaptchaTicket(ticket, normalUserIp), true, '合法 Ticket 首次消费必须成功');
assert.equal(consumeCaptchaTicket(ticket, normalUserIp), false, 'Ticket 二次消费必须被拦截（防重放）');
console.log('✓ 用户端 Ticket 消费与防重放校验通过');

console.log('\nAll customer login security checks PASSED successfully!');
