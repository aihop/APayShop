# APayShop

**一个极简、极客风的虚拟商品全栈独立站**  
基于 Nuxt 4 + Nuxt Hub (SQLite) + Tailwind CSS 构建

[官网](https://apayshop.com/) · [English](README.md) · [核心特性](#-核心特性) · [快速开始](#-快速开始-一键部署) · [架构亮点](#-架构亮点)

---

## 🌟 简介

**APayShop** 是一个专为销售**虚拟商品**（卡密、数字文件、SaaS 订阅、API 额度、人工代充服务）而设计的轻量级、零外部依赖的全栈独立站。

它抛弃了传统 Java/Go 后端与 Vue/React 前端分离的沉重架构，而是直接使用 **Nuxt 4 + 本地 SQLite (通过 Nuxt Hub 挂载)**，实现了极致的单机极速部署体验。项目整体采用暗黑电竞风美学，拥有丝滑的物理动效，以及一套极其强大的“多模板动态引擎”。

如果您是一名独立开发者 (Indie Hacker)、数字游民或小型工作室，希望快速、优雅地售卖您的数字资产或 API，并且不想维护沉重的数据库，APayShop 将是您的绝佳选择。

官网：https://apayshop.com/

---

## ✨ 核心特性

- 🪶 **零外部依赖**: 不需要安装 MySQL，不需要 Redis。所有数据全部由本地 SQLite (`.data/db/`) 驱动。
- 🎨 **多模板动态引擎**: 内置动态主题切换能力。页面路由不写死，而是根据当前激活的主题动态引入对应的 `.vue` 模板文件。
- 🛍️ **全场景虚拟商品支持**:
  - **Key (卡密)**: 一物一码，自动发货与核销。
  - **File (文件)**: 安全的数字资产下载链接。
  - **Subscription (订阅)**: 周期性订阅与计费管理。
  - **Service (服务)**: 动态 JSON 表单引擎，结账时自动收集用户定制化需求（如要求填入服务器 IP）。
  - **Dynamic API (动态 API)**: 购买后自动生成 `sk_...` 密钥，分配额度，并可通过 Webhook 自动推送至您的业务服务器进行开户。
- 🔌 **Serverless 支付回调引擎**: 支付网关的回调解析逻辑不再写死在代码里，而是作为**纯 JS 字符串**存在数据库中，并在 Node.js 沙箱中动态执行验签。真正的支付网关热插拔。
- 👥 **访客与注册买家双轨制**: 用户可直接使用邮箱免注册下单付款。后续如果使用该邮箱注册（支持本地密码或 Google/GitHub OAuth），系统会自动将历史“访客订单”认领至新账户下，实现平滑渐进式注册。
- 🤖 **AI Theme Builder (AI 模板生成器)**: 后台内置 AI 助手对话界面，可通过自然语言直接生成新的模板代码并写入服务器目录。
- ⚙️ **后台设置**：站点标题/描述/Logo/Favicon、结账行为、Webhook 等均可在后台配置并即时生效。
- 🧰 **上传能力**：后台内置上传接口（Logo/Favicon/商品图等），可使用 NuxtHub Blob 或落地到本地 `uploads/`。

---

## 🚀 快速开始 (一键部署)

我们为纯净的 Linux 服务器（Ubuntu/Debian/CentOS）提供了一套“傻瓜式”的一键部署脚本。它会自动为您安装 Node.js、PM2，编译项目，并智能检测配置 Nginx 或 Caddy 进行域名绑定与自动 HTTPS。

```bash
# 1. 克隆代码仓库
git clone https://github.com/aihop/APayShop.git
cd APayShop

# 2. 赋予脚本执行权限
chmod +x deploy.sh

# 3. 运行部署脚本 (支持中英文交互)
./deploy.sh
```

跟随终端里的交互提示操作即可。执行完毕后，您的独立站就已经在您的域名下正式上线了！

### 本地开发指南

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 生产构建与运行

```bash
npm run build
node .output/server/index.mjs
```

如果你使用多主题并希望发布时仅保留 `default` + 指定主题，可生成一个独立的产物目录：

```bash
./build.sh apayshop-site panel
```

---

## 🏗️ 架构亮点

### 多模板引擎

我们利用了 Nuxt 的全局捕获路由 (`app/pages/[...slug].vue`) 结合 Vue 的 `defineAsyncComponent`。当用户访问 `/products/abc` 时，路由会拦截请求，查询数据库中当前激活的主题，然后动态加载 `app/themes/[theme_name]/` 目录下的 Vue 文件进行渲染。

### 动态 Webhook 沙箱

为了不把几十个支付网关的代码塞满项目，`payment_methods` 表的 `callback` 字段存入了纯 JS 代码。当支付回调请求到达 `/api/webhooks/[order_id]` 时，系统会动态执行这段 JS 来验证签名并更新订单状态。

### 动态重构与重启机制 (Rebuild)

因为 Vue 的动态组件依赖打包时 (`npm run build`) 的静态分析，所以在生产环境下下载或用 AI 生成了新模板后无法立即生效。为此，APayShop 提供了一个异步的 `/api/admin/system/rebuild` 接口。管理员只需在后台点击“Rebuild System”，服务器就会在后台静默完成编译与 PM2 重启。

---

## 🧩 高级模板与支付插件 (即将推出)

APayShop 的核心框架基于 MIT 协议永久开源免费。为了维持项目的长期健康发展，我们正在筹备官方的**增值插件市场**，未来您将可以购买：

- **Pro 高级模板**: 针对不同行业（如电竞发卡站、极简 SaaS 售卖、API 聚合平台）精心打磨的高转化率前端模板。
- **高级支付网关插件**: 开箱即用的 Webhook 沙箱代码，支持 USDT/加密货币、Stripe、PayPal 以及各大免签聚合支付渠道。

> **想第一时间获取增值市场上线通知？**
> 请 Watch/Star 本仓库，或关注作者的 [Twitter/X](https://twitter.com/yourhandle) 动态！

---

## 🛡️ 后台管理系统

管理后台与 C 端用户系统在数据表级别 (`admins` 表 vs `users` 表) 实现了严格隔离。
访问路径：`yourdomain.com/admin/login`

后台采用密集、直观的 UI 设计，支持以下核心管理：

- 订单管理与手动履约处理
- 商品发布与动态配置（如可视化配置 Service 表单、配置 API 额度）
- 卡密库存池管理
- API Key 资产与额度消耗监控
- 全局系统设置与主题编译

---

## 📄 开源协议

本项目采用 MIT 协议开源。您可以免费将其用于个人学习或商业项目中，并可自由修改与分发。
