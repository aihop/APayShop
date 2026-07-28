import path from 'node:path'
import maxmind, { type CityResponse, type Reader } from 'maxmind'

export type LocalGeoResult = {
  country: string | null
  region: string | null
  city: string | null
  timezone: string | null
}

let readerPromise: Promise<Reader<CityResponse> | null> | null = null
let warned = false

const resolveDatabasePath = () => {
  const configuredPath = String(process.env.APAY_GEOLITE2_CITY_DB || '').trim()
  return configuredPath || path.resolve(process.cwd(), 'resource/GeoLite2-City.mmdb')
}

const getReader = () => {
  if (!readerPromise) {
    const databasePath = resolveDatabasePath()
    readerPromise = maxmind.open<CityResponse>(databasePath, { cache: { max: 10_000 } })
      .catch((error) => {
        if (!warned) {
          warned = true
          console.warn(`[GeoIP] Unable to load GeoLite2 database at ${databasePath}:`, error)
        }
        return null
      })
  }

  return readerPromise
}

const localizedName = (names?: Record<string, string>) =>
  names?.['zh-CN'] || names?.en || Object.values(names || {})[0] || null

export const lookupLocalGeo = async (ip: string): Promise<LocalGeoResult | null> => {
  const reader = await getReader()
  const result = reader?.get(ip)
  if (!result) return null

  const subdivision = result.subdivisions?.[0]
  return {
    country: result.country?.iso_code || result.registered_country?.iso_code || null,
    region: localizedName(subdivision?.names as Record<string, string> | undefined),
    city: localizedName(result.city?.names as Record<string, string> | undefined),
    timezone: result.location?.time_zone || null,
  }
}
