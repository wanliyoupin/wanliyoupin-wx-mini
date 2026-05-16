<template>
  <view class="company-user-list-page">
    <!-- 顶部：搜索 + 角色筛选 + 数量 -->
    <view class="header-bar">
      <view class="search-row">
        <input :adjust-position="false"
          class="search-input"
          v-model="listSearchKeyword"
          placeholder="搜索昵称或手机号"
          placeholder-class="search-placeholder"
        />
      </view>
      <view class="filter-row">
        <view
          class="filter-tab"
          :class="{ active: roleFilter === '' }"
          @click="setRoleFilter('')"
        >
          全部
        </view>
        <view
          class="filter-tab"
          :class="{ active: roleFilter === 'user' }"
          @click="setRoleFilter('user')"
        >
          普通用户
        </view>
        <view
          class="filter-tab"
          :class="{ active: roleFilter === 'admin' }"
          @click="setRoleFilter('admin')"
        >
          管理员
        </view>
      </view>
      <view class="filter-row level-filter-row">
        <text class="level-filter-label">等级：</text>
        <view
          v-for="lv in levelOptions"
          :key="lv.value"
          class="filter-tab level-tab"
          :class="{ active: levelFilter === lv.value }"
          @click="setLevelFilter(lv.value)"
        >
          {{ lv.label }}
        </view>
      </view>
      <view class="count-row">
        <text class="count-text">{{ countText }}</text>
      </view>
      <view class="header-actions">
        <button v-if="!isViewOnly" class="batch-btn" @click="showBatchModal = true">批量修改</button>
        <button v-if="!isViewOnly" class="add-btn" @click="showAddModal = true">+ 添加用户</button>
        <text v-else class="view-only-tip">仅查看，不可操作</text>
      </view>
    </view>

    <!-- 用户列表（仅此区域滚动） -->
    <scroll-view 
      scroll-y 
      class="user-list-scroll"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onListRefresh"
      @scrolltolower="loadMore"
    >
      <view class="user-list">
      <view 
        v-for="user in filteredUsers" 
        :key="user.id"
        class="user-item"
      >
        <view class="user-info">
          <image 
            v-if="user.user?.avatar_url" 
            :src="user.user.avatar_url" 
            class="user-avatar"
            mode="aspectFill"
          />
          <view v-else class="user-avatar-placeholder">
            <text>{{ user.user?.nickname?.[0] || 'U' }}</text>
          </view>
          <view class="user-details">
            <view class="user-name">{{ user.user?.nickname || user.user?.mobile }}</view>
            <view class="user-meta">
              <text class="user-phone">{{ user.user?.mobile || '—' }}</text>
              <text class="user-role" :class="{ 'role-admin': user.role === 'admin' }">
                {{ user.role === 'admin' ? '管理员' : '用户' }}
              </text>
              <text class="user-level">等级 {{ user.level || 'A' }}</text>
            </view>
            <view class="user-permissions">
              <text class="permission-tag" :class="{ 'tag-enabled': user.can_view_price }">
                {{ user.can_view_price ? '可查看价格' : '不可查看价格' }}
              </text>
              <text class="permission-tag">价格系数: {{ user.price_factor }}</text>
            </view>
          </view>
        </view>
        <view v-if="!isViewOnly" class="user-actions">
          <view class="action-btn" @click="editUser(user)">编辑</view>
          <view class="action-btn delete" @click="confirmRemoveUser(user)">移除</view>
        </view>
      </view>

      <!-- 空状态 / 搜索无结果 -->
      <view v-if="(users.length === 0 && !loading) || (users.length > 0 && filteredUsers.length === 0 && !loading)" class="empty-state">
        <text class="empty-text">{{ users.length === 0 ? '暂无用户' : '未找到匹配的用户' }}</text>
        <button v-if="!isViewOnly && users.length === 0" class="empty-btn" @click="showAddModal = true">添加用户</button>
      </view>

      <!-- 加载中 -->
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>
      </view>
    </scroll-view>

    <!-- 添加/编辑用户弹窗 -->
    <view v-if="showAddModal || showEditModal" class="modal-overlay" @click="closeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ showEditModal ? '编辑用户' : '添加用户' }}</text>
          <text class="modal-close" @click="closeModal">×</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <view class="label">手机号 <text class="required">*</text></view>
            <input 
              class="form-input" 
              v-model="userForm.mobile" 
              placeholder="请输入手机号"
              :disabled="showEditModal"
              maxlength="11"
              type="number"
            />
            <button 
              v-if="!showEditModal" 
              class="search-btn" 
              @click="searchUser"
              :disabled="!userForm.mobile || userForm.mobile.length !== 11"
            >
              搜索用户
            </button>
          </view>

          <view v-if="searchedUser" class="searched-user-info">
            <image 
              v-if="searchedUser.avatar_url" 
              :src="searchedUser.avatar_url" 
              class="searched-avatar"
              mode="aspectFill"
            />
            <view v-else class="searched-avatar-placeholder">
              <text>{{ searchedUser.nickname?.[0] || 'U' }}</text>
            </view>
            <view class="searched-details">
              <text class="searched-name">{{ searchedUser.nickname || searchedUser.mobile }}</text>
              <text class="searched-phone">{{ searchedUser.mobile }}</text>
            </view>
          </view>

          <!-- 未找到用户时提示，底部按钮会变为「创建并添加」 -->
          <view v-if="!showEditModal && !searchedUser && showCreateAndAddMode" class="create-user-tip">
            <text class="create-user-tip-text">该手机号尚未注册</text>
            <text class="create-user-tip-desc">请设置角色与价格系数后，点击下方「创建并添加」</text>
          </view>

          <view class="form-item">
            <view class="label">用户角色</view>
            <view class="role-options">
              <view 
                class="role-option" 
                :class="{ active: userForm.role === 'user' }"
                @click="userForm.role = 'user'"
              >
                普通用户
              </view>
              <view 
                class="role-option" 
                :class="{ active: userForm.role === 'admin' }"
                @click="userForm.role = 'admin'"
              >
                管理员
              </view>
            </view>
          </view>

          <view class="form-item">
            <view class="label">客户等级</view>
            <view class="level-options level-options-form">
              <view
                v-for="lv in batchLevelOptions"
                :key="lv"
                class="level-option"
                :class="{ active: userForm.level === lv }"
                @click="userForm.level = lv"
              >
                {{ lv }}
              </view>
            </view>
          </view>

          <view class="form-item">
            <view class="label">
              <checkbox 
                :checked="userForm.can_view_price" 
                @tap="userForm.can_view_price = !userForm.can_view_price"
              />
              <text style="margin-left: 10rpx;">允许查看价格</text>
            </view>
          </view>

          <view class="form-item">
            <view class="label">价格系数 <text class="required">*</text></view>
            <input 
              class="form-input" 
              type="digit" 
              v-model="userForm.price_factor" 
              placeholder="大于0，如 1 或 0.9 表示9折"
              @input="onPriceFactorInput"
            />
            <view class="form-hint">价格系数需大于0，1表示原价，0.9表示9折</view>
          </view>
        </view>
        <view class="modal-footer">
          <button 
            class="modal-btn"
            :class="{ disabled: !showEditModal && !hasSearched }"
            :disabled="!showEditModal && !hasSearched"
            @click="isCreateAndAddMode ? handleCreateAndAdd() : handleSaveUser()"
          >
            {{ isCreateAndAddMode ? '创建并添加' : '保存' }}
          </button>
          <button class="modal-btn cancel" @click="closeModal">取消</button>
        </view>
      </view>
    </view>

    <!-- 批量修改弹窗 -->
    <view v-if="showBatchModal" class="modal-overlay" @click="showBatchModal = false">
      <view class="modal-content batch-modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">批量修改</text>
          <text class="modal-close" @click="showBatchModal = false">×</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <view class="label">修改类型</view>
            <view class="batch-mode-options">
              <view
                class="batch-mode-option"
                :class="{ active: batchMode === 'price_visible' }"
                @click="batchMode = 'price_visible'"
              >
                批量显隐价格
              </view>
              <view
                class="batch-mode-option"
                :class="{ active: batchMode === 'price_factor' }"
                @click="batchMode = 'price_factor'"
              >
                批量改价格系数
              </view>
            </view>
          </view>
          <view class="form-item">
            <view class="label">选择等级</view>
            <view class="level-options">
              <view
                v-for="lv in batchLevelOptions"
                :key="lv"
                class="level-option"
                :class="{ active: batchLevel === lv }"
                @click="batchLevel = lv"
              >
                {{ lv }}
              </view>
            </view>
          </view>
          <view v-if="batchMode === 'price_visible'" class="form-item">
            <view class="label">
              <checkbox
                :checked="batchCanViewPrice"
                @tap="batchCanViewPrice = !batchCanViewPrice"
              />
              <text style="margin-left: 10rpx;">是否展示价格</text>
            </view>
          </view>
          <view v-else class="form-item">
            <view class="label">价格系数 <text class="required">*</text></view>
            <input
              class="form-input"
              type="digit"
              v-model="batchPriceFactor"
              placeholder="如 1 或 0.9 表示9折"
            />
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn" :disabled="batchSubmitting" @click="confirmBatch">确定</button>
          <button class="modal-btn cancel" @click="showBatchModal = false">取消</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { companyInfo } from '@/store/userStore';
import { getCompanyDetailCached } from '@/subPackages/company/api/platform';
import { getCompanyUserList, searchUserByMobile, createUserByMobile, addCompanyUser, updateCompanyUser, removeCompanyUser, batchUpdateCompanyUsersByLevel, COMPANY_USER_LEVELS, type CompanyUserLevel } from '@/subPackages/company/api/company-user';

const users = ref<any[]>([]);
const loading = ref(false);
const isRefreshing = ref(false);
/** 列表页搜索：昵称或手机号 */
const listSearchKeyword = ref('');
/** 角色筛选 */
const roleFilter = ref<'' | 'user' | 'admin'>('');
/** 等级筛选：空为全部，否则 A/B/C/D/E/F */
const levelFilter = ref<'' | CompanyUserLevel>('');
const totalCount = ref(0);

const levelOptions = [{ value: '' as const, label: '全部' }, ...COMPANY_USER_LEVELS.map((v) => ({ value: v as CompanyUserLevel, label: v }))];

// 当前筛选下的用户数量文案（角色与等级同时筛选时用顿号连接，如：管理员、等级A 共 2 人）
const countText = computed(() => {
  const n = totalCount.value;
  const parts: string[] = [];
  if (roleFilter.value === 'user') parts.push('普通用户');
  if (roleFilter.value === 'admin') parts.push('管理员');
  if (levelFilter.value) parts.push(`等级${levelFilter.value}`);
  if (parts.length === 0) return `共 ${n} 人`;
  return `${parts.join('、')} 共 ${n} 人`;
});

// 列表搜索过滤（昵称、手机号）
const filteredUsers = computed(() => {
  const kw = (listSearchKeyword.value || '').trim().toLowerCase();
  if (!kw) return users.value;
  return users.value.filter((u: any) => {
    const name = (u.user?.nickname || '').toLowerCase();
    const mobile = (u.user?.mobile || '').toLowerCase();
    return name.includes(kw) || mobile.includes(kw);
  });
});

// 超级管理员从公司管理点进来时传入的 companyId（核查只读）
const viewCompanyId = ref<number | null>(null);
const effectiveCompanyId = () => viewCompanyId.value ?? companyInfo.value?.id ?? null;
/** 公司配置：价格系数等；添加成员时默认可看价与「访客默认可看价」无关 */
const companyDefaults = ref<{ default_for_price_factor: number } | null>(null);
/** 核查入口只读：不显示添加/编辑/删除 */
const isViewOnly = computed(() => !!viewCompanyId.value);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);

// 弹窗相关
const showAddModal = ref(false);
const showEditModal = ref(false);
const editingUserId = ref<number | null>(null);
const searchedUser = ref<any>(null);
/** 搜索后未找到用户时，是否显示「创建默认账号并添加」入口（仅添加模式） */
const showCreateAndAddMode = ref(false);
/** 当前为「无账号，创建并添加」模式：底部主按钮显示「创建并添加」 */
const isCreateAndAddMode = computed(
  () => !showEditModal.value && !searchedUser.value && showCreateAndAddMode.value
);
/** 添加模式下是否已点击过「搜索用户」（未搜索前保存/创建并添加按钮不可点） */
const hasSearched = ref(false);
const userForm = ref({
  mobile: '',
  role: 'user' as 'admin' | 'user',
  level: 'A' as CompanyUserLevel,
  can_view_price: false,
  price_factor: '1',
});

// 批量修改弹窗
const showBatchModal = ref(false);
const batchMode = ref<'price_visible' | 'price_factor'>('price_visible');
const batchLevel = ref<CompanyUserLevel>('A');
const batchCanViewPrice = ref(false);
const batchPriceFactor = ref('1');
const batchSubmitting = ref(false);
const batchLevelOptions = COMPANY_USER_LEVELS;

// 加载公司默认配置（用于添加用户时默认填充）
const loadCompanyDefaults = async () => {
  const cid = effectiveCompanyId();
  if (!cid) return;
  try {
    const company = await getCompanyDetailCached(cid);
    if (company) {
      const c = company as any;
      companyDefaults.value = {
        default_for_price_factor: Number(c.default_for_price_factor) || 1,
      };
    } else {
      companyDefaults.value = { default_for_price_factor: 1 };
    }
  } catch {
    companyDefaults.value = { default_for_price_factor: 1 };
  }
};

/** 添加用户时的表单默认值（来自公司配置） */
function getDefaultUserForm() {
  const d = companyDefaults.value;
  return {
    mobile: '',
    role: 'user' as const,
    level: 'A' as CompanyUserLevel,
    can_view_price: true,
    price_factor: String(d?.default_for_price_factor ?? 1),
  };
}

// 加载用户列表
const loadUsers = async (reset = false) => {
  if (loading.value || (!hasMore.value && !reset)) {
    return;
  }

  if (reset) {
    page.value = 1;
    hasMore.value = true;
    isRefreshing.value = true;
  }

  const companyId = effectiveCompanyId();
  if (!companyId) {
    uni.showToast({
      title: '公司信息不存在',
      icon: 'none',
    });
    return;
  }

  loading.value = true;

  try {
    const result = await getCompanyUserList({
      companyId,
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
      role: roleFilter.value || undefined,
      level: levelFilter.value || undefined,
    });

    if (reset) {
      users.value = [];
    }

    users.value = [...users.value, ...(result.users || [])];
    totalCount.value = result.total ?? 0;

    if (result.total <= users.value.length) {
      hasMore.value = false;
    } else {
      page.value++;
    }
  } catch (error: any) {
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
    isRefreshing.value = false;
    uni.stopPullDownRefresh();
  }
};

function onListRefresh() {
  loadUsers(true);
}

function loadMore() {
  loadUsers();
}

// 角色筛选
const setRoleFilter = (role: '' | 'user' | 'admin') => {
  roleFilter.value = role;
  loadUsers(true);
};

// 等级筛选
const setLevelFilter = (level: '' | CompanyUserLevel) => {
  levelFilter.value = level;
  loadUsers(true);
};

// 搜索用户
const searchUser = async () => {
  if (!userForm.value.mobile || userForm.value.mobile.length !== 11) {
    uni.showToast({
      title: '请输入正确的手机号',
      icon: 'none',
    });
    return;
  }

  showCreateAndAddMode.value = false;
  try {
    const user = await searchUserByMobile(userForm.value.mobile);
    if (user) {
      searchedUser.value = user;
    } else {
      searchedUser.value = null;
      showCreateAndAddMode.value = true;
    }
    hasSearched.value = true;
  } catch (error: any) {
    uni.showToast({
      title: error.message || '搜索失败',
      icon: 'none',
    });
    searchedUser.value = null;
    showCreateAndAddMode.value = false;
  }
};

// 从公司移除（删除 company_users 关系，不删账号）
const confirmRemoveUser = (row: any) => {
  const name = row.user?.nickname || row.user?.mobile || '该用户';
  uni.showModal({
    title: '移除用户',
    content: `确定将「${name}」从本公司移除？对方账号仍存在，仅不再归属该公司。`,
    confirmText: '移除',
    confirmColor: '#ff6b6b',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        const ok = await removeCompanyUser(row.id);
        if (!ok) {
          uni.showToast({ title: '移除失败', icon: 'none' });
          return;
        }
        uni.showToast({ title: '已移除', icon: 'success' });
        loadUsers(true);
      } catch (error: any) {
        uni.showToast({ title: error.message || '移除失败', icon: 'none' });
      }
    },
  });
};

// 编辑用户
const editUser = (user: any) => {
  editingUserId.value = user.id;
  searchedUser.value = user.user;
  userForm.value = {
    mobile: user.user.mobile,
    role: user.role,
    level: (user.level && COMPANY_USER_LEVELS.includes(user.level)) ? user.level : 'A',
    can_view_price: user.can_view_price,
    price_factor: String(user.price_factor),
  };
  showEditModal.value = true;
};

// 批量修改确认
const confirmBatch = async () => {
  const companyId = effectiveCompanyId();
  if (!companyId) {
    uni.showToast({ title: '公司信息不存在', icon: 'none' });
    return;
  }
  if (batchMode.value === 'price_factor') {
    const v = Number(batchPriceFactor.value);
    if (isNaN(v) || v <= 0) {
      uni.showToast({ title: '价格系数必须大于0', icon: 'none' });
      return;
    }
  }
  batchSubmitting.value = true;
  try {
    const updates: { can_view_price?: boolean; price_factor?: number } = {};
    if (batchMode.value === 'price_visible') {
      updates.can_view_price = batchCanViewPrice.value;
    } else {
      updates.price_factor = Number(batchPriceFactor.value);
    }
    const { updated } = await batchUpdateCompanyUsersByLevel({
      companyId,
      level: batchLevel.value,
      updates,
    });
    uni.showToast({ title: `已更新 ${updated} 人`, icon: 'success' });
    showBatchModal.value = false;
    loadUsers(true);
  } catch (error: any) {
    uni.showToast({ title: error.message || '批量修改失败', icon: 'none' });
  } finally {
    batchSubmitting.value = false;
  }
};

// 保存用户
const handleSaveUser = async () => {
  if (!userForm.value.mobile || userForm.value.mobile.length !== 11) {
    uni.showToast({
      title: '请输入正确的手机号',
      icon: 'none',
    });
    return;
  }

  if (!searchedUser.value && !showEditModal) {
    uni.showToast({
      title: '请先搜索用户',
      icon: 'none',
    });
    return;
  }

  const priceFactor = Number(userForm.value.price_factor);
  if (isNaN(priceFactor) || priceFactor <= 0) {
    uni.showToast({
      title: '价格系数必须大于0',
      icon: 'none',
    });
    return;
  }

  const companyId = effectiveCompanyId();
  if (!companyId) {
    uni.showToast({
      title: '公司信息不存在',
      icon: 'none',
    });
    return;
  }

  try {
    const userData = {
      user_users: searchedUser.value.id,
      company_companies: companyId,
      role: userForm.value.role,
      level: userForm.value.level,
      can_view_price: userForm.value.can_view_price,
      price_factor: priceFactor,
    };

    if (showEditModal && editingUserId.value) {
      await updateCompanyUser(editingUserId.value, userData);
    } else {
      await addCompanyUser(userData);
    }

    uni.showToast({
      title: '保存成功',
      icon: 'success',
    });

    closeModal();
    loadUsers(true);
  } catch (error: any) {
    uni.showToast({
      title: error.message || '保存失败',
      icon: 'none',
    });
  }
};

// 价格系数输入：只保留数字和最多一个小数点
const onPriceFactorInput = (e: any) => {
  const raw = (e?.detail?.value ?? e?.target?.value ?? '') as string;
  let s = raw.replace(/[^\d.]/g, '');
  const idx = s.indexOf('.');
  if (idx >= 0) {
    s = s.slice(0, idx + 1) + s.slice(idx + 1).replace(/\./g, '');
  }
  userForm.value.price_factor = s;
};

// 创建默认账号并添加至公司（未找到用户时使用）
const handleCreateAndAdd = async () => {
  const mobile = (userForm.value.mobile || '').trim();
  if (mobile.length !== 11) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' });
    return;
  }

  const priceFactor = Number(userForm.value.price_factor);
  if (isNaN(priceFactor) || priceFactor <= 0) {
    uni.showToast({ title: '价格系数必须大于0', icon: 'none' });
    return;
  }

  const companyId = effectiveCompanyId();
  if (!companyId) {
    uni.showToast({ title: '公司信息不存在', icon: 'none' });
    return;
  }

  try {
    const newUser = await createUserByMobile(mobile);
    if (!newUser?.id) {
      uni.showToast({ title: '创建账号失败', icon: 'none' });
      return;
    }

    await addCompanyUser({
      user_users: newUser.id,
      company_companies: companyId,
      role: userForm.value.role,
      level: userForm.value.level,
      can_view_price: userForm.value.can_view_price,
      price_factor: priceFactor,
    });

    uni.showToast({ title: '已创建默认账号并添加至公司', icon: 'success' });
    closeModal();
    loadUsers(true);
  } catch (error: any) {
    uni.showToast({
      title: error.message || '操作失败',
      icon: 'none',
    });
  }
};

// 关闭弹窗
const closeModal = () => {
  showAddModal.value = false;
  showEditModal.value = false;
  editingUserId.value = null;
  searchedUser.value = null;
  showCreateAndAddMode.value = false;
  hasSearched.value = false;
  userForm.value = getDefaultUserForm();
};

onLoad((options?: { companyId?: string }) => {
  if (options?.companyId) {
    viewCompanyId.value = Number(options.companyId);
  }
});

// 打开添加弹窗时用公司默认填充表单
watch(showAddModal, (visible) => {
  if (visible && !showEditModal.value) {
    userForm.value = getDefaultUserForm();
  }
});

onShow(() => {
  loadCompanyDefaults();
  loadUsers(true);
});

onPullDownRefresh(() => {
  loadUsers(true);
});
</script>

<style scoped>
@import '@/styles/form-inputs.css';
.company-user-list-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
  box-sizing: border-box;
}

.header-bar {
  flex-shrink: 0;
  background: #ffffff;
  padding: 20rpx 30rpx;
  border-bottom: 1rpx solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.user-list-scroll {
  flex: 1;
  height: 0;
  overflow: hidden;
}

.search-row {
  width: 100%;
}

.search-input {
  width: 100%;
  height: 64rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #333;
  background: #f5f5f5;
  border-radius: 12rpx;
  box-sizing: border-box;
}

.search-placeholder {
  color: #999;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.filter-tab {
  padding: 12rpx 24rpx;
  font-size: 26rpx;
  color: #666666;
  background: #f1f5f9;
  border-radius: 8rpx;
}

.filter-tab.active {
  background: #667eea;
  color: #ffffff;
}

.level-filter-row {
  flex-wrap: wrap;
  align-items: center;
}

.level-filter-label {
  font-size: 26rpx;
  color: #666;
  margin-right: 12rpx;
}

.level-tab {
  margin-right: 12rpx;
  margin-bottom: 8rpx;
}

.user-level {
  padding: 4rpx 12rpx;
  background: #f0f0f0;
  color: #666666;
  border-radius: 4rpx;
  font-size: 24rpx;
}

.batch-btn {
  padding: 10rpx 20rpx;
  background: #f0f0f0;
  color: #333;
  border-radius: 8rpx;
  font-size: 26rpx;
  border: none;
  margin-right: 16rpx;
}

.batch-modal .batch-mode-options,
.batch-modal .level-options {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 12rpx;
}

.batch-mode-option,
.level-option {
  padding: 16rpx 28rpx;
  font-size: 28rpx;
  color: #666;
  background: #f0f2f5;
  border-radius: 12rpx;
}

.batch-mode-option.active,
.level-option.active {
  background: #667eea;
  color: #fff;
}

.level-options-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.count-row {
  margin-top: 0;
}

.count-text {
  font-size: 26rpx;
  color: #6b7280;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
}

.add-btn {
  padding: 10rpx 20rpx;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border-radius: 8rpx;
  font-size: 26rpx;
  border: none;
}

.view-only-tip {
  font-size: 26rpx;
  color: #999;
}

.user-list {
  padding: 20rpx;
  padding-bottom: 60rpx;
}

.user-item {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.user-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: #f0f0f0;
}

.user-avatar-placeholder {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: bold;
}

.user-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.user-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333333;
}

.user-meta {
  display: flex;
  gap: 20rpx;
  font-size: 24rpx;
  color: #999999;
}

.user-role {
  padding: 4rpx 12rpx;
  background: #f0f0f0;
  color: #666666;
  border-radius: 4rpx;
}

.role-admin {
  background: #e6f7ff;
  color: #1890ff;
}

.user-permissions {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
}

.permission-tag {
  padding: 4rpx 12rpx;
  background: #f0f0f0;
  color: #999999;
  border-radius: 4rpx;
  font-size: 22rpx;
}

.tag-enabled {
  background: #f6ffed;
  color: #52c41a;
}

.user-actions {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.action-btn {
  padding: 8rpx 20rpx;
  background: #f0f0f0;
  color: #333333;
  border-radius: 8rpx;
  font-size: 24rpx;
  text-align: center;
}

.action-btn.delete {
  background: #fff5f5;
  color: #ff6b6b;
}

.empty-state {
  padding: 100rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: #999999;
  display: block;
  margin-bottom: 40rpx;
}

.empty-btn {
  padding: 20rpx 40rpx;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border-radius: 12rpx;
  font-size: 28rpx;
  border: none;
}

.loading-state {
  padding: 40rpx 0;
  text-align: center;
  color: #999999;
  font-size: 28rpx;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 90%;
  max-width: 600rpx;
  max-height: 80vh;
  background: #ffffff;
  border-radius: 16rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 30rpx;
  border-bottom: 1rpx solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
}

.modal-close {
  font-size: 48rpx;
  color: #999999;
  line-height: 1;
}

.modal-body {
  flex: 1;
  padding: 30rpx;
  overflow-y: auto;
}

.form-item {
  margin-bottom: 30rpx;
}

.label {
  font-size: 28rpx;
  color: #666666;
  margin-bottom: 16rpx;
  display: flex;
  align-items: center;
}

.required {
  color: #ff6b6b;
}

.role-options {
  display: flex;
  gap: 20rpx;
  margin-top: 12rpx;
}

.role-option {
  padding: 16rpx 28rpx;
  font-size: 28rpx;
  color: #666;
  background: #f0f2f5;
  border-radius: 12rpx;
  transition: all 0.2s;
}

.role-option.active {
  background: #667eea;
  color: #fff;
}

.input {
  width: 100%;
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.search-btn {
  margin-top: 10rpx;
  padding: 10rpx 20rpx;
  background: #667eea;
  color: #ffffff;
  border-radius: 8rpx;
  font-size: 26rpx;
  border: none;
}

.search-btn[disabled] {
  background: #cccccc;
  color: #999999;
}

.searched-user-info {
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.searched-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: #f0f0f0;
}

.searched-avatar-placeholder {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: bold;
}

.searched-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.searched-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #333333;
}

.searched-phone {
  font-size: 24rpx;
  color: #999999;
}

.create-user-tip {
  padding: 24rpx;
  background: #fff8e6;
  border: 1rpx solid #ffd666;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.create-user-tip-text {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.create-user-tip-desc {
  font-size: 24rpx;
  color: #666;
}

.picker {
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.form-hint {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #999999;
}

.modal-footer {
  padding: 30rpx;
  border-top: 1rpx solid #e0e0e0;
  display: flex;
  gap: 20rpx;
}

.modal-btn {
  flex: 1;
  padding: 20rpx;
  background: #667eea;
  color: #ffffff;
  border-radius: 8rpx;
  font-size: 28rpx;
  border: none;
}

.modal-btn.cancel {
  background: #f0f0f0;
  color: #666666;
}

.modal-btn.disabled {
  background: #cccccc;
  color: #999999;
}
</style>
