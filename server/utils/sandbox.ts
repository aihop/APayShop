import crypto from 'crypto'

const DEFAULT_SCRIPT_TIMEOUT_MS = 30_000

function createSandboxFetch() {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlString = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url
    let url: URL
    try {
      url = new URL(urlString)
    } catch {
      throw new Error('sandbox fetch: invalid URL')
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('sandbox fetch: only http/https protocols allowed')
    }
    const method = String(init?.method || 'GET').toUpperCase()
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
    if (!allowedMethods.includes(method)) {
      throw new Error(`sandbox fetch: method ${method} not allowed`)
    }
    return globalThis.fetch(input, init)
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`sandbox script execution timeout (${ms}ms)`)), ms)
  })
  if (timer) (timer as any).unref?.()
  return Promise.race([promise, timeoutPromise])
}

export interface WebhookResult {
  isSignValid: boolean;
  orderId: string;
  tradeNo?: string;
  status: 'paid' | 'failed' | 'pending';
  amount?: number;
  responseBody?: string | Record<string, any>;
}

export interface CreatePaymentResult {
  ok: boolean;
  paymentUrl?: string;
  qrCodeText?: string;
  tradeType?: string;
  tradeNo?: string;
  responseBody?: string | Record<string, any>;
  message?: string;
}

export async function executeCallbackScript(
  scriptCode: string, 
  payload: {
    body: any;
    query: any;
    headers: any;
    urlOrderId?: string;
  },
  configJson: any
): Promise<WebhookResult> {
  try {
    if (/\bimport\s*\(/.test(scriptCode)) throw new Error('Dynamic import is not allowed in sandbox scripts')
    // 1. Prepare sandbox context
    // We provide standard utilities that payment callbacks might need
    const sandboxEnv = {
      payload,
      config: configJson,
      crypto: {
        md5: (str: string) => crypto.createHash('md5').update(str, 'utf8').digest('hex'),
        sha1: (str: string) => crypto.createHash('sha1').update(str, 'utf8').digest('hex'),
        sha256: (str: string) => crypto.createHash('sha256').update(str, 'utf8').digest('hex'),
        hmacSha256: (str: string, key: string) => crypto.createHmac('sha256', key).update(str, 'utf8').digest('hex'),
        randomString: (length = 32) => crypto.randomBytes(Math.max(16, Math.ceil(length / 2))).toString('hex').slice(0, length),
        rsaSha256Sign: (content: string, privateKey: string) => {
          const signer = crypto.createSign('RSA-SHA256')
          signer.update(content, 'utf8')
          signer.end()
          return signer.sign(privateKey, 'base64')
        },
        rsaSha256Verify: (content: string, signature: string, publicKey: string) => {
          const verifier = crypto.createVerify('RSA-SHA256')
          verifier.update(content, 'utf8')
          verifier.end()
          return verifier.verify(publicKey, signature, 'base64')
        },
        aes256GcmDecrypt: (
          ciphertextBase64: string,
          key: string,
          nonce: string,
          associatedData = '',
        ) => {
          const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            Buffer.from(key, 'utf8'),
            Buffer.from(nonce, 'utf8'),
          )
          if (associatedData) {
            decipher.setAAD(Buffer.from(associatedData, 'utf8'))
          }
          const ciphertext = Buffer.from(ciphertextBase64, 'base64')
          const authTag = ciphertext.subarray(ciphertext.length - 16)
          const encrypted = ciphertext.subarray(0, ciphertext.length - 16)
          decipher.setAuthTag(authTag)
          const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
          return decrypted.toString('utf8')
        },
        createHash: (algo: string) => crypto.createHash(algo),
        createHmac: (algo: string, key: any) => crypto.createHmac(algo, key)
      },
      URLSearchParams,
      fetch: createSandboxFetch(), // Expose standard fetch for API calls
      console: {
        log: (...args: any[]) => console.log('[Webhook Sandbox]', ...args),
        error: (...args: any[]) => console.error('[Webhook Sandbox Error]', ...args)
      }
    }

    // 2. Wrap the user's script to return the result
    // Notice the `async function` wrapper to support `await fetch` inside the script
    // 危险全局遮蔽:AsyncFunction 本质是 Function 构造器,脚本与宿主同环境。
    // 用同名参数把 process/globalThis/require 等挡在词法作用域外,防止脚本
    // "顺手"读环境变量/文件系统。注意这不是完整隔离(原型链仍可摸到构造器),
    // 真隔离需 isolated-vm/独立进程——支付脚本的信任边界仍是后台管理员。
    const wrapper = `
      return (async function(process, globalThis, global, require, module, exports, __dirname, __filename, Function, AsyncFunction) {
        const { payload, config, crypto, URLSearchParams, fetch, console } = sandboxEnv;
        const { body, query, headers } = payload;

        ${scriptCode}

      })(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    `

    // 3. Execute using Function constructor
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
    const fn = new AsyncFunction('sandboxEnv', wrapper)
    const result = await withTimeout(fn(sandboxEnv), DEFAULT_SCRIPT_TIMEOUT_MS)

    // 4. Validate the returned result matches our interface
    if (!result || typeof result !== 'object') {
      throw new Error("Callback script did not return a valid object")
    }
    const r = result as Record<string, any>
    if (!r.orderId) {
      throw new Error("Callback script did not return an orderId")
    }

    return {
      isSignValid: !!r.isSignValid,
      orderId: String(r.orderId),
      tradeNo: r.tradeNo ? String(r.tradeNo) : undefined,
      status: ['paid', 'failed', 'pending'].includes(r.status) ? r.status as any : 'pending',
      amount: r.amount ? Number(r.amount) : undefined,
      responseBody: r.responseBody || 'success'
    }

  } catch (error: any) {
    console.error("Failed to execute callback script:", error)
    throw new Error(`Sandbox Execution Error: ${error.message}`)
  }
}

export async function executeCreateScript(
  scriptCode: string,
  payload: Record<string, any>,
  configJson: any
): Promise<CreatePaymentResult> {
  try {
    if (/\bimport\s*\(/.test(scriptCode)) throw new Error('Dynamic import is not allowed in sandbox scripts')
    const sandboxEnv = {
      payload,
      config: configJson,
      crypto: {
        md5: (str: string) => crypto.createHash('md5').update(str, 'utf8').digest('hex'),
        sha1: (str: string) => crypto.createHash('sha1').update(str, 'utf8').digest('hex'),
        sha256: (str: string) => crypto.createHash('sha256').update(str, 'utf8').digest('hex'),
        hmacSha256: (str: string, key: string) => crypto.createHmac('sha256', key).update(str, 'utf8').digest('hex'),
        hmacSha512: (str: string, key: string) => crypto.createHmac('sha512', key).update(str, 'utf8').digest('hex'),
        randomString: (length = 32) => crypto.randomBytes(Math.max(16, Math.ceil(length / 2))).toString('hex').slice(0, length),
        rsaSha256Sign: (content: string, privateKey: string) => {
          const signer = crypto.createSign('RSA-SHA256')
          signer.update(content, 'utf8')
          signer.end()
          return signer.sign(privateKey, 'base64')
        },
        rsaSha256Verify: (content: string, signature: string, publicKey: string) => {
          const verifier = crypto.createVerify('RSA-SHA256')
          verifier.update(content, 'utf8')
          verifier.end()
          return verifier.verify(publicKey, signature, 'base64')
        },
        aes256GcmDecrypt: (
          ciphertextBase64: string,
          key: string,
          nonce: string,
          associatedData = '',
        ) => {
          const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            Buffer.from(key, 'utf8'),
            Buffer.from(nonce, 'utf8'),
          )
          if (associatedData) {
            decipher.setAAD(Buffer.from(associatedData, 'utf8'))
          }
          const ciphertext = Buffer.from(ciphertextBase64, 'base64')
          const authTag = ciphertext.subarray(ciphertext.length - 16)
          const encrypted = ciphertext.subarray(0, ciphertext.length - 16)
          decipher.setAuthTag(authTag)
          const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
          return decrypted.toString('utf8')
        },
        createHash: (algo: string) => crypto.createHash(algo),
        createHmac: (algo: string, key: any) => crypto.createHmac(algo, key)
      },
      URLSearchParams,
      fetch: createSandboxFetch(),
      console: {
        log: (...args: any[]) => console.log('[Create Sandbox]', ...args),
        error: (...args: any[]) => console.error('[Create Sandbox Error]', ...args)
      }
    }

    // 危险全局遮蔽,同 executeCallbackScript 的说明:非完整隔离,仅防"顺手"越权
    const wrapper = `
      return (async function(process, globalThis, global, require, module, exports, __dirname, __filename, Function, AsyncFunction) {
        const { payload, config, crypto, URLSearchParams, fetch, console } = sandboxEnv;
        ${scriptCode}
      })(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    `

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const fn = new AsyncFunction('sandboxEnv', wrapper)
    const result = await withTimeout(fn(sandboxEnv), DEFAULT_SCRIPT_TIMEOUT_MS)

    if (!result || typeof result !== 'object') {
      throw new Error("Create script did not return a valid object")
    }
    const r = result as Record<string, any>

    return {
      ok: !!r.ok,
      paymentUrl: r.paymentUrl ? String(r.paymentUrl) : undefined,
      qrCodeText: r.qrCodeText ? String(r.qrCodeText) : undefined,
      tradeType: r.tradeType ? String(r.tradeType) : undefined,
      tradeNo: r.tradeNo ? String(r.tradeNo) : undefined,
      responseBody: r.responseBody,
      message: r.message ? String(r.message) : undefined
    }
  } catch (error: any) {
    console.error("Failed to execute create script:", error)
    throw new Error(`Create Sandbox Error: ${error.message}`)
  }
}
