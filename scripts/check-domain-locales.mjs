import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  normalizeDomainHost,
  normalizePublicProtocol,
  parseDomainLocales,
  resolveMappedDomain,
} from '../shared/domainLocales.ts'

const root = process.cwd()
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

const expected = {
  'apay.example': 'en',
  'cn.apay.example': 'zh',
  'ru.apay.example': 'ru',
}
assert.deepEqual(
  parseDomainLocales('apay.example=en,cn.apay.example=zh,ru.apay.example=ru', ['en', 'zh', 'ru']),
  expected,
)
assert.deepEqual(
  parseDomainLocales(JSON.stringify(expected), ['en', 'zh', 'ru']),
  expected,
)
assert.equal(normalizeDomainHost('CN.APAY.EXAMPLE.'), 'cn.apay.example')
assert.equal(normalizeDomainHost('localhost:3000'), 'localhost:3000')
assert.equal(normalizeDomainHost('https://apay.example'), '')
assert.equal(normalizeDomainHost('*.apay.example'), '')
assert.equal(normalizePublicProtocol('HTTPS:'), 'https')
assert.throws(() => normalizePublicProtocol('ftp'), /http or https/)
assert.throws(() => parseDomainLocales('apay.example=ja', ['en', 'zh']), /not included/)
assert.throws(() => parseDomainLocales('apay.example=en,apay.example=zh', ['en', 'zh']), /conflicting/)
assert.throws(() => parseDomainLocales('https:\/\/apay.example=en', ['en']), /Invalid domain host/)

assert.deepEqual(resolveMappedDomain(expected, '', 'cn.apay.example'), {
  host: 'cn.apay.example',
  locale: 'zh',
})
assert.equal(resolveMappedDomain(expected, 'evil.example', 'apay.example', true), null)
assert.deepEqual(resolveMappedDomain(expected, 'ru.apay.example', 'internal.example', true), {
  host: 'ru.apay.example',
  locale: 'ru',
})

const nuxtConfig = read('nuxt.config.ts')
assert.match(nuxtConfig, /parseDomainLocales\(/)
assert.match(nuxtConfig, /multiDomainLocales: DOMAIN_HOSTS\.length > 0/)
assert.match(nuxtConfig, /defaultForDomains: DOMAIN_HOSTS\.filter/)
assert.match(nuxtConfig, /DOMAIN_HOSTS\.length \? 'prefix_and_default' : 'prefix_except_default'/)
assert.match(nuxtConfig, /apayDomainLocales: DOMAIN_LOCALES/)
assert.match(nuxtConfig, /apayDefaultLocale: I18N_DEFAULT_LOCALE/)
assert.match(nuxtConfig, /apayLocales: I18N_BASE_LOCALES/)

const domainLocale = read('server/utils/domainLocale.ts')
assert.match(domainLocale, /resolveMappedDomain\(mappings, forwardedHost, getRequestHost\(event\), Boolean\(forwardedHeader\)\)/)
assert.match(domainLocale, /statusMessage: 'Unrecognized request host'/)
assert.match(domainLocale, /apayPublicProtocol/)

for (const file of [
  'server/api/auth/register.post.ts',
  'server/api/orders/checkout.post.ts',
  'server/api/payments/initiate.post.ts',
]) {
  const source = read(file)
  const originIndex = source.indexOf('requireTrustedRequestOrigin(event)')
  const bodyIndex = source.indexOf('readBody(event)')
  assert.ok(originIndex >= 0, `${file} must require a trusted request origin`)
  assert.ok(bodyIndex < 0 || originIndex < bodyIndex, `${file} must validate the host before reading or writing business data`)
}

const checkout = read('server/api/orders/checkout.post.ts')
assert.doesNotMatch(checkout, /getRequestURL\(event\)\.origin/)
assert.match(checkout, /payment_link: `\$\{input\.siteUrl\}\/payment\/\$\{input\.orderId\}`/)

const payment = read('server/api/payments/initiate.post.ts')
assert.match(payment, /callbackUrl = `\$\{origin\}\/api\/webhooks\/\$\{order\.id\}`/)

const requestLocale = read('server/utils/requestLocale.ts')
for (const token of ['pathLocale', 'cookieLocale', 'refererLocale', 'domainLocale', 'acceptLanguage']) {
  assert.match(requestLocale, new RegExp(token))
}
assert.match(requestLocale, /pathLocale \|\| cookieLocale \|\| refererLocale \|\| domainLocale \|\| acceptLanguage/)
assert.match(requestLocale, /if \(normalized === 'en'/)
assert.match(requestLocale, /return ''/)

const paymentLocales = read('server/utils/paymentMethodLocales.ts')
assert.match(paymentLocales, /\[inputLocale, cookieLocale, refererLocale, domainLocale, acceptLanguageLocale\]/)
assert.match(paymentLocales, /find\(candidate => isSupportedLocaleCandidate\(candidate, config\.supportedLocales\)\)/)

const geoip = read('server/middleware/geoip.ts')
assert.match(geoip, /resolveRequestDomainLocale\(event\)/)
assert.match(geoip, /process\.env\.APAY_NUXT_BUILD === '1'/)
assert.match(geoip, /!isNuxtBuild && !isInternalSettingsRead && hasDomainLocaleMappings\(event\) && !domainLocale/)
assert.match(geoip, /normalizedPath === '\/api\/settings'/)
assert.match(geoip, /'__unenv__' in event\.node\.req/)
assert.match(geoip, /statusMessage: 'Unrecognized request host'/)
assert.match(geoip, /i18n_redirected=\$\{encodeURIComponent\(userLocale\)\}/)

const localeRouter = read('app/composables/useLocaleRouter.ts')
assert.match(localeRouter, /useLocalePath\(\)/)
assert.doesNotMatch(localeRouter, /locale\.value !== 'en'/)

const persistence = read('app/plugins/locale-persist.client.ts')
assert.match(persistence, /unref\(i18n\.locales\)/)
assert.doesNotMatch(persistence, /saved === 'en'/)

const seo = read('app/plugins/i18n-seo.ts')
assert.match(seo, /rel: 'canonical'/)
assert.match(seo, /rel: 'alternate'/)
assert.match(seo, /hreflang: 'x-default'/)
assert.match(seo, /route\.path === '\/' \? '\/' : ''/)
assert.match(seo, /normalizeSiteOrigin\(getSetting\('site_url'\)\)/)
assert.match(seo, /classifySeoRoute\(seoRouteRegistry/)

console.log('Domain locale foundation checks passed')
