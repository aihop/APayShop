import { inArray } from 'drizzle-orm'
import { settings } from '../db/schema'
import { db } from '../db/runtime'
import {
  getLocalizedSettingKeys,
  resolveLocalizedSetting,
} from '~~/shared/utils/localizedSettings'

export const getLocalizedSettingValue = async (
  key: string,
  locale: unknown,
  defaultValue = '',
): Promise<string> => {
  const keys = getLocalizedSettingKeys(key, locale)
  const rows = await db.select()
    .from(settings)
    .where(inArray(settings.key, keys))
  const values = Object.fromEntries(rows.map((row: { key: string, value: string }) => [row.key, row.value]))

  return resolveLocalizedSetting(values, key, locale, defaultValue)
}
