<template>
  <div class="app-container sqms-page">
    <div class="sqms-head">
      <div>
        <div class="sqms-kicker">业务管理</div>
        <h2>{{ activeMeta.title }}</h2>
        <p>{{ activeMeta.desc }}</p>
      </div>
      <el-space wrap>
        <el-button icon="Refresh" @click="getList">刷新</el-button>
        <el-button type="primary" icon="Plus" @click="handleAdd">新增{{ activeMeta.shortTitle }}</el-button>
      </el-space>
    </div>

    <div class="module-groups">
      <section v-for="group in moduleGroups" :key="group.title" class="module-group">
        <div class="module-group__title">{{ group.title }}</div>
        <div class="module-grid">
          <button
            v-for="item in group.children"
            :key="item.table"
            type="button"
            class="module-tile"
            :class="{ active: activeTable === item.table }"
            @click="selectTable(item.table)"
          >
            <span class="module-tile__name">{{ item.shortTitle }}</span>
            <span class="module-tile__desc">{{ item.navDesc }}</span>
            <strong>{{ formatCount(item.table) }}</strong>
          </button>
        </div>
      </section>
    </div>

    <div class="toolbar-panel">
      <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" class="sqms-query">
        <el-form-item label="当前模块">
          <el-select v-model="activeTable" filterable style="width: 220px" @change="handleTableChange">
            <el-option
              v-for="item in tableOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词" prop="keyword">
          <el-input
            v-model="queryParams.keyword"
            placeholder="名称、电话、商品、客户等"
            clearable
            style="width: 260px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item
          v-for="filter in activeFilters"
          :key="filter.key"
          :label="filter.label"
          :prop="filter.key"
        >
          <el-select
            v-model="queryParams[filter.key]"
            clearable
            style="width: 150px"
            @change="handleQuery"
          >
            <el-option
              v-for="option in filter.options"
              :key="String(option.value)"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-row :gutter="10" class="mb8">
        <el-col :span="1.5">
          <el-button type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()">修改</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">删除</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="warning" plain icon="Download" @click="handleExportExcel">导出Excel</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="info" plain icon="Document" @click="handleExportWord">导出Word</el-button>
        </el-col>
        <el-col :span="1.5" v-if="activeTable === 'quoteOrders'">
          <el-button type="primary" plain icon="Tickets" @click="handleExportQuoteTemplate">导出报价单模板</el-button>
        </el-col>
        <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
      </el-row>

      <el-alert
        class="sqms-page__tip"
        type="info"
        :closable="false"
        show-icon
        :title="activeMeta.tip"
      />
    </div>

    <el-table
      v-loading="loading"
      :data="rows"
      border
      stripe
      :row-key="getRowKey"
      empty-text="暂无数据"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" :selectable="isSelectable" />
      <el-table-column type="index" label="序号" width="64" align="center" />
      <el-table-column
        v-for="column in displayColumns"
        :key="column.prop"
        :label="column.label"
        :prop="column.prop"
        :min-width="column.minWidth || 140"
        show-overflow-tooltip
      >
        <template #default="scope">
          <el-select
            v-if="column.quick && column.options"
            :model-value="scope.row[column.prop]"
            size="small"
            class="table-select"
            @change="value => handleQuickChange(scope.row, column.prop, value)"
          >
            <el-option
              v-for="option in column.options"
              :key="String(option.value)"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-switch
            v-else-if="column.quick && column.type === 'boolean'"
            :model-value="toBoolean(scope.row[column.prop])"
            inline-prompt
            active-text="是"
            inactive-text="否"
            @change="value => handleQuickChange(scope.row, column.prop, value)"
          />
          <el-tag
            v-else-if="column.type === 'status'"
            :type="statusTag(column, scope.row[column.prop])"
            effect="light"
          >
            {{ optionLabel(column.options, scope.row[column.prop]) }}
          </el-tag>
          <el-tag
            v-else-if="column.type === 'boolean'"
            :type="toBoolean(scope.row[column.prop]) ? 'success' : 'info'"
            effect="light"
          >
            {{ booleanText(scope.row[column.prop]) }}
          </el-tag>
          <span v-else class="sqms-page__cell">{{ formatCell(scope.row[column.prop], column) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" align="center" fixed="right" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" :disabled="!hasRowId(scope.row)" @click="handleUpdate(scope.row)">编辑</el-button>
          <el-button link type="danger" icon="Delete" :disabled="!hasRowId(scope.row)" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />

    <el-dialog :title="title" v-model="open" width="860px" append-to-body destroy-on-close>
      <el-alert
        class="dialog-tip"
        type="info"
        :closable="false"
        :title="activeMeta.dialogTip"
      />
      <el-form ref="formRef" :model="form" :rules="rules" label-width="112px" class="business-form">
        <el-row :gutter="16">
          <el-col v-for="field in activeFields" :key="field.key" :span="field.span || 12">
            <el-form-item :label="field.label" :prop="field.key">
              <el-input
                v-if="field.type === 'textarea'"
                v-model="form[field.key]"
                type="textarea"
                :rows="field.rows || 3"
                :placeholder="field.placeholder || `请输入${field.label}`"
              />
              <el-input
                v-else-if="field.type === 'password'"
                v-model="form[field.key]"
                show-password
                :placeholder="field.placeholder || `请输入${field.label}`"
              />
              <el-input-number
                v-else-if="field.type === 'number'"
                v-model="form[field.key]"
                :precision="field.precision"
                :step="field.step || 1"
                :min="field.min"
                controls-position="right"
                style="width: 100%"
              />
              <el-select
                v-else-if="field.type === 'select'"
                v-model="form[field.key]"
                filterable
                clearable
                :placeholder="field.placeholder || `请选择${field.label}`"
                style="width: 100%"
              >
                <el-option
                  v-for="option in field.options"
                  :key="String(option.value)"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-switch
                v-else-if="field.type === 'switch'"
                v-model="form[field.key]"
                inline-prompt
                active-text="是"
                inactive-text="否"
              />
              <el-date-picker
                v-else-if="field.type === 'date'"
                v-model="form[field.key]"
                type="datetime"
                value-format="x"
                placeholder="选择时间"
                style="width: 100%"
              />
              <el-input
                v-else-if="field.type === 'json'"
                v-model="form[field.key]"
                type="textarea"
                :rows="field.rows || 6"
                spellcheck="false"
                placeholder="{ }"
              />
              <el-input
                v-else
                v-model="form[field.key]"
                :placeholder="field.placeholder || `请输入${field.label}`"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-collapse v-model="advancedPanels" class="advanced-collapse">
          <el-collapse-item name="extra">
            <template #title>
              <span>高级字段</span>
              <span class="advanced-hint">未列入表单的字段会在这里保留</span>
            </template>
            <el-input
              v-model="extraJson"
              type="textarea"
              :rows="8"
              spellcheck="false"
              placeholder="{ }"
            />
          </el-collapse-item>
        </el-collapse>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="submitting" @click="submitForm">保存</el-button>
          <el-button @click="cancel">取消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="SqmsBusiness">
import { computed, getCurrentInstance, onMounted, reactive, ref, toRefs, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { addSqms, delSqms, getSqms, listSqms, sqmsTables, updateSqms } from '@/api/business/sqms'

const roleOptions = [
  { label: '管理员', value: 'admin', tag: 'danger' },
  { label: '员工', value: 'employee', tag: 'primary' }
]

const gradeOptions = [
  { label: 'A 重点客户', value: 'A', tag: 'success' },
  { label: 'B 普通客户', value: 'B', tag: 'primary' },
  { label: 'C 新客户', value: 'C', tag: 'info' }
]

const poolOptions = [
  { label: '公盘', value: 'public', tag: 'info' },
  { label: '私盘', value: 'private', tag: 'success' }
]

const yesNoOptions = [
  { label: '是', value: true, tag: 'success' },
  { label: '否', value: false, tag: 'info' }
]

const dealStatusOptions = [
  { label: '未成交', value: 'pending', tag: 'warning' },
  { label: '部分成交', value: 'partial', tag: 'primary' },
  { label: '已成交', value: 'done', tag: 'success' }
]

const itemStatusOptions = [
  { label: '未成交', value: 'pending', tag: 'warning' },
  { label: '已成交', value: 'done', tag: 'success' }
]

const requestStatusOptions = [
  { label: '待审核', value: 'submitted', tag: 'warning' },
  { label: '已审核', value: 'approved', tag: 'success' },
  { label: '已驳回', value: 'rejected', tag: 'danger' }
]

const requestTypeOptions = [
  { label: '新报价申请', value: 'newQuote', tag: 'primary' },
  { label: '修改报价申请', value: 'modifyQuote', tag: 'warning' },
  { label: '成交变更申请', value: 'deal', tag: 'success' }
]

const reviewStatusOptions = [
  { label: '待审', value: 'pending', tag: 'warning' },
  { label: '已通过', value: 'approved', tag: 'success' },
  { label: '已驳回', value: 'rejected', tag: 'danger' }
]

const suggestionStatusOptions = [
  { label: '待回复', value: 'pending', tag: 'warning' },
  { label: '已回复', value: 'replied', tag: 'success' },
  { label: '已关闭', value: 'closed', tag: 'info' }
]

function col(prop, label, options = {}) {
  return { prop, label, ...options }
}

function textField(key, label, options = {}) {
  return { key, label, type: 'text', ...options }
}

function textareaField(key, label, options = {}) {
  return { key, label, type: 'textarea', span: 24, ...options }
}

function numberField(key, label, options = {}) {
  return { key, label, type: 'number', precision: 2, step: 1, ...options }
}

function selectField(key, label, options, extra = {}) {
  return { key, label, type: 'select', options, ...extra }
}

function switchField(key, label, options = {}) {
  return { key, label, type: 'switch', default: false, ...options }
}

function jsonField(key, label, options = {}) {
  return { key, label, type: 'json', span: 24, rows: 6, ...options }
}

const tableConfigs = {
  employees: {
    title: '员工档案',
    shortTitle: '员工',
    navDesc: '账号与权限',
    desc: '维护员工登录账号、角色、职位和停用状态。',
    tip: '员工账号可在前端登录。停用后不能登录，角色决定是否拥有管理员能力。',
    dialogTip: '手机号和密码用于员工登录。员工离职时建议停用，不要直接删除历史报价人。',
    columns: [
      col('name', '姓名', { minWidth: 110 }),
      col('phone', '手机号', { minWidth: 135 }),
      col('role', '角色', { type: 'status', options: roleOptions, quick: true, minWidth: 125 }),
      col('position', '职位', { minWidth: 130 }),
      col('disabled', '停用', { type: 'boolean', quick: true, minWidth: 100 }),
      col('updateTime', '更新时间', { type: 'time', minWidth: 165 })
    ],
    fields: [
      textField('name', '姓名', { required: true }),
      textField('phone', '手机号'),
      { key: 'password', label: '登录密码', type: 'password' },
      selectField('role', '角色', roleOptions, { default: 'employee' }),
      textField('position', '职位'),
      switchField('disabled', '是否停用'),
      textareaField('remark', '备注')
    ],
    filters: [
      { key: 'role', label: '角色', options: roleOptions },
      { key: 'disabled', label: '停用', options: yesNoOptions }
    ]
  },
  customers: {
    title: '客户档案',
    shortTitle: '客户',
    navDesc: '注册与审核',
    desc: '维护客户账号、公司、等级、归属员工和审核状态。',
    tip: '客户注册后默认待审核。审核通过后客户才能在前端登录。',
    dialogTip: '客户可以分配到员工私盘，也可以留在公盘。审核开关会直接影响客户登录。',
    columns: [
      col('name', '客户姓名', { minWidth: 120 }),
      col('phone', '手机号', { minWidth: 135 }),
      col('company', '公司', { minWidth: 180 }),
      col('grade', '等级', { type: 'status', options: gradeOptions, minWidth: 100 }),
      col('pool', '归属', { type: 'status', options: poolOptions, minWidth: 100 }),
      col('ownerName', '负责人', { minWidth: 120 }),
      col('approved', '已审核', { type: 'boolean', quick: true, minWidth: 110 }),
      col('disabled', '停用', { type: 'boolean', quick: true, minWidth: 100 })
    ],
    fields: [
      textField('name', '客户姓名', { required: true }),
      textField('phone', '手机号'),
      { key: 'password', label: '登录密码', type: 'password' },
      textField('company', '公司名称'),
      selectField('grade', '客户等级', gradeOptions, { default: 'C' }),
      selectField('pool', '归属类型', poolOptions, { default: 'public' }),
      textField('ownerId', '负责人ID'),
      textField('ownerName', '负责人'),
      switchField('approved', '审核通过'),
      switchField('disabled', '是否停用'),
      textareaField('remark', '备注')
    ],
    filters: [
      { key: 'approved', label: '审核', options: yesNoOptions },
      { key: 'grade', label: '等级', options: gradeOptions },
      { key: 'pool', label: '归属', options: poolOptions }
    ]
  },
  products: {
    title: '商品档案',
    shortTitle: '商品',
    navDesc: '规格与价格',
    desc: '维护商品名称、规格、品牌、分类、单位和价格。',
    tip: '商品价格会影响报价推荐。采购价、成本价、最低价、建议价和零售价都可在这里维护。',
    dialogTip: '建议商品名称加规格，方便前端报价时检索。单位换算字段会被商品设置页使用。',
    columns: [
      col('name', '商品名称', { minWidth: 220 }),
      col('spec', '规格', { minWidth: 150 }),
      col('brand', '品牌', { minWidth: 120 }),
      col('category', '分类', { minWidth: 130 }),
      col('purchasePrice', '采购价', { type: 'money', minWidth: 110 }),
      col('costPrice', '成本价', { type: 'money', minWidth: 110 }),
      col('minPrice', '最低价', { type: 'money', minWidth: 110 }),
      col('suggestPrice', '建议价', { type: 'money', minWidth: 110 }),
      col('stock', '库存', { type: 'number', minWidth: 90 })
    ],
    fields: [
      textField('name', '商品名称', { required: true, span: 24 }),
      textField('spec', '规格', { required: true }),
      textField('brand', '品牌'),
      textField('category', '分类'),
      textField('attr1', '一级属性'),
      textField('attr2', '二级属性'),
      textField('unitSmall', '小单位', { default: '个' }),
      textField('unitMedium', '中单位', { default: '包' }),
      textField('unitLarge', '大单位', { default: '箱' }),
      numberField('mediumToSmall', '中转小', { precision: 0, default: 12 }),
      numberField('largeToMedium', '大转中', { precision: 0, default: 12 }),
      numberField('stock', '库存', { precision: 0, default: 0 }),
      numberField('purchasePrice', '采购价'),
      numberField('costPrice', '成本价'),
      numberField('minPrice', '最低价'),
      numberField('suggestPrice', '建议价'),
      numberField('retailPrice', '零售价')
    ]
  },
  suppliers: {
    title: '供货商档案',
    shortTitle: '供货商',
    navDesc: '进货渠道',
    desc: '这里维护公司自己的上级批发商和进货渠道。',
    tip: '供货商是公司采购用的上级批发商，不是客户口中的供货商。',
    dialogTip: '采购单和采购明细会关联这里的供货商信息。',
    columns: [
      col('name', '供货商名称', { minWidth: 180 }),
      col('contact', '联系人', { minWidth: 120 }),
      col('phone', '电话', { minWidth: 135 }),
      col('address', '地址', { minWidth: 220 }),
      col('updateTime', '更新时间', { type: 'time', minWidth: 165 })
    ],
    fields: [
      textField('name', '名称', { required: true }),
      textField('contact', '联系人'),
      textField('phone', '电话'),
      textField('address', '地址', { span: 24 }),
      textareaField('remark', '备注')
    ]
  },
  competitors: {
    title: '同行信息',
    shortTitle: '同行',
    navDesc: '客户口中的供货商',
    desc: '客户眼里的供货商，在公司内部统一按同行维护。',
    tip: '接单或报价里客户提供的供货商报价，会作为同行信息和同行报价保存。',
    dialogTip: '这里不是公司进货渠道。客户说的“供货商”应维护到同行，后续用于同行报价参考。',
    columns: [
      col('name', '同行名称', { minWidth: 180 }),
      col('contact', '联系人', { minWidth: 120 }),
      col('phone', '电话', { minWidth: 135 }),
      col('address', '地址', { minWidth: 220 }),
      col('updateTime', '更新时间', { type: 'time', minWidth: 165 })
    ],
    fields: [
      textField('name', '名称', { required: true }),
      textField('contact', '联系人'),
      textField('phone', '电话'),
      textField('address', '地址', { span: 24 }),
      textareaField('remark', '备注')
    ]
  },
  competitorQuotes: {
    title: '同行报价',
    shortTitle: '同行报价',
    navDesc: '竞价参考',
    desc: '维护同行对某个商品的报价，供销售报价和接单审核参考。',
    tip: '同行报价应该关联同行，不再保存到公司供货商里。',
    dialogTip: '从客户接单同步来的报价，如果没有同行档案，应先补同行信息再保存。',
    columns: [
      col('competitorName', '同行', { minWidth: 160 }),
      col('productName', '商品', { minWidth: 220 }),
      col('productId', '商品ID', { minWidth: 150 }),
      col('price', '报价', { type: 'money', minWidth: 110 }),
      col('sourceCustomerName', '来源客户', { minWidth: 140 }),
      col('createTime', '报价时间', { type: 'time', minWidth: 165 })
    ],
    fields: [
      textField('competitorId', '同行ID'),
      textField('competitorName', '同行名称', { required: true }),
      textField('productId', '商品ID'),
      textField('productName', '商品名称'),
      numberField('price', '同行报价', { required: true }),
      textField('sourceCustomerId', '来源客户ID'),
      textField('sourceCustomerName', '来源客户'),
      textareaField('remark', '备注')
    ]
  },
  quoteOrders: {
    title: '报价单',
    shortTitle: '报价单',
    navDesc: '订单与成交',
    desc: '维护正式报价单、客户、报价员工和成交状态。',
    tip: '报价单成交状态会影响统计。明细成交状态在报价明细里维护。',
    dialogTip: '客户、员工建议同时保存 ID 和名称，避免名称修改后历史数据看不懂。',
    columns: [
      col('customerName', '客户', { minWidth: 150 }),
      col('employeeName', '报价员工', { minWidth: 130 }),
      col('dealStatus', '成交状态', { type: 'status', options: dealStatusOptions, quick: true, minWidth: 130 }),
      col('sourceRequestOrderId', '来源申请', { minWidth: 170 }),
      col('createTime', '创建时间', { type: 'time', minWidth: 165 }),
      col('updateTime', '更新时间', { type: 'time', minWidth: 165 })
    ],
    fields: [
      textField('customerId', '客户ID'),
      textField('customerName', '客户名称', { required: true }),
      textField('employeeId', '员工ID'),
      textField('employeeName', '报价员工'),
      selectField('dealStatus', '成交状态', dealStatusOptions, { default: 'pending' }),
      textField('sourceRequestOrderId', '来源申请ID'),
      textareaField('remark', '备注')
    ],
    filters: [
      { key: 'dealStatus', label: '成交', options: dealStatusOptions }
    ]
  },
  quoteItems: {
    title: '报价明细',
    shortTitle: '报价明细',
    navDesc: '商品行',
    desc: '维护报价单中的商品、数量、价格、成本和行级成交状态。',
    tip: '低于最低价的报价行会带有审核字段，管理员可以在这里快速切换特批状态。',
    dialogTip: '报价明细应保留 orderId，才能归属到正确报价单。',
    columns: [
      col('productName', '商品', { minWidth: 220 }),
      col('spec', '规格', { minWidth: 150 }),
      col('qty', '数量', { type: 'number', minWidth: 90 }),
      col('unit', '单位', { minWidth: 80 }),
      col('price', '报价', { type: 'money', minWidth: 110 }),
      col('costPrice', '成本价', { type: 'money', minWidth: 110 }),
      col('status', '成交', { type: 'status', options: itemStatusOptions, quick: true, minWidth: 120 }),
      col('needsAdminReview', '待管理员审', { type: 'boolean', quick: true, minWidth: 130 }),
      col('specialApproved', '特批', { type: 'boolean', quick: true, minWidth: 100 })
    ],
    fields: [
      textField('orderId', '报价单ID', { required: true }),
      textField('productId', '商品ID'),
      textField('productName', '商品名称', { required: true }),
      textField('spec', '规格'),
      textField('unit', '单位', { default: '个' }),
      numberField('qty', '数量', { precision: 0, default: 1 }),
      numberField('price', '报价'),
      numberField('costPrice', '成本价'),
      numberField('customerExpect', '客户预期价'),
      selectField('status', '成交状态', itemStatusOptions, { default: 'pending' }),
      switchField('needsAdminReview', '待管理员审'),
      switchField('specialApproved', '低价特批'),
      switchField('priceEffective', '纳入统计', { default: true }),
      switchField('customerPendingReview', '客户修改待确认'),
      textField('employeeId', '员工ID'),
      textField('customerId', '客户ID'),
      textField('sourceRequestOrderId', '来源申请ID'),
      textField('sourceRequestItemId', '来源明细ID')
    ],
    filters: [
      { key: 'status', label: '成交', options: itemStatusOptions },
      { key: 'needsAdminReview', label: '待审', options: yesNoOptions }
    ]
  },
  requestOrders: {
    title: '接单申请',
    shortTitle: '接单',
    navDesc: '客户申请',
    desc: '维护客户提交的报价申请、接单处理状态和审核结果。',
    tip: '客户提交后状态为待审核。接单处理和管理员审核最终会关联到正式报价单。',
    dialogTip: '接单申请中的客户提供报价应进入同行报价，不应进入公司供货商。',
    columns: [
      col('customerName', '客户', { minWidth: 150 }),
      col('status', '申请状态', { type: 'status', options: requestStatusOptions, quick: true, minWidth: 130 }),
      col('requestType', '申请类型', { type: 'status', options: requestTypeOptions, minWidth: 140 }),
      col('employeeName', '员工', { minWidth: 120 }),
      col('totalReference', '参考总额', { type: 'money', minWidth: 120 }),
      col('adminReviewStatus', '管理员审核', { type: 'status', options: reviewStatusOptions, quick: true, minWidth: 140 }),
      col('createTime', '提交时间', { type: 'time', minWidth: 165 })
    ],
    fields: [
      textField('customerId', '客户ID'),
      textField('customerName', '客户名称', { required: true }),
      selectField('status', '申请状态', requestStatusOptions, { default: 'submitted' }),
      selectField('requestType', '申请类型', requestTypeOptions, { default: 'newQuote' }),
      textField('employeeId', '员工ID'),
      textField('employeeName', '员工名称'),
      numberField('totalReference', '参考总额'),
      textField('sourceQuoteOrderId', '原报价单ID'),
      textField('acceptedQuoteOrderId', '接单报价单ID'),
      textField('approvedQuoteOrderId', '审核报价单ID'),
      selectField('adminReviewStatus', '管理员审核', reviewStatusOptions),
      textField('adminReviewQuoteOrderId', '审核中报价单ID'),
      textareaField('remark', '备注')
    ],
    filters: [
      { key: 'status', label: '状态', options: requestStatusOptions },
      { key: 'adminReviewStatus', label: '管理员审', options: reviewStatusOptions }
    ]
  },
  requestItems: {
    title: '接单明细',
    shortTitle: '接单明细',
    navDesc: '客户商品',
    desc: '维护客户申请中的商品、数量、预期价和客户提供的同行报价。',
    tip: 'supplierQuotes 是客户填写的“供货商报价”，公司侧应理解为同行报价来源。',
    dialogTip: '客户提供的 supplierQuotes 可以保留在高级字段，也可以在表单中按 JSON 编辑。',
    columns: [
      col('requestOrderId', '申请单ID', { minWidth: 170 }),
      col('productName', '商品', { minWidth: 220 }),
      col('spec', '规格', { minWidth: 150 }),
      col('qty', '数量', { type: 'number', minWidth: 90 }),
      col('customerExpect', '客户预期价', { type: 'money', minWidth: 120 }),
      col('quotePrice', '最终报价', { type: 'money', minWidth: 120 }),
      col('supplierQuotes', '客户提供报价', { type: 'json', minWidth: 180 })
    ],
    fields: [
      textField('requestOrderId', '申请单ID', { required: true }),
      textField('productId', '商品ID'),
      textField('productName', '商品名称', { required: true }),
      textField('spec', '规格'),
      numberField('qty', '数量', { precision: 0, default: 1 }),
      numberField('suggestPrice', '建议价'),
      numberField('customerExpect', '客户预期价'),
      numberField('quotePrice', '最终报价'),
      jsonField('supplierQuotes', '客户提供报价', { rows: 5, default: [], jsonRoot: 'array' })
    ]
  },
  purchaseOrders: {
    title: '采购单',
    shortTitle: '采购单',
    navDesc: '进货记录',
    desc: '维护公司采购单、供货商、经办员工和运费。',
    tip: '采购单使用公司供货商档案，也就是进货渠道。',
    dialogTip: '采购单保存的是公司向上级批发商进货的信息。',
    columns: [
      col('supplierName', '供货商', { minWidth: 170 }),
      col('employeeName', '经办员工', { minWidth: 130 }),
      col('freight', '运费', { type: 'money', minWidth: 110 }),
      col('createTime', '采购时间', { type: 'time', minWidth: 165 })
    ],
    fields: [
      textField('supplierId', '供货商ID'),
      textField('supplierName', '供货商名称', { required: true }),
      textField('employeeId', '员工ID'),
      textField('employeeName', '经办员工'),
      numberField('freight', '运费'),
      textareaField('remark', '备注')
    ]
  },
  purchaseItems: {
    title: '采购明细',
    shortTitle: '采购明细',
    navDesc: '采购商品',
    desc: '维护采购单中的商品、数量、采购价和分摊运费。',
    tip: '采购明细会影响商品成本价和报价参考。',
    dialogTip: '采购明细应保留 purchaseOrderId，才能归属到正确采购单。',
    columns: [
      col('purchaseOrderId', '采购单ID', { minWidth: 170 }),
      col('productName', '商品', { minWidth: 220 }),
      col('spec', '规格', { minWidth: 150 }),
      col('supplierName', '供货商', { minWidth: 150 }),
      col('qty', '数量', { type: 'number', minWidth: 90 }),
      col('purchasePrice', '采购价', { type: 'money', minWidth: 110 }),
      col('freightShare', '分摊运费', { type: 'money', minWidth: 120 })
    ],
    fields: [
      textField('purchaseOrderId', '采购单ID', { required: true }),
      textField('productId', '商品ID'),
      textField('productName', '商品名称', { required: true }),
      textField('spec', '规格'),
      textField('supplierId', '供货商ID'),
      textField('supplierName', '供货商名称'),
      numberField('qty', '数量', { precision: 0, default: 1 }),
      numberField('purchasePrice', '采购价'),
      numberField('freightShare', '分摊运费')
    ]
  },
  follows: {
    title: '跟进记录',
    shortTitle: '跟进',
    navDesc: '客户沟通',
    desc: '维护客户跟进方式、内容和关联订单。',
    tip: '跟进记录用于客户详情和后续回访。',
    dialogTip: '建议写清楚沟通方式和下一步动作，便于交接。',
    columns: [
      col('customerName', '客户', { minWidth: 150 }),
      col('way', '方式', { minWidth: 100 }),
      col('content', '内容', { minWidth: 280 }),
      col('orderId', '关联报价单', { minWidth: 170 }),
      col('createTime', '跟进时间', { type: 'time', minWidth: 165 })
    ],
    fields: [
      textField('customerId', '客户ID'),
      textField('customerName', '客户名称', { required: true }),
      textField('employeeId', '员工ID'),
      textField('employeeName', '员工名称'),
      textField('orderId', '关联报价单ID'),
      selectField('way', '跟进方式', [
        { label: '电话', value: '电话' },
        { label: '微信', value: '微信' },
        { label: '上门', value: '上门' },
        { label: '到店', value: '到店' }
      ]),
      textareaField('content', '跟进内容', { required: true })
    ]
  },
  suggestions: {
    title: '客户建议',
    shortTitle: '建议',
    navDesc: '反馈回复',
    desc: '维护客户建议、投诉内容和回复。',
    tip: '回复内容会同步给客户侧查看。',
    dialogTip: '处理完成后可把状态改为已回复或已关闭。',
    columns: [
      col('customerName', '客户', { minWidth: 150 }),
      col('content', '内容', { minWidth: 280 }),
      col('reply', '回复', { minWidth: 240 }),
      col('status', '状态', { type: 'status', options: suggestionStatusOptions, quick: true, minWidth: 120 }),
      col('createTime', '提交时间', { type: 'time', minWidth: 165 })
    ],
    fields: [
      textField('customerId', '客户ID'),
      textField('customerName', '客户名称'),
      textareaField('content', '内容', { required: true }),
      textareaField('reply', '回复'),
      selectField('status', '状态', suggestionStatusOptions, { default: 'pending' })
    ],
    filters: [
      { key: 'status', label: '状态', options: suggestionStatusOptions }
    ]
  },
  messages: {
    title: '站内消息',
    shortTitle: '消息',
    navDesc: '沟通记录',
    desc: '维护员工、客户之间的站内消息记录。',
    tip: '消息记录一般由前端聊天产生，后台只做查询和必要修正。',
    dialogTip: '如果手工新增消息，请确认发送人和接收人 ID。',
    columns: [
      col('fromName', '发送人', { minWidth: 130 }),
      col('toName', '接收人', { minWidth: 130 }),
      col('content', '内容', { minWidth: 300 }),
      col('read', '已读', { type: 'boolean', quick: true, minWidth: 100 }),
      col('createTime', '发送时间', { type: 'time', minWidth: 165 })
    ],
    fields: [
      textField('fromId', '发送人ID'),
      textField('fromName', '发送人'),
      textField('fromRole', '发送角色'),
      textField('toId', '接收人ID'),
      textField('toName', '接收人'),
      textField('toRole', '接收角色'),
      textareaField('content', '内容', { required: true }),
      switchField('read', '已读')
    ],
    filters: [
      { key: 'read', label: '已读', options: yesNoOptions }
    ]
  },
  settings: {
    title: '系统设置',
    shortTitle: '设置',
    navDesc: '价格参数',
    desc: '维护价格参数、单位换算等全局配置。',
    tip: '设置内容通常是对象。编辑前请确认 JSON 结构正确。',
    dialogTip: 'pricing 和 units 是前端计算价格和单位换算的关键配置。',
    columns: [
      col('key', '配置键', { minWidth: 150 }),
      col('value', '配置内容', { type: 'json', minWidth: 320 }),
      col('updateTime', '更新时间', { type: 'time', minWidth: 165 })
    ],
    fields: [
      textField('key', '配置键', { required: true }),
      jsonField('value', '配置内容', { required: true, rows: 10, jsonRoot: 'object' })
    ]
  }
}

const moduleGroups = [
  { title: '基础档案', children: ['employees', 'customers', 'products', 'competitors', 'suppliers'].map(buildModuleItem) },
  { title: '报价接单', children: ['quoteOrders', 'quoteItems', 'requestOrders', 'requestItems', 'competitorQuotes'].map(buildModuleItem) },
  { title: '采购跟进', children: ['purchaseOrders', 'purchaseItems', 'follows'].map(buildModuleItem) },
  { title: '沟通配置', children: ['suggestions', 'messages', 'settings'].map(buildModuleItem) }
]

const allModules = moduleGroups.flatMap(group => group.children)
const allFilterKeys = Array.from(new Set(Object.values(tableConfigs).flatMap(config => (config.filters || []).map(item => item.key))))
const systemKeys = new Set(['_id', 'id', 'createTime', 'updateTime'])

const { proxy } = getCurrentInstance()
const route = useRoute()
const router = useRouter()

const tableOptions = sqmsTables.map(value => ({
  value,
  label: `${tableConfigs[value]?.shortTitle || value}（${value}）`
}))

const routeTable = typeof route.query.table === 'string' ? route.query.table : ''
const defaultTable = sqmsTables.includes(routeTable) ? routeTable : 'customers'
const activeTable = ref(defaultTable)
const rows = ref([])
const loading = ref(false)
const showSearch = ref(true)
const selectedRows = ref([])
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const counts = reactive({})
const open = ref(false)
const title = ref('')
const form = ref({})
const formRef = ref()
const formId = ref(undefined)
const editingRecord = ref({})
const extraJson = ref('{}')
const advancedPanels = ref([])
const submitting = ref(false)

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    keyword: undefined
  }
})

const { queryParams } = toRefs(data)

const activeMeta = computed(() => tableConfigs[activeTable.value] || tableConfigs.customers)
const activeFields = computed(() => activeMeta.value.fields || [])
const activeFilters = computed(() => activeMeta.value.filters || [])

const rules = computed(() => {
  const result = {}
  activeFields.value.forEach(field => {
    if (field.required) {
      result[field.key] = [
        { required: true, message: `${field.type === 'select' ? '请选择' : '请输入'}${field.label}`, trigger: field.type === 'select' ? 'change' : 'blur' }
      ]
    }
  })
  return result
})

const displayColumns = computed(() => {
  const base = activeMeta.value.columns || []
  const seen = new Set(base.map(column => column.prop))
  const extras = []
  rows.value.forEach(row => {
    if (!row || typeof row !== 'object') {
      return
    }
    Object.keys(row).forEach(key => {
      if (seen.has(key) || systemKeys.has(key)) {
        return
      }
      seen.add(key)
      extras.push(col(key, formatColumnLabel(key), { type: guessColumnType(key), minWidth: getColumnWidth(key) }))
    })
  })
  return base.concat(extras.slice(0, Math.max(0, 10 - base.length)))
})

watch(activeTable, table => {
  router.replace({ query: { ...route.query, table } })
})

function buildModuleItem(table) {
  const config = tableConfigs[table]
  return {
    table,
    shortTitle: config.shortTitle,
    navDesc: config.navDesc
  }
}

function readPayload(response) {
  return response && response.data !== undefined ? response.data : response
}

function readRows(response) {
  const payload = readPayload(response)
  if (Array.isArray(response?.rows)) {
    return response.rows
  }
  if (Array.isArray(payload)) {
    return payload
  }
  if (Array.isArray(payload?.rows)) {
    return payload.rows
  }
  if (Array.isArray(payload?.records)) {
    return payload.records
  }
  if (Array.isArray(payload?.list)) {
    return payload.list
  }
  return []
}

function readTotal(response, list) {
  const payload = readPayload(response)
  return Number(response?.total ?? payload?.total ?? payload?.count ?? list.length)
}

function readDetail(response) {
  const payload = readPayload(response)
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if (payload.data && (payload.code !== undefined || payload.msg !== undefined)) {
      return payload.data
    }
    return payload
  }
  return {}
}

function selectTable(table) {
  if (table === activeTable.value) {
    return
  }
  activeTable.value = table
  handleTableChange()
}

function getList() {
  loading.value = true
  listSqms(activeTable.value, queryParams.value).then(response => {
    const list = readRows(response)
    rows.value = list
    total.value = readTotal(response, list)
    counts[activeTable.value] = total.value
  }).finally(() => {
    loading.value = false
  })
}

function refreshCounts() {
  allModules.forEach(item => {
    listSqms(item.table, { pageNum: 1, pageSize: 1 }).then(response => {
      const list = readRows(response)
      counts[item.table] = readTotal(response, list)
    }).catch(() => {
      counts[item.table] = '-'
    })
  })
}

function handleTableChange() {
  queryParams.value.pageNum = 1
  clearFilters()
  resetSelection()
  getList()
}

function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

function resetQuery() {
  queryParams.value.keyword = undefined
  clearFilters()
  handleQuery()
}

function clearFilters() {
  allFilterKeys.forEach(key => {
    queryParams.value[key] = undefined
  })
}

function resetSelection() {
  selectedRows.value = []
  ids.value = []
  single.value = true
  multiple.value = true
}

function handleSelectionChange(selection) {
  selectedRows.value = selection
  ids.value = selection.map(row => getRowId(row)).filter(id => id !== undefined)
  single.value = selection.length !== 1
  multiple.value = !ids.value.length
}

function makeDefaultForm(record = {}) {
  const next = {}
  activeFields.value.forEach(field => {
    if (field.type === 'json') {
      next[field.key] = stringifyJsonField(record[field.key], field.default)
      return
    }
    if (record[field.key] !== undefined && record[field.key] !== null) {
      next[field.key] = record[field.key]
      return
    }
    if (field.default !== undefined) {
      next[field.key] = typeof field.default === 'function' ? field.default() : field.default
      return
    }
    next[field.key] = field.type === 'switch' ? false : field.type === 'number' ? null : ''
  })
  return next
}

function handleAdd() {
  formId.value = undefined
  editingRecord.value = {}
  form.value = makeDefaultForm()
  extraJson.value = '{}'
  advancedPanels.value = []
  title.value = `新增${activeMeta.value.shortTitle}`
  open.value = true
}

function handleUpdate(row) {
  const currentRow = row || selectedRows.value[0]
  const id = getRowId(currentRow)
  if (id === undefined) {
    proxy.$modal.msgError('未找到记录ID，无法编辑')
    return
  }
  formId.value = id
  title.value = `编辑${activeMeta.value.shortTitle}`
  getSqms(activeTable.value, id).then(response => {
    const detail = readDetail(response)
    editingRecord.value = detail
    form.value = makeDefaultForm(detail)
    extraJson.value = JSON.stringify(extractExtraFields(detail), null, 2)
    advancedPanels.value = []
    open.value = true
  })
}

function handleDelete(row) {
  const deleteIds = row ? [getRowId(row)] : ids.value
  const validIds = deleteIds.filter(id => id !== undefined)
  if (!validIds.length) {
    proxy.$modal.msgError('未找到记录ID，无法删除')
    return
  }
  proxy.$modal.confirm(`是否确认删除 ${activeMeta.value.shortTitle} 记录：${validIds.join(', ')}？`).then(() => {
    return delSqms(activeTable.value, validIds.join(','))
  }).then(() => {
    proxy.$modal.msgSuccess('删除成功')
    getList()
    refreshCounts()
  })
}

function submitForm() {
  if (!formRef.value) {
    saveForm()
    return
  }
  formRef.value.validate(valid => {
    if (valid) {
      saveForm()
    }
  })
}

function saveForm() {
  let extra
  try {
    extra = parseJsonObject(extraJson.value || '{}', '高级字段')
  } catch (error) {
    proxy.$modal.msgError(error.message)
    return
  }

  const payload = { ...editingRecord.value, ...extra }
  try {
    activeFields.value.forEach(field => {
      payload[field.key] = normalizeFieldValue(form.value[field.key], field)
    })
  } catch (error) {
    proxy.$modal.msgError(error.message)
    return
  }

  if (formId.value !== undefined) {
    payload._id = formId.value
  }

  submitting.value = true
  const request = formId.value === undefined
    ? addSqms(activeTable.value, payload)
    : updateSqms(activeTable.value, formId.value, payload)

  request.then(() => {
    proxy.$modal.msgSuccess(formId.value === undefined ? '新增成功' : '保存成功')
    open.value = false
    getList()
    refreshCounts()
  }).finally(() => {
    submitting.value = false
  })
}

function handleQuickChange(row, key, value) {
  const id = getRowId(row)
  if (id === undefined) {
    proxy.$modal.msgError('未找到记录ID，无法保存')
    return
  }
  const oldValue = row[key]
  row[key] = value
  updateSqms(activeTable.value, id, { ...row, [key]: value }).then(() => {
    proxy.$modal.msgSuccess('已保存')
    refreshCounts()
  }).catch(() => {
    row[key] = oldValue
  })
}

function cancel() {
  open.value = false
}

function extractExtraFields(record) {
  const formKeys = new Set(activeFields.value.map(field => field.key))
  const extra = {}
  Object.keys(record || {}).forEach(key => {
    if (!formKeys.has(key) && !systemKeys.has(key)) {
      extra[key] = record[key]
    }
  })
  return extra
}

function stringifyJsonField(value, fallback) {
  const current = value === undefined ? fallback : value
  if (current === undefined || current === null || current === '') {
    return ''
  }
  if (typeof current === 'string') {
    return current
  }
  return JSON.stringify(current, null, 2)
}

function parseJsonObject(text, label) {
  const value = text && String(text).trim() ? JSON.parse(text) : {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}必须是 JSON 对象`)
  }
  return value
}

function parseJsonValue(text, label, root = 'any') {
  const value = text && String(text).trim()
    ? JSON.parse(text)
    : root === 'array' ? [] : {}
  if (root === 'object' && (!value || typeof value !== 'object' || Array.isArray(value))) {
    throw new Error(`${label}必须是 JSON 对象`)
  }
  if (root === 'array' && !Array.isArray(value)) {
    throw new Error(`${label}必须是 JSON 数组`)
  }
  return value
}

function normalizeFieldValue(value, field) {
  if (field.type === 'number') {
    if (value === '' || value === null || value === undefined) {
      return null
    }
    return Number(value)
  }
  if (field.type === 'switch') {
    return Boolean(value)
  }
  if (field.type === 'date') {
    if (value === '' || value === null || value === undefined) {
      return ''
    }
    const num = Number(value)
    return Number.isFinite(num) ? num : value
  }
  if (field.type === 'json') {
    try {
      return parseJsonValue(value, field.label, field.jsonRoot || 'any')
    } catch (error) {
      throw new Error(`${field.label}格式错误：${error.message}`)
    }
  }
  return value
}

function getRowId(row) {
  if (!row || typeof row !== 'object') {
    return undefined
  }
  const directKeys = ['_id', 'id', 'ID', 'Id', `${activeTable.value}Id`]
  for (const key of directKeys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key]
    }
  }
  const idKey = Object.keys(row).find(key => {
    const lower = key.toLowerCase()
    return lower === 'id' || lower.endsWith('id') || lower.endsWith('_id')
  })
  return idKey ? row[idKey] : undefined
}

function getRowKey(row) {
  return getRowId(row) ?? JSON.stringify(row)
}

function hasRowId(row) {
  return getRowId(row) !== undefined
}

function isSelectable(row) {
  return hasRowId(row)
}

function toBoolean(value) {
  if (value === 'false' || value === '0' || value === 0 || value === null || value === undefined || value === '') {
    return false
  }
  return Boolean(value)
}

function booleanText(value) {
  return toBoolean(value) ? '是' : '否'
}

function optionLabel(options = [], value) {
  const option = options.find(item => item.value === value || String(item.value) === String(value))
  return option ? option.label : (value === undefined || value === null || value === '' ? '-' : String(value))
}

function statusTag(column, value) {
  const option = (column.options || []).find(item => item.value === value || String(item.value) === String(value))
  return option?.tag || 'info'
}

function formatCell(value, column = {}) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  if (column.type === 'money') {
    return money(value)
  }
  if (column.type === 'time' || column.type === 'date') {
    return dateText(value)
  }
  if (column.type === 'number') {
    return Number(value).toLocaleString()
  }
  if (column.type === 'json' || typeof value === 'object') {
    return JSON.stringify(value)
  }
  if (typeof value === 'boolean') {
    return booleanText(value)
  }
  return String(value)
}

function formatColumnLabel(column) {
  const labels = {
    _id: '记录ID',
    id: '记录ID',
    name: '名称',
    phone: '电话',
    contact: '联系人',
    address: '地址',
    createTime: '创建时间',
    updateTime: '更新时间',
    remark: '备注'
  }
  if (labels[column]) {
    return labels[column]
  }
  return column
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, char => char.toUpperCase())
}

function guessColumnType(key) {
  const lower = key.toLowerCase()
  if (lower.includes('time') || lower.includes('date')) {
    return 'time'
  }
  if (lower.includes('price') || lower.includes('amount') || lower.includes('freight') || lower.includes('total')) {
    return 'money'
  }
  if (lower.startsWith('is') || lower.includes('disabled') || lower.includes('approved') || lower.includes('review') || lower.includes('read')) {
    return 'boolean'
  }
  return 'text'
}

function getColumnWidth(column) {
  const lower = column.toLowerCase()
  if (lower.includes('content') || lower.includes('remark') || lower.includes('address')) {
    return 220
  }
  if (lower.includes('time') || lower.includes('date')) {
    return 165
  }
  if (lower.endsWith('id')) {
    return 150
  }
  return 140
}

function money(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return String(value)
  }
  return `¥${num.toFixed(2)}`
}

function dateText(value) {
  if (!value) {
    return '-'
  }
  const date = new Date(Number(value) || value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleString()
}

function formatCount(table) {
  const value = counts[table]
  return value === undefined ? '-' : value
}

function exportColumns(list) {
  const keys = []
  list.forEach(row => {
    if (!row || typeof row !== 'object') {
      return
    }
    Object.keys(row).forEach(key => {
      if (!keys.includes(key)) {
        keys.push(key)
      }
    })
  })
  return keys.sort(sortColumnKeys)
}

function sortColumnKeys(a, b) {
  const fixed = ['_id', 'id', 'name', 'title', 'code', 'status', 'dealStatus', 'createTime', 'updateTime']
  const ai = fixed.indexOf(a)
  const bi = fixed.indexOf(b)
  if (ai !== -1 || bi !== -1) {
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  }
  if (a.toLowerCase().endsWith('id') && !b.toLowerCase().endsWith('id')) {
    return -1
  }
  if (!a.toLowerCase().endsWith('id') && b.toLowerCase().endsWith('id')) {
    return 1
  }
  return a.localeCompare(b)
}

function exportRows() {
  return listSqms(activeTable.value, {
    ...queryParams.value,
    pageNum: 1,
    pageSize: 10000
  }).then(response => readRows(response))
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function escapeHtmlRaw(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function downloadTextFile(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function exportFilename(ext) {
  const date = new Date().toISOString().slice(0, 10)
  return `${activeMeta.value.shortTitle}-${activeTable.value}-${date}.${ext}`
}

function handleExportExcel() {
  exportRows().then(list => {
    const cols = exportColumns(list)
    if (!cols.length) {
      proxy.$modal.msgWarning('暂无可导出的数据')
      return
    }
    const rowsText = [
      cols.map(col => csvCell(formatColumnLabel(col))).join(','),
      ...list.map(row => cols.map(col => csvCell(formatCell(row[col]))).join(','))
    ].join('\r\n')
    downloadTextFile('\ufeff' + rowsText, exportFilename('csv'), 'text/csv;charset=utf-8')
  })
}

function handleExportWord() {
  exportRows().then(list => {
    const cols = exportColumns(list)
    if (!cols.length) {
      proxy.$modal.msgWarning('暂无可导出的数据')
      return
    }
    const bodyRows = list.map(row => `<tr>${cols.map(col => `<td>${escapeHtmlRaw(formatCell(row[col]))}</td>`).join('')}</tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:"Microsoft YaHei",Arial,sans-serif;color:#1f2937;}
      h1{font-size:22px;margin:0 0 8px;}
      .meta{color:#6b7280;margin-bottom:16px;}
      table{border-collapse:collapse;width:100%;}
      th,td{border:1px solid #d9e2ec;padding:8px 10px;font-size:12px;vertical-align:middle;}
      th{background:#eef4ff;color:#1e40af;text-align:left;}
    </style></head><body>
      <h1>${escapeHtmlRaw(activeMeta.value.title)}数据导出</h1>
      <div class="meta">数据表：${escapeHtmlRaw(activeTable.value)}，导出时间：${escapeHtmlRaw(new Date().toLocaleString())}</div>
      <table><thead><tr>${cols.map(col => `<th>${escapeHtmlRaw(formatColumnLabel(col))}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table>
    </body></html>`
    downloadTextFile('\ufeff' + html, exportFilename('doc'), 'application/msword;charset=utf-8')
  })
}

function quoteOrderTotal(items) {
  return items.reduce((sum, item) => {
    return sum + (Number(item.qty) || 0) * (Number(item.price) || 0)
  }, 0)
}

function handleExportQuoteTemplate() {
  Promise.all([
    exportRows(),
    listSqms('quoteItems', { pageNum: 1, pageSize: 10000 })
  ]).then(([orders, itemResponse]) => {
    const allItems = readRows(itemResponse).filter(item => !item.needsAdminReview)
    if (!orders.length) {
      proxy.$modal.msgWarning('暂无可导出的报价单')
      return
    }
    const sections = orders.map(order => {
      const orderId = getRowId(order)
      const items = allItems.filter(item => item.orderId === orderId)
      const bodyRows = items.length ? items.map((item, index) => {
        const totalAmount = (Number(item.qty) || 0) * (Number(item.price) || 0)
        return `<tr>
          <td>${index + 1}</td>
          <td>${escapeHtmlRaw(item.productName)}</td>
          <td>${escapeHtmlRaw(item.spec)}</td>
          <td>${escapeHtmlRaw(item.unit || '个')}</td>
          <td>${money(item.price)}</td>
          <td>${escapeHtmlRaw(item.qty)}</td>
          <td>${money(totalAmount)}</td>
        </tr>`
      }).join('') : '<tr><td colspan="7" class="empty-row">暂无报价明细</td></tr>'
      return `<section class="quote-section">
        <h2>${escapeHtmlRaw(order.customerName || '客户')}采购物品询价单</h2>
        <div class="meta">报价员工：${escapeHtmlRaw(order.employeeName || '-')}，日期：${escapeHtmlRaw(dateText(order.createTime))}</div>
        <table>
          <thead><tr><th>序号</th><th>物品名称</th><th>规格</th><th>单位</th><th>单价</th><th>数量</th><th>合计</th></tr></thead>
          <tbody>${bodyRows}</tbody>
          <tfoot><tr><td colspan="6">合计</td><td>${money(quoteOrderTotal(items))}</td></tr></tfoot>
        </table>
      </section>`
    }).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:"Microsoft YaHei",Arial,sans-serif;color:#111827;}
      .quote-section{margin:0 0 28px;page-break-inside:avoid;}
      h2{font-size:20px;margin:0 0 8px;}
      .meta{color:#667085;margin-bottom:12px;}
      table{border-collapse:collapse;width:100%;}
      th,td{border:1px solid #cfd8e3;padding:8px 10px;font-size:12px;text-align:left;}
      th{background:#eef4ff;color:#1e40af;}
      td:nth-child(1),td:nth-child(4),td:nth-child(6){text-align:center;}
      td:nth-child(5),td:nth-child(7),tfoot td{text-align:right;}
      tfoot td{font-weight:700;background:#f8fafc;}
      .empty-row{text-align:center;color:#98a2b3;}
    </style></head><body>${sections}</body></html>`
    downloadTextFile('\ufeff' + html, exportFilename('xls'), 'application/vnd.ms-excel;charset=utf-8')
  })
}

onMounted(() => {
  getList()
  refreshCounts()
})
</script>

<style scoped>
.sqms-page {
  background: #f5f7fb;
  min-height: calc(100vh - 84px);
}

.sqms-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 18px 20px;
  margin-bottom: 14px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fbfcff;
}

.sqms-kicker {
  color: #409eff;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.sqms-head h2 {
  margin: 0;
  font-size: 22px;
  color: #1f2d3d;
}

.sqms-head p {
  margin: 8px 0 0;
  color: #667085;
}

.module-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.module-group {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fbfcff;
  padding: 14px;
}

.module-group__title {
  font-weight: 700;
  color: #1f2d3d;
  margin-bottom: 10px;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(124px, 1fr));
  gap: 8px;
}

.module-tile {
  position: relative;
  min-height: 78px;
  padding: 10px 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #f8fafd;
  text-align: left;
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
}

.module-tile:hover,
.module-tile.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.module-tile__name {
  display: block;
  color: #1f2d3d;
  font-weight: 700;
}

.module-tile__desc {
  display: block;
  margin-top: 5px;
  color: #7a8494;
  font-size: 12px;
  line-height: 1.35;
}

.module-tile strong {
  position: absolute;
  right: 10px;
  bottom: 8px;
  color: #409eff;
  font-size: 18px;
}

.toolbar-panel {
  padding: 14px 16px 8px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fbfcff;
  margin-bottom: 12px;
}

.sqms-query {
  margin-bottom: 4px;
}

.sqms-page__tip {
  margin-bottom: 8px;
}

.sqms-page__cell {
  display: inline-block;
  max-width: 100%;
  vertical-align: middle;
}

.table-select {
  width: 116px;
}

.dialog-tip {
  margin-bottom: 16px;
}

.business-form {
  max-height: 62vh;
  overflow: auto;
  padding-right: 8px;
}

.advanced-collapse {
  margin-top: 4px;
}

.advanced-hint {
  margin-left: 10px;
  color: #98a2b3;
  font-size: 12px;
}

:deep(.el-textarea__inner) {
  font-family: Consolas, Monaco, 'Courier New', monospace;
}

@media (max-width: 1200px) {
  .module-groups {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .sqms-head {
    flex-direction: column;
  }

  .module-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
