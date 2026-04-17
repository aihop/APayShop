import crypto from 'crypto'

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
        createHash: (algo: string) => crypto.createHash(algo),
        createHmac: (algo: string, key: any) => crypto.createHmac(algo, key)
      },
      URLSearchParams,
      fetch: globalThis.fetch, // Expose standard fetch for API calls
      console: {
        log: (...args: any[]) => console.log('[Webhook Sandbox]', ...args),
        error: (...args: any[]) => console.error('[Webhook Sandbox Error]', ...args)
      }
    }

    // 2. Wrap the user's script to return the result
    // Notice the `async function` wrapper to support `await fetch` inside the script
    const wrapper = `
      return (async function() {
        const { payload, config, crypto, URLSearchParams, fetch, console } = sandboxEnv;
        const { body, query, headers } = payload;
        
        ${scriptCode}
        
      })();
    `
    
    // 3. Execute using Function constructor
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
    const fn = new AsyncFunction('sandboxEnv', wrapper)
    const result = await fn(sandboxEnv)

    // 4. Validate the returned result matches our interface
    if (!result || typeof result !== 'object') {
      throw new Error("Callback script did not return a valid object")
    }
    
    if (!result.orderId) {
      throw new Error("Callback script did not return an orderId")
    }

    return {
      isSignValid: !!result.isSignValid,
      orderId: String(result.orderId),
      tradeNo: result.tradeNo ? String(result.tradeNo) : undefined,
      status: ['paid', 'failed', 'pending'].includes(result.status) ? result.status as any : 'pending',
      amount: result.amount ? Number(result.amount) : undefined,
      responseBody: result.responseBody || 'success'
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
    const sandboxEnv = {
      payload,
      config: configJson,
      crypto: {
        md5: (str: string) => crypto.createHash('md5').update(str, 'utf8').digest('hex'),
        sha1: (str: string) => crypto.createHash('sha1').update(str, 'utf8').digest('hex'),
        sha256: (str: string) => crypto.createHash('sha256').update(str, 'utf8').digest('hex'),
        hmacSha256: (str: string, key: string) => crypto.createHmac('sha256', key).update(str, 'utf8').digest('hex'),
        hmacSha512: (str: string, key: string) => crypto.createHmac('sha512', key).update(str, 'utf8').digest('hex'),
        createHash: (algo: string) => crypto.createHash(algo),
        createHmac: (algo: string, key: any) => crypto.createHmac(algo, key)
      },
      URLSearchParams,
      fetch: globalThis.fetch,
      console: {
        log: (...args: any[]) => console.log('[Create Sandbox]', ...args),
        error: (...args: any[]) => console.error('[Create Sandbox Error]', ...args)
      }
    }

    const wrapper = `
      return (async function() {
        const { payload, config, crypto, URLSearchParams, fetch, console } = sandboxEnv;
        ${scriptCode}
      })();
    `

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const fn = new AsyncFunction('sandboxEnv', wrapper)
    const result = await fn(sandboxEnv)

    if (!result || typeof result !== 'object') {
      throw new Error("Create script did not return a valid object")
    }

    return {
      ok: !!result.ok,
      paymentUrl: result.paymentUrl ? String(result.paymentUrl) : undefined,
      tradeNo: result.tradeNo ? String(result.tradeNo) : undefined,
      responseBody: result.responseBody,
      message: result.message ? String(result.message) : undefined
    }
  } catch (error: any) {
    console.error("Failed to execute create script:", error)
    throw new Error(`Create Sandbox Error: ${error.message}`)
  }
}
