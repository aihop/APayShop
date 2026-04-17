# APayShop

**A Minimalist, Geek-Style Full-Stack E-commerce Platform for Virtual Goods**  
Built with Nuxt 4 + Nuxt Hub (SQLite) + Tailwind CSS

[Website](https://apayshop.com/) · [简体中文](README.zh-CN.md) · [Features](#-core-features) · [Quick Start](#-quick-start-1-click-deployment) · [Architecture](#-architecture-highlights)

---

## 🌟 Introduction

**APayShop** is a lightweight, zero-external-dependency, full-stack independent store designed specifically for selling **virtual goods** (Activation Keys, Digital Files, SaaS Subscriptions, API Quotas, and Manual Services).

It abandons the traditional heavy architecture of separating Java/Go backend from Vue/React frontend. Instead, it utilizes **Nuxt 4 + Local SQLite (via Nuxt Hub)** to achieve an ultimate single-machine extreme deployment experience. It features a dark-mode cyberpunk aesthetic, silky-smooth physical animations, and a powerful multi-theme dynamic engine.

If you are an indie hacker, a digital nomad, or a small studio looking to sell your digital assets or APIs quickly and elegantly without maintaining a heavy database, APayShop is your best choice.

Official website: https://apayshop.com/

---

## ✨ Core Features

- 🪶 **Zero Dependencies**: No MySQL, no Redis. Everything is powered by local SQLite (`.data/db/`) via Nuxt Hub.
- 🎨 **Multi-Theme Engine**: Built-in dynamic theme switching. Pages are dynamically loaded based on the active theme without hardcoding routes.
- 🛍️ **All-in-One Virtual Goods**:
  - **Key**: Automatic delivery of unique activation codes.
  - **File**: Secure download links for digital assets.
  - **Subscription**: Recurring billing management.
  - **Service**: Dynamic JSON-driven forms to collect user requirements during checkout.
  - **Dynamic API**: Automatically generate `sk_...` API keys, assign quotas, and optionally push to your external business servers via Webhooks.
- 🔌 **Serverless Payment Webhooks**: Payment gateway callbacks are stored as pure JavaScript strings in the database and executed dynamically in a Node.js sandbox. True hot-pluggable payments.
- 👥 **Dual-Track Checkout**: Users can checkout smoothly as a guest via email. If they register later (Local/Google/GitHub OAuth), their past guest orders will automatically link to their new account.
- 🤖 **AI Theme Builder**: Built-in AI generation interface in the admin panel to converse and generate new template code directly to your file system.
- ⚙️ **Admin Settings**: Manage site title/description/logo/favicon, checkout behavior, and webhook settings from the admin panel.
- 🧰 **Uploads**: Built-in upload endpoints for admin assets (logo/favicon/product images), compatible with NuxtHub Blob or local filesystem storage.

---

## 🚀 Quick Start (1-Click Deployment)

We provide a foolproof deployment script for fresh Linux servers (Ubuntu/Debian/CentOS). It automatically installs Node.js, PM2, builds the project, and configures Nginx/Caddy reverse proxy with HTTPS.

```bash
# 1. Clone the repository
git clone https://github.com/aihop/APayShop.git
cd APayShop

# 2. Make the script executable
chmod +x deploy.sh

# 3. Run the deployment script (Supports English/Chinese)
./deploy.sh
```

Follow the interactive prompts. Once finished, your store will be live at your domain!

### Manual Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
node .output/server/index.mjs
```

If you use a multi-theme setup and want to ship only `default` + a selected theme, you can build an isolated artifact directory:

```bash
./build.sh apayshop-site panel
```

---

## 🏗️ Architecture Highlights

### The Multi-Theme Engine

We use Nuxt's Catch-all routing (`app/pages/[...slug].vue`) combined with Vue's `defineAsyncComponent`. When a user visits `/products/abc`, the router intercepts it, checks the currently active theme in the database, and dynamically imports the corresponding `.vue` file from `app/themes/[theme_name]/`.

### Dynamic Webhook Sandbox

To avoid hardcoding dozens of payment gateways, the `payment_methods` table stores a `callback` field containing pure JavaScript code. When a webhook hits `/api/webhooks/[order_id]`, the system dynamically executes this JS code to verify signatures and parse the order.

### Rebuild & Restart Mechanism

Since Vue's dynamic imports require static analysis during build time (`npm run build`), dynamically downloading a new theme won't work instantly. APayShop provides an async `/api/admin/system/rebuild` endpoint. Admins can click "Rebuild System" in the dashboard, and the server will silently recompile and restart via PM2 in the background.

---

## 🧩 Pro Themes & Payment Plugins (Coming Soon)

APayShop is entirely open-source and free to use under the MIT License. However, to sustain the development and offer premium experiences, we are working on a marketplace for:

- **Premium Themes**: Handcrafted, highly-converting themes for specific niches (e.g., Cyberpunk Game Key Store, Clean Minimalist SaaS Portal).
- **Advanced Payment Gateways**: Ready-to-use webhook sandbox scripts for Crypto (USDT/BTC), Stripe, PayPal, and regional local payment providers.

> **Want to be the first to know when the Pro marketplace launches?**
> Watch/Star this repository, or follow us on [Twitter/X](https://twitter.com/yourhandle) for updates!

---

## 🛡️ Admin Dashboard

The admin dashboard is strictly isolated from the C-end user system (using a separate `admins` table).
Access it via: `yourdomain.com/admin/login`

It provides dense, efficient data management for:

- Orders & Manual Fulfillment
- Products & Dynamic MetaData configurations (e.g., API Quotas, Service JSON forms)
- Card / Key Inventory
- API Key Quota tracking
- System Settings & Rebuilds

---

## 📄 License

MIT License. Free to use, modify, and distribute for personal or commercial projects.
