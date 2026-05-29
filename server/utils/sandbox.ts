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
