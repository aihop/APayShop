const fs = require('fs');

let content = fs.readFileSync('server/db/schema.pg.ts', 'utf-8');

// Replace imports
content = content.replace(/from 'drizzle-orm\/pg-core'/g, "from 'drizzle-orm/mysql-core'");
content = content.replace(/pgTable/g, 'mysqlTable');

// Replace specific types
content = content.replace(/serial\(([^)]+)\)/g, 'int($1).autoincrement()');
content = content.replace(/integer\(/g, 'int(');
content = content.replace(/jsonb\(/g, 'json(');
content = content.replace(/timestamp\(([^,]+),\s*\{[^}]+\}\)/g, 'timestamp($1)');

fs.writeFileSync('server/db/schema.mysql.ts', content);
console.log('schema.mysql.ts generated');
