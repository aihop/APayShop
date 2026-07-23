/**
 * 跨方言取 UPDATE/INSERT 受影响行数:项目同时支持 postgres-js / mysql2 / libsql,
 * drizzle 的执行结果形状各不相同。原子条件更新(如"仅当未支付时置为已支付")
 * 必须靠受影响行数判断本请求是否抢占成功,不能再查一遍(会重新引入竞争窗口)。
 */
export const getAffectedRows = (result: any): number => {
  if (typeof result?.rowsAffected === 'number') return result.rowsAffected // libsql
  if (typeof result?.count === 'number') return result.count // postgres-js
  if (Array.isArray(result) && typeof result[0]?.affectedRows === 'number') return result[0].affectedRows // mysql2
  if (typeof result?.affectedRows === 'number') return result.affectedRows
  return 0
}
