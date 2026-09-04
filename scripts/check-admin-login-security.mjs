import assert from 'node:assert/strict';
import {
  createCaptchaChallengeToken,
  verifyCaptchaChallengeToken,
  issueCaptchaTicket,
  consumeCaptchaTicket,
  getAdminLoginSecurityState,
  recordAdminLoginFailure,
  clearAdminLoginFailure,
  CAPTCHA_BACKGROUNDS,
  PUZZLE_PATH,
} from '../server/utils/adminLoginSecurity.ts';

console.log('--- 开始后台登录安全与滑块防爆破守卫测试 ---');

// 1. 验证背景图与拼图 Path
assert.ok(CAPTCHA_BACKGROUNDS.length >= 3, '必须提供至少3张内置矢量背景');
assert.ok(PUZZLE_PATH.startsWith('M '), '拼图凹凸路径格式必须正确');
console.log('✓ 背景资源与拼图形状基础校验通过');

// 2. 验证滑块挑战 Token 签发与解密防篡改
const mockChallenge = {
  x: 150,
  y: 45,
  bgIndex: 0,
  timestamp: Date.now(),
  nonce: 'test-nonce-123',
};
const token = createCaptchaChallengeToken(mockChallenge);
assert.ok(typeof token === 'string' && token.includes('.'), 'Token 必须由载荷和 HMAC 签名组成');

const parsed = verifyCaptchaChallengeToken(token);
assert.ok(parsed !== null, '有效 Token 必须验签成功并解密');
assert.equal(parsed.x, 150, '解密出的真实目标 X 坐标必须一致');
assert.equal(parsed.y, 45, '解密出的真实目标 Y 坐标必须一致');

// 篡改测试
const tamperedToken = token.slice(0, -5) + 'abcde';
assert.equal(verifyCaptchaChallengeToken(tamperedToken), null, '被篡改签名的 Token 必须验签失败');

// 过期测试（模拟 130 秒前生成的挑战）
const expiredToken = createCaptchaChallengeToken({
  ...mockChallenge,
  timestamp: Date.now() - 130_000,
});
assert.equal(verifyCaptchaChallengeToken(expiredToken), null, '超过 120 秒的挑战 Token 必须失效');
console.log('✓ 滑块挑战 Token 签名、防篡改及防重放/时效校验通过');

// 3. 验证一次性 Ticket 签发与消费
const testIp = '127.0.0.1';
const ticket = issueCaptchaTicket(testIp);
assert.ok(ticket.startsWith('ticket_'), '签发的 Ticket 格式必须带有 ticket_ 前缀');

// 首次消费必须成功
const firstConsume = consumeCaptchaTicket(ticket, testIp);
assert.equal(firstConsume, true, '合法 Ticket 首次消费必须成功');

// 二次消费必须失败（防重放攻击）
const secondConsume = consumeCaptchaTicket(ticket, testIp);
assert.equal(secondConsume, false, '已消费的 Ticket 二次使用必须被拦截（防重放）');

// 伪造 Ticket 测试
const fakeTicket = ticket + '_tampered';
assert.equal(consumeCaptchaTicket(fakeTicket, testIp), false, '伪造签名的 Ticket 必须被拦截');
console.log('✓ 一次性 Ticket 签发、防篡改与防重放消费校验通过');

// 4. 验证阶梯式失败防御（0~2 次宽容，3 次滑块，5 次锁定）
const testUser = 'sec_test_admin_' + Date.now();
clearAdminLoginFailure(testIp, testUser);

// 初始状态
let state = getAdminLoginSecurityState(testIp, testUser);
assert.equal(state.attempts, 0);
assert.equal(state.requiresCaptcha, false);
assert.equal(state.isLocked, false);

// 第 1 次失败
state = recordAdminLoginFailure(testIp, testUser);
assert.equal(state.attempts, 1);
assert.equal(state.requiresCaptcha, false, '第 1 次失败不应要求验证码');
assert.equal(state.isLocked, false);

// 第 2 次失败
state = recordAdminLoginFailure(testIp, testUser);
assert.equal(state.attempts, 2);
assert.equal(state.requiresCaptcha, false, '第 2 次失败不应要求验证码');
assert.equal(state.isLocked, false);

// 第 3 次失败（触发验证码阈值）
state = recordAdminLoginFailure(testIp, testUser);
assert.equal(state.attempts, 3);
assert.equal(state.requiresCaptcha, true, '第 3 次失败必须触发滑块验证码');
assert.equal(state.isLocked, false);

// 第 4 次失败
state = recordAdminLoginFailure(testIp, testUser);
assert.equal(state.attempts, 4);
assert.equal(state.requiresCaptcha, true);
assert.equal(state.isLocked, false);

// 第 5 次失败（触发临时锁定）
state = recordAdminLoginFailure(testIp, testUser);
assert.equal(state.attempts, 5);
assert.equal(state.requiresCaptcha, true);
assert.equal(state.isLocked, true, '第 5 次失败必须触发账号临时锁定');
assert.ok(state.lockRemainingMs > 0, '锁定剩余毫秒数必须大于 0');

// 清除失败计数（模拟成功登录）
clearAdminLoginFailure(testIp, testUser);
state = getAdminLoginSecurityState(testIp, testUser);
assert.equal(state.attempts, 0);
assert.equal(state.requiresCaptcha, false);
assert.equal(state.isLocked, false);
console.log('✓ 阶梯式登录防御（0~2宽容、3验证码、5锁定、成功重置）校验通过');

console.log('\nAll admin login security checks PASSED successfully!');
