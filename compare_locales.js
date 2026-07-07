
const zh = require('./app/themes/qingpu/locales/zh.ts').default;
const en = require('./app/themes/qingpu/locales/en.ts').default;

function compareKeys(obj1, obj2, prefix = '') {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  for (const key of keys1) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (!(key in obj2)) {
      console.log(`Missing in EN: ${fullKey}`);
    } else if (typeof obj1[key] === 'object' && obj1[key] !== null) {
      compareKeys(obj1[key], obj2[key], fullKey);
    }
  }

  for (const key of keys2) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (!(key in obj1)) {
      console.log(`Extra in EN: ${fullKey}`);
    }
  }
}

if (zh.qingpu && en.qingpu) {
  compareKeys(zh.qingpu, en.qingpu, 'qingpu');
} else {
  console.log('qingpu namespace not found in one of the files');
}
