import type { ShoplyMarketplaceSeed } from '../types/marketplace'

export const shoplyAppSeeds: ShoplyMarketplaceSeed[] = [
  { kind: 'app', slug: 'stripe', name: 'Stripe', category: 'payment', mark: 'S', accent: '#635bff', publishedAt: '2024-06-22', downloads: 12 },
  { kind: 'app', slug: 'paddle', name: 'Paddle', category: 'payment', mark: 'P', accent: '#7357ff', publishedAt: '2024-06-22', downloads: 1 },
  { kind: 'app', slug: 'google-translate', name: 'Google Translate', category: 'localization', mark: 'G', accent: '#4285f4', publishedAt: '2024-07-02', downloads: 0 },
  { kind: 'app', slug: 'paypal', name: 'PayPal', category: 'payment', mark: 'P', accent: '#0070ba', publishedAt: '2024-06-22', downloads: 9 },
  { kind: 'app', slug: 'fastdatas', name: 'FastDatas', category: 'data', mark: 'F', accent: '#0ea5e9', publishedAt: '2024-06-22', downloads: 0 },
  { kind: 'app', slug: 'coin-gate', name: 'CoinGate', category: 'payment', mark: 'C', accent: '#16a34a', publishedAt: '2024-08-26', downloads: 0 },
  { kind: 'app', slug: 'mailer', name: 'Mailer', category: 'communication', mark: 'M', accent: '#f97316', publishedAt: '2024-08-26', downloads: 8 },
  { kind: 'app', slug: 'wechat', name: 'WeChat', category: 'communication', mark: 'W', accent: '#07c160', publishedAt: '2024-08-26', downloads: 2 },
  { kind: 'app', slug: 'alisms', name: 'Alibaba SMS', category: 'communication', mark: 'A', accent: '#ff6a00', publishedAt: '2024-08-26', downloads: 10 },
  { kind: 'app', slug: 'test', name: 'Shoply Test', category: 'utility', mark: 'T', accent: '#64748b', publishedAt: '2024-08-27', downloads: 34 },
  { kind: 'app', slug: 'shopifyimport', name: 'Shopify Import', category: 'commerce', mark: 'S', accent: '#95bf47', publishedAt: '2024-11-04', downloads: 14 },
  { kind: 'app', slug: 'receive', name: 'Cash on Delivery', category: 'payment', mark: 'C', accent: '#0891b2', publishedAt: '2024-11-04', downloads: 8 },
  { kind: 'app', slug: 'qrcode', name: 'QR Code', category: 'utility', mark: 'QR', accent: '#111827', publishedAt: '2024-11-04', downloads: 0 },
  { kind: 'app', slug: 'bird', name: 'Bird', category: 'communication', mark: 'B', accent: '#2563eb', downloads: 1 },
  { kind: 'app', slug: 'apple', name: 'Sign in with Apple', category: 'identity', mark: 'A', accent: '#111827', publishedAt: '2026-03-18', downloads: 3 },
]

export const shoplyThemeSeeds: ShoplyMarketplaceSeed[] = [
  { kind: 'theme', slug: 'outdoor-equipment-mall', name: 'Outdoor Equipment', category: 'outdoor', mark: 'OE', accent: '#0f766e' },
  { kind: 'theme', slug: 'audio-headphones-mall', name: 'Audio & Headphones', category: 'electronics', mark: 'AH', accent: '#7c3aed' },
  { kind: 'theme', slug: 'clothing-shoes-mall', name: 'Clothing & Shoes', category: 'fashion', mark: 'CS', accent: '#db2777' },
  { kind: 'theme', slug: 'beauty-skin-care-mall', name: 'Beauty & Skin Care', category: 'beauty', mark: 'BS', accent: '#e11d48' },
  { kind: 'theme', slug: 'underwear-clothing-mall', name: 'Intimates & Apparel', category: 'fashion', mark: 'IA', accent: '#be185d' },
  { kind: 'theme', slug: 'pet-equipment-mall', name: 'Pet Supplies', category: 'pets', mark: 'PS', accent: '#ea580c' },
  { kind: 'theme', slug: 'home-textiles-mall', name: 'Home Textiles', category: 'home', mark: 'HT', accent: '#a16207' },
  { kind: 'theme', slug: 'cycling-accessories-mall', name: 'Cycling Accessories', category: 'sports', mark: 'CA', accent: '#0284c7' },
  { kind: 'theme', slug: 'jewelry-accessories', name: 'Jewelry & Accessories', category: 'jewelry', mark: 'JA', accent: '#ca8a04' },
  { kind: 'theme', slug: 'medical-equipment', name: 'Medical Equipment', category: 'medical', mark: 'ME', accent: '#0d9488' },
  { kind: 'theme', slug: 'furniture-mattress-mall', name: 'Furniture & Mattress', category: 'home', mark: 'FM', accent: '#92400e' },
  { kind: 'theme', slug: 'children-toys-mall', name: 'Children & Toys', category: 'kids', mark: 'CT', accent: '#4f46e5' },
  { kind: 'theme', slug: 'wig-mall', name: 'Wigs & Hair', category: 'beauty', mark: 'WH', accent: '#c026d3' },
  { kind: 'theme', slug: 'shoes-mall', name: 'Footwear', category: 'fashion', mark: 'FW', accent: '#dc2626' },
  { kind: 'theme', slug: 'fitness-equipment-mall', name: 'Fitness Equipment', category: 'sports', mark: 'FE', accent: '#16a34a' },
]

export const shoplyMarketplaceSeeds = [...shoplyAppSeeds, ...shoplyThemeSeeds]
