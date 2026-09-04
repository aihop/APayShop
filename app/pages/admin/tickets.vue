<template>
  <div class="flex flex-col space-y-4 pb-12">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            工单支持中心
          </h1>
          <UBadge
            color="primary"
            variant="subtle"
            size="xs"
            class="font-mono font-medium"
          >
            {{ summary.all }}
          </UBadge>
        </div>
        <p class="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
          管理用户提交的技术排障与业务工单，查看无损现场快照并进行异步回复
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="ph:arrow-clockwise"
          size="sm"
          :loading="loading"
          class="rounded-xl"
          @click="loadTickets()"
        />
      </div>
    </div>

    <!-- 状态指标卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-2.5 shrink-0">
      <div
        v-for="st in statusTabs"
        :key="st.key"
        class="bg-white dark:bg-[#121214] border border-gray-200/70 dark:border-gray-800/60 rounded-xl px-3 py-2.5 shadow-2xs flex items-center justify-between cursor-pointer hover:border-purple-500/50 hover:bg-purple-50/20 dark:hover:bg-purple-950/10 transition-all"
        :class="{ 'ring-2 ring-purple-500 border-purple-500': activeStatus === st.key }"
        @click="selectStatusTab(st.key)"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            :class="st.bgClass"
          >
            <UIcon :name="st.icon" class="w-4 h-4" />
          </div>
          <div class="truncate">
            <div class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ st.label }}</div>
          </div>
        </div>
        <span class="text-base font-bold text-gray-900 dark:text-white font-mono ml-2 shrink-0">{{ st.count }}</span>
      </div>
    </div>

    <!-- 过滤与搜索栏 -->
    <div class="bg-white dark:bg-[#121214] border border-gray-200/70 dark:border-gray-800/60 rounded-xl p-3 flex flex-wrap gap-3 items-center justify-between">
      <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
        <UInput
          v-model="keyword"
          placeholder="搜索工单号、标题、用户邮箱..."
          icon="ph:magnifying-glass"
          size="sm"
          class="w-64"
          @keydown.enter="loadTickets(1)"
        />

        <USelect
          v-model="selectedCategory"
          :items="categoryOptions"
          size="sm"
          class="w-36"
          @change="loadTickets(1)"
        />

        <USelect
          v-model="selectedPriority"
          :items="priorityOptions"
          size="sm"
          class="w-32"
          @change="loadTickets(1)"
        />

        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          @click="loadTickets(1)"
        >
          筛选
        </UButton>
      </div>
    </div>

    <!-- 工单列表卡片/表格 -->
    <div class="bg-white dark:bg-[#121214] border border-gray-200/70 dark:border-gray-800/60 rounded-2xl overflow-hidden shadow-2xs">
      <div v-if="loading" class="p-12 text-center text-gray-400">
        <UIcon name="ph:spinner" class="w-6 h-6 animate-spin mx-auto mb-2" />
        加载工单列表中...
      </div>

      <div v-else-if="ticketsList.length === 0" class="p-16 text-center text-gray-400">
        <UIcon name="ph:ticket" class="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p class="text-sm font-medium">暂无符合条件的工单</p>
      </div>

      <div v-else class="divide-y divide-gray-100 dark:divide-gray-800/60">
        <div
          v-for="item in ticketsList"
          :key="item.id"
          class="p-4 hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer"
          @click="openTicketDetail(item.id)"
        >
          <div class="min-w-0 flex-1 space-y-1.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono text-xs font-semibold text-purple-600 dark:text-purple-400">
                {{ item.ticketNo }}
              </span>
              <UBadge size="xs" :color="categoryBadgeColor(item.category)" variant="subtle">
                {{ categoryLabel(item.category) }}
              </UBadge>
              <UBadge size="xs" :color="priorityBadgeColor(item.priority)" variant="outline">
                {{ priorityLabel(item.priority) }}
              </UBadge>
              <UBadge size="xs" :color="statusBadgeColor(item.status)" variant="solid">
                {{ statusLabel(item.status) }}
              </UBadge>
              <span v-if="item.context" class="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded font-medium">
                <UIcon name="ph:code-bold" class="w-3 h-3" />
                含诊断快照
              </span>
            </div>

            <div class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ item.title }}
            </div>

            <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span class="inline-flex items-center gap-1">
                <UIcon name="ph:user" class="w-3.5 h-3.5" />
                {{ item.userEmail || item.userNickname || `用户 #${item.userId}` }}
              </span>
              <span class="inline-flex items-center gap-1">
                <UIcon name="ph:clock" class="w-3.5 h-3.5" />
                最后更新: {{ formatTime(item.lastRepliedAt || item.createdAt) }} ({{ replierLabel(item.lastRepliedBy) }})
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="ph:chat-teardrop-text"
              @click.stop="openTicketDetail(item.id)"
            >
              处理工单
            </UButton>
          </div>
        </div>
      </div>

      <!-- 分页栏 -->
      <div v-if="totalPages > 1" class="p-3 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between text-xs text-gray-500">
        <div>共 {{ totalItems }} 条工单</div>
        <div class="flex items-center gap-1">
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="page <= 1"
            @click="loadTickets(page - 1)"
          >
            上一页
          </UButton>
          <span class="px-2 font-mono font-medium">{{ page }} / {{ totalPages }}</span>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="page >= totalPages"
            @click="loadTickets(page + 1)"
          >
            下一页
          </UButton>
        </div>
      </div>
    </div>

    <!-- 工单详情与处理模态弹窗 / 抽屉 -->
    <UModal
      v-model:open="detailModalOpen"
      :ui="{ content: 'sm:max-w-4xl bg-white dark:bg-[#1a1a1e] rounded-3xl border border-gray-100 dark:border-white/10 shadow-2xl overflow-hidden' }"
    >
      <template #content>
        <div v-if="detailLoading" class="p-16 text-center text-gray-400">
          <UIcon name="ph:spinner" class="w-7 h-7 animate-spin mx-auto mb-2 text-[#6d4cff]" />
          正在载入工单详情...
        </div>

        <div v-else-if="detailTicket" class="p-6 sm:p-7 space-y-5 max-h-[85vh] overflow-y-auto">
          <!-- 弹窗顶栏 -->
          <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5">
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 font-semibold">{{ detailTicket.ticketNo }}</span>
              <UBadge size="xs" :color="statusBadgeColor(detailTicket.status)">{{ statusLabel(detailTicket.status) }}</UBadge>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:x"
              size="xs"
              class="rounded-xl text-gray-400 hover:text-gray-600"
              @click="detailModalOpen = false"
            />
          </div>

          <!-- 头部基础属性与快捷状态操作 -->
          <div class="bg-gray-50 dark:bg-white/[0.03] p-4 rounded-2xl border border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
            <div class="space-y-1">
              <div class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {{ detailTicket.title }}
                <UBadge size="xs" :color="statusBadgeColor(detailTicket.status)">{{ statusLabel(detailTicket.status) }}</UBadge>
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-3">
                <span>用户：{{ detailTicket.userEmail || `ID: ${detailTicket.userId}` }}</span>
                <span>分类：{{ categoryLabel(detailTicket.category) }}</span>
                <span>创建时间：{{ formatTime(detailTicket.createdAt) }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <USelect
                v-model="quickStatusChange"
                :items="statusUpdateOptions"
                size="xs"
                class="w-32"
                @change="updateStatus"
              />
              <USelect
                v-model="quickPriorityChange"
                :items="priorityUpdateOptions"
                size="xs"
                class="w-28"
                @change="updatePriority"
              />
            </div>
          </div>

          <!-- 用户钱包资产与快捷补偿卡片 (财务联动) -->
          <div v-if="detailUserFinance" class="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 space-y-3">
            <div class="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-300">
              <div class="flex items-center gap-1.5">
                <UIcon name="ph:wallet-duotone" class="w-4 h-4 text-blue-600" />
                提单用户账户资产概况 (User Balance & Orders)
              </div>
              <UButton
                size="xs"
                color="primary"
                variant="soft"
                icon="ph:plus-circle-bold"
                class="rounded-lg"
                @click="compensationModalOpen = true"
              >
                快捷发放财务补偿 / 额度
              </UButton>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div class="bg-white/80 dark:bg-black/20 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
                <span class="text-gray-400 block text-[11px]">现金余额</span>
                <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">¥{{ detailUserFinance.cashBalance }}</span>
              </div>
              <div class="bg-white/80 dark:bg-black/20 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
                <span class="text-gray-400 block text-[11px]">算力/赠送点数</span>
                <span class="font-mono font-bold text-[#6d4cff] dark:text-[#8ea3ff] text-sm">{{ detailUserFinance.grantBalance }} 点</span>
              </div>
              <div class="bg-white/80 dark:bg-black/20 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
                <span class="text-gray-400 block text-[11px]">订阅额度</span>
                <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">{{ detailUserFinance.subBalance }}</span>
              </div>
              <div class="bg-white/80 dark:bg-black/20 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
                <span class="text-gray-400 block text-[11px]">会员等级</span>
                <span class="font-mono font-medium text-amber-600 dark:text-amber-400">VIP {{ detailUserFinance.tierLevel }}</span>
              </div>
            </div>

            <!-- 最近订单 -->
            <div v-if="detailRecentOrders && detailRecentOrders.length > 0" class="pt-1 border-t border-blue-100/60 dark:border-blue-900/30 text-[11px] text-gray-600 dark:text-gray-400 flex flex-wrap items-center gap-3">
              <span class="font-medium text-gray-700 dark:text-gray-300">最近订单：</span>
              <div v-for="ord in detailRecentOrders" :key="ord.id" class="inline-flex items-center gap-1.5 font-mono">
                <span>{{ ord.id.slice(0, 10) }}... ({{ ord.amount }} {{ ord.currency }})</span>
                <UBadge size="2xs" :color="ord.payStatus === 'paid' ? 'success' : 'warning'" variant="subtle">{{ ord.payStatus }}</UBadge>
              </div>
            </div>
          </div>

          <!-- 无损现场诊断 Context 快照卡片 (核心技术亮点) -->
          <div v-if="detailTicket.context" class="rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 space-y-2">
            <div class="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <div class="flex items-center gap-1.5">
                <UIcon name="ph:cpu-duotone" class="w-4 h-4 text-emerald-600" />
                现场环境与错误诊断快照 (Context Snapshot)
              </div>
              <button
                type="button"
                class="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer text-[11px]"
                @click="showRawContext = !showRawContext"
              >
                {{ showRawContext ? '收起完整原始 JSON' : '查看完整原始 JSON' }}
              </button>
            </div>

            <!-- 格式化重点字段 -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-700 dark:text-gray-300">
              <div v-if="detailTicket.context.channel" class="bg-white/70 dark:bg-black/20 p-2 rounded border border-emerald-100 dark:border-emerald-900/40">
                <span class="text-gray-400 block text-[11px]">目标渠道</span>
                <span class="font-mono font-medium">{{ detailTicket.context.channel }}</span>
              </div>
              <div v-if="detailTicket.context.productId" class="bg-white/70 dark:bg-black/20 p-2 rounded border border-emerald-100 dark:border-emerald-900/40">
                <span class="text-gray-400 block text-[11px]">商品 ID</span>
                <span class="font-mono font-medium truncate block">{{ detailTicket.context.productId }}</span>
              </div>
              <div v-if="detailTicket.context.offerId" class="bg-white/70 dark:bg-black/20 p-2 rounded border border-emerald-100 dark:border-emerald-900/40">
                <span class="text-gray-400 block text-[11px]">SKU 货号 (Offer ID)</span>
                <span class="font-mono font-medium truncate block">{{ detailTicket.context.offerId }}</span>
              </div>
              <div v-if="detailTicket.context.taskId" class="bg-white/70 dark:bg-black/20 p-2 rounded border border-emerald-100 dark:border-emerald-900/40">
                <span class="text-gray-400 block text-[11px]">云端任务 ID</span>
                <span class="font-mono font-medium truncate block">{{ detailTicket.context.taskId }}</span>
              </div>
              <div v-if="detailTicket.context.lastError" class="col-span-2 sm:col-span-3 bg-red-50/80 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300">
                <span class="text-red-500 block text-[11px] font-medium">捕获的异常信息 (Last Error)</span>
                <span class="font-mono text-xs break-all">{{ detailTicket.context.lastError }}</span>
              </div>
            </div>

            <!-- 可折叠的完整 JSON 视图 -->
            <div v-if="showRawContext" class="mt-2">
              <pre class="bg-gray-900 text-emerald-400 p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-52">{{ JSON.stringify(detailTicket.context, null, 2) }}</pre>
            </div>
          </div>

          <!-- 对话消息时间轴 -->
          <div class="space-y-3 pt-2">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-400">交流记录与消息流</h4>
            <div class="space-y-3">
              <div
                v-for="msg in detailMessages"
                :key="msg.id"
                class="flex gap-3 p-3.5 rounded-xl text-sm"
                :class="messageBubbleClass(msg.senderType)"
              >
                <div class="shrink-0 pt-0.5">
                  <div
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                    :class="senderAvatarClass(msg.senderType)"
                  >
                    <UIcon :name="senderIcon(msg.senderType)" class="w-4 h-4" />
                  </div>
                </div>

                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-semibold text-gray-900 dark:text-white">
                      {{ msg.senderName || senderLabel(msg.senderType) }}
                    </span>
                    <span class="text-gray-400 text-[11px]">{{ formatTime(msg.createdAt) }}</span>
                  </div>

                  <div class="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {{ msg.content }}
                  </div>

                  <!-- 附件缩略图 -->
                  <div v-if="msg.attachments && msg.attachments.length > 0" class="flex flex-wrap gap-2 pt-2">
                    <div
                      v-for="(att, aIdx) in msg.attachments"
                      :key="att.url || aIdx"
                      class="w-16 h-16 rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden cursor-pointer hover:scale-105 transition-transform bg-white/40 dark:bg-black/20"
                      @click="previewImage(att.url)"
                    >
                      <img :src="buildImageProxyUrl(att.url)" :alt="att.name || '附件'" class="w-full h-full object-cover" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 回复操作框 -->
          <div class="border-t border-gray-200/80 dark:border-gray-800/80 pt-4 space-y-3">
            <div class="flex items-center justify-between text-xs text-gray-500">
              <span>快捷回复模板：</span>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  class="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded text-[11px] cursor-pointer"
                  @click="replyContent = '您好，我们已根据您上报的现场快照对该问题进行了修复，请重新尝试操作。如有异常欢迎继续反馈。'"
                >
                  已修复重试
                </button>
                <button
                  type="button"
                  class="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded text-[11px] cursor-pointer"
                  @click="replyContent = '您好，已核实该异常为渲染节点网络抖动所致，系统已为您自动补发对应的算力额度，请在钱包账单中查验。'"
                >
                  已补发额度
                </button>
              </div>
            </div>

            <UTextarea
              v-model="replyContent"
              placeholder="输入回复内容（支持 Markdown 换行）..."
              :rows="3"
              class="w-full"
            />

            <!-- 管理员上传截图/凭证 -->
            <TicketAttachmentUpload v-model="adminReplyAttachments" :admin-mode="true" />

            <div class="flex items-center justify-between pt-2">
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">回复后工单流转为：</span>
                <USelect
                  v-model="statusAfterReply"
                  :items="statusUpdateOptions"
                  size="xs"
                  class="w-28"
                />
              </div>

              <div class="flex items-center gap-2">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="detailModalOpen = false"
                >
                  关闭
                </UButton>
                <UButton
                  color="primary"
                  size="sm"
                  :loading="replySubmitting"
                  :disabled="!replyContent.trim()"
                  icon="ph:paper-plane-tilt-bold"
                  @click="submitReply"
                >
                  发送回复
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 快捷财务补偿弹窗 -->
    <UModal
      v-model:open="compensationModalOpen"
      :ui="{ content: 'sm:max-w-md bg-white dark:bg-[#1a1a1e] rounded-3xl border border-gray-100 dark:border-white/10 shadow-2xl overflow-hidden' }"
    >
      <template #content>
        <div class="p-6 sm:p-7 space-y-5">
          <!-- 弹窗顶栏 -->
          <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <UIcon name="ph:hand-coins-duotone" class="w-4 h-4" />
              </div>
              <div>
                <h3 class="text-base font-bold text-gray-900 dark:text-white">发放财务补偿 / 额度</h3>
                <p class="text-xs text-gray-400 mt-0.5">直接入账并在工单中留下财务凭据</p>
              </div>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:x"
              size="xs"
              class="rounded-xl text-gray-400 hover:text-gray-600"
              @click="compensationModalOpen = false"
            />
          </div>

          <div class="text-xs text-gray-500 bg-gray-50 dark:bg-white/[0.02] p-2.5 rounded-xl border border-gray-100 dark:border-white/5">
            为当前工单提单用户（<span class="font-mono font-medium text-gray-800 dark:text-gray-200">{{ detailTicket?.userEmail || detailTicket?.userId }}</span>）发放补偿额度。
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              补偿类型 <span class="text-red-500">*</span>
            </label>
            <USelect
              v-model="compensationType"
              :items="[
                { label: '算力点数 / 赠送额度 (Grant)', value: 'grant' },
                { label: '现金余额 (Cash)', value: 'cash' },
              ]"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              补偿数额 <span class="text-red-500">*</span>
            </label>
            <UInput
              v-model.number="compensationAmount"
              type="number"
              placeholder="请输入点数或金额"
              class="w-full font-mono"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              补偿原因 / 备注 <span class="text-red-500">*</span>
            </label>
            <UInput
              v-model="compensationReason"
              placeholder="例如：任务超时失败补偿 / 充值延迟补偿"
              class="w-full"
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/5">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              class="rounded-xl"
              @click="compensationModalOpen = false"
            >
              取消
            </UButton>
            <UButton
              color="primary"
              size="sm"
              :loading="compensationSubmitting"
              :disabled="compensationAmount <= 0 || !compensationReason.trim()"
              class="rounded-xl bg-[#6d4cff] hover:bg-[#5a3de6] text-white"
              @click="submitCompensation"
            >
              确认发放补偿
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 图片放大预览模态框 -->
    <UModal v-model:open="previewModalOpen" :ui="{ content: 'sm:max-w-3xl bg-black/90 p-2 overflow-hidden' }">
      <template #content>
        <div class="relative flex items-center justify-center min-h-[50vh] p-2">
          <button
            type="button"
            class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center"
            @click="previewModalOpen = false"
          >
            <UIcon name="ph:x-bold" class="w-4 h-4" />
          </button>
          <img
            v-if="currentPreviewUrl"
            :src="buildImageProxyUrl(currentPreviewUrl)"
            alt="放大预览"
            class="max-w-full max-h-[80vh] rounded-lg object-contain"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useImageProxy } from '~/composables/useImageProxy'
import TicketAttachmentUpload, { type TicketAttachment } from '../../themes/qingpu/components/TicketAttachmentUpload.vue'

definePageMeta({
  title: 'Tickets Management',
  layout: 'admin',
})

const { buildImageProxyUrl } = useImageProxy()

const loading = ref(false)
const ticketsList = ref<any[]>([])
const ALL = 'all'
const activeStatus = ref<string>('all')
const keyword = ref('')
const selectedCategory = ref<string>(ALL)
const selectedPriority = ref<string>(ALL)
const page = ref(1)
const pageSize = ref(15)
const totalItems = ref(0)
const totalPages = ref(1)

const summary = ref({
  all: 0,
  open: 0,
  in_progress: 0,
  auto_resolved: 0,
  resolved: 0,
  closed: 0,
})

// 状态卡片选项
const statusTabs = computed(() => [
  { key: 'all', label: '全部工单', count: summary.value.all, icon: 'ph:ticket', bgClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  { key: 'open', label: '待处理', count: summary.value.open, icon: 'ph:hourglass', bgClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  { key: 'in_progress', label: '处理中', count: summary.value.in_progress, icon: 'ph:arrows-clockwise', bgClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
  { key: 'auto_resolved', label: '已自动解决', count: summary.value.auto_resolved, icon: 'ph:robot', bgClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
  { key: 'resolved', label: '已完结', count: summary.value.resolved + summary.value.closed, icon: 'ph:check-circle', bgClass: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400' },
])

const categoryOptions = [
  { label: '全部业务分类', value: ALL },
  { label: '跨境上品 (Listing)', value: 'listing' },
  { label: '视觉创作 (Studio)', value: 'studio' },
  { label: '插件/客户端 (Extension)', value: 'extension' },
  { label: '充值与账单 (Billing)', value: 'billing' },
  { label: '账号权益 (Account)', value: 'account' },
  { label: '其他咨询 (Other)', value: 'other' },
]

const priorityOptions = [
  { label: '全部优先级', value: ALL },
  { label: '紧急 (Urgent)', value: 'urgent' },
  { label: '高 (High)', value: 'high' },
  { label: '普通 (Normal)', value: 'normal' },
  { label: '低 (Low)', value: 'low' },
]

const priorityUpdateOptions = [
  { label: '紧急 (Urgent)', value: 'urgent' },
  { label: '高 (High)', value: 'high' },
  { label: '普通 (Normal)', value: 'normal' },
  { label: '低 (Low)', value: 'low' },
]

const statusUpdateOptions = [
  { label: '待处理', value: 'open' },
  { label: '保持处理中', value: 'in_progress' },
  { label: '设为已解决', value: 'resolved' },
  { label: '直接关闭', value: 'closed' },
]

// 详情模态框状态
const detailModalOpen = ref(false)
const detailLoading = ref(false)
const detailTicket = ref<any>(null)
const detailMessages = ref<any[]>([])
const detailUserFinance = ref<any>(null)
const detailRecentOrders = ref<any[]>([])
const showRawContext = ref(false)
const replyContent = ref('')
const adminReplyAttachments = ref<TicketAttachment[]>([])
const statusAfterReply = ref('resolved')
const replySubmitting = ref(false)
const quickStatusChange = ref('')
const quickPriorityChange = ref('')

// 图片放大预览状态
const previewModalOpen = ref(false)
const currentPreviewUrl = ref('')

const previewImage = (url: string) => {
  currentPreviewUrl.value = url
  previewModalOpen.value = true
}

// 快捷财务补偿状态
const compensationModalOpen = ref(false)
const compensationAmount = ref(20)
const compensationType = ref<'grant' | 'cash'>('grant')
const compensationReason = ref('任务异常/充值疑问核实补偿')
const compensationSubmitting = ref(false)

const selectStatusTab = (key: string) => {
  activeStatus.value = key
  loadTickets(1)
}

const loadTickets = async (p = page.value) => {
  loading.value = true
  page.value = p
  try {
    const params: Record<string, any> = {
      page: page.value,
      pageSize: pageSize.value,
    }
    if (activeStatus.value && activeStatus.value !== 'all') {
      params.status = activeStatus.value
    }
    if (keyword.value.trim()) {
      params.keyword = keyword.value.trim()
    }
    if (selectedCategory.value && selectedCategory.value !== ALL) {
      params.category = selectedCategory.value
    }
    if (selectedPriority.value && selectedPriority.value !== ALL) {
      params.priority = selectedPriority.value
    }

    const res: any = await $fetch('/api/admin/tickets', { params })
    if (res?.code === 200) {
      ticketsList.value = res.data || []
      totalItems.value = res.pagination?.total || 0
      totalPages.value = res.pagination?.totalPages || 1
      if (res.summary) {
        summary.value = res.summary
      }
    }
  } catch (e) {
    console.error('Failed to load tickets', e)
  } finally {
    loading.value = false
  }
}

const openTicketDetail = async (id: number) => {
  detailModalOpen.value = true
  detailLoading.value = true
  showRawContext.value = false
  replyContent.value = ''
  adminReplyAttachments.value = []
  try {
    const res: any = await $fetch(`/api/admin/tickets/${id}`)
    if (res?.code === 200) {
      detailTicket.value = res.data?.ticket
      detailMessages.value = res.data?.messages || []
      detailUserFinance.value = res.data?.userFinance || null
      detailRecentOrders.value = res.data?.recentOrders || []
      quickStatusChange.value = detailTicket.value?.status || 'open'
      quickPriorityChange.value = detailTicket.value?.priority || 'normal'
    }
  } catch (e) {
    console.error('Failed to load ticket detail', e)
  } finally {
    detailLoading.value = false
  }
}

const submitCompensation = async () => {
  if (!detailTicket.value || compensationAmount.value <= 0) return
  compensationSubmitting.value = true
  try {
    const res: any = await $fetch(`/api/admin/tickets/${detailTicket.value.id}/compensation`, {
      method: 'POST',
      body: {
        amount: Number(compensationAmount.value),
        balanceType: compensationType.value,
        reason: compensationReason.value.trim(),
      },
    })
    if (res?.code === 200) {
      compensationModalOpen.value = false
      await openTicketDetail(detailTicket.value.id)
      void loadTickets()
    }
  } catch (e) {
    console.error('Failed to submit compensation', e)
  } finally {
    compensationSubmitting.value = false
  }
}

const submitReply = async () => {
  if (!replyContent.value.trim() || !detailTicket.value) return
  replySubmitting.value = true
  try {
    const res: any = await $fetch(`/api/admin/tickets/${detailTicket.value.id}/reply`, {
      method: 'POST',
      body: {
        content: replyContent.value.trim(),
        status: statusAfterReply.value,
        attachments: adminReplyAttachments.value.length > 0 ? adminReplyAttachments.value : null,
      },
    })
    if (res?.code === 200) {
      replyContent.value = ''
      adminReplyAttachments.value = []
      // 重新载入详情与列表
      await openTicketDetail(detailTicket.value.id)
      void loadTickets()
    }
  } catch (e) {
    console.error('Failed to submit reply', e)
  } finally {
    replySubmitting.value = false
  }
}

const updateStatus = async () => {
  if (!detailTicket.value || !quickStatusChange.value) return
  try {
    await $fetch(`/api/admin/tickets/${detailTicket.value.id}/status`, {
      method: 'PUT',
      body: { status: quickStatusChange.value },
    })
    await openTicketDetail(detailTicket.value.id)
    void loadTickets()
  } catch (e) {
    console.error('Failed to update status', e)
  }
}

const updatePriority = async () => {
  if (!detailTicket.value || !quickPriorityChange.value) return
  try {
    await $fetch(`/api/admin/tickets/${detailTicket.value.id}/status`, {
      method: 'PUT',
      body: { priority: quickPriorityChange.value },
    })
    await openTicketDetail(detailTicket.value.id)
    void loadTickets()
  } catch (e) {
    console.error('Failed to update priority', e)
  }
}

// 辅助样式与文案转换
const statusBadgeColor = (status: string) => {
  switch (status) {
    case 'open': return 'warning'
    case 'in_progress': return 'info'
    case 'auto_resolved': return 'success'
    case 'resolved': return 'neutral'
    case 'closed': return 'neutral'
    default: return 'neutral'
  }
}

const statusLabel = (status: string) => {
  switch (status) {
    case 'open': return '待处理'
    case 'in_progress': return '处理中'
    case 'auto_resolved': return '已自动解决'
    case 'resolved': return '已解决'
    case 'closed': return '已关闭'
    default: return status
  }
}

const categoryBadgeColor = (cat: string) => {
  switch (cat) {
    case 'listing': return 'primary'
    case 'studio': return 'secondary'
    case 'billing': return 'warning'
    case 'extension': return 'info'
    default: return 'neutral'
  }
}

const categoryLabel = (cat: string) => {
  const map: Record<string, string> = {
    listing: '上品排障',
    studio: '视觉创作',
    extension: '插件客户端',
    billing: '充值账单',
    account: '账号权益',
    other: '综合问题',
  }
  return map[cat] || cat
}

const priorityBadgeColor = (p: string) => {
  switch (p) {
    case 'urgent': return 'error'
    case 'high': return 'warning'
    case 'normal': return 'info'
    case 'low': return 'neutral'
    default: return 'neutral'
  }
}

const priorityLabel = (p: string) => {
  const map: Record<string, string> = {
    urgent: '紧急',
    high: '高优',
    normal: '普通',
    low: '低',
  }
  return map[p] || p
}

const replierLabel = (r: string) => {
  switch (r) {
    case 'user': return '用户提问'
    case 'admin': return '客服已回复'
    case 'bot': return 'AI 智能答复'
    case 'system': return '系统状态变更'
    default: return r
  }
}

const messageBubbleClass = (senderType: string) => {
  switch (senderType) {
    case 'bot': return 'bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40'
    case 'admin': return 'bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40'
    case 'system': return 'bg-gray-100/70 dark:bg-white/[0.04] text-xs text-gray-500'
    default: return 'bg-white dark:bg-[#18181b] border border-gray-200/80 dark:border-white/5'
  }
}

const senderAvatarClass = (senderType: string) => {
  switch (senderType) {
    case 'bot': return 'bg-emerald-500 text-white'
    case 'admin': return 'bg-purple-600 text-white'
    case 'system': return 'bg-gray-400 text-white'
    default: return 'bg-blue-500 text-white'
  }
}

const senderIcon = (senderType: string) => {
  switch (senderType) {
    case 'bot': return 'ph:robot-bold'
    case 'admin': return 'ph:shield-check-bold'
    case 'system': return 'ph:info-bold'
    default: return 'ph:user-bold'
  }
}

const senderLabel = (senderType: string) => {
  switch (senderType) {
    case 'bot': return '轻铺AI 智能助手'
    case 'admin': return '客服专员'
    case 'system': return '系统记录'
    default: return '用户'
  }
}

const formatTime = (time: string | Date | undefined) => {
  if (!time) return '-'
  const d = new Date(time)
  return d.toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  void loadTickets(1)
})
</script>
