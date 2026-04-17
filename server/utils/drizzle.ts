import { drizzle } from "drizzle-orm/d1"
import * as schema from "../db/schema"

export const useDrizzle = () => {
  return drizzle(db, { schema })
}
