<template>
  <div class="app-container sqms-page">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch">
      <el-form-item label="数据表">
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
          placeholder="请输入关键词"
          clearable
          style="width: 260px"
          @keyup.enter="handleQuery"
        />
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
      :title="`当前数据集：${currentTableLabel}。新增和编辑将以 JSON 对象提交。`"
    />

    <el-table
      v-loading="loading"
      :data="rows"
      border
      :row-key="getRowKey"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" align="center" :selectable="isSelectable" />
      <el-table-column type="index" label="序号" width="70" align="center" />
      <el-table-column
        v-for="column in columns"
        :key="column"
        :label="formatColumnLabel(column)"
        :prop="column"
        :min-width="getColumnWidth(column)"
        show-overflow-tooltip
      >
        <template #default="scope">
          <span class="sqms-page__cell">{{ formatCell(scope.row[column]) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" align="center" fixed="right" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" :disabled="!hasRowId(scope.row)" @click="handleUpdate(scope.row)">编辑</el-button>
          <el-button link type="primary" icon="Delete" :disabled="!hasRowId(scope.row)" @click="handleDelete(scope.row)">删除</el-button>
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

    <el-dialog :title="title" v-model="open" width="760px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="数据表">
          <el-input :model-value="currentTableLabel" disabled />
        </el-form-item>
        <el-form-item v-if="formId !== undefined" label="记录 ID">
          <el-input :model-value="formId" disabled />
        </el-form-item>
        <el-form-item label="JSON">
          <el-input
            v-model="jsonText"
            type="textarea"
            :rows="18"
            spellcheck="false"
            placeholder="{&#10;  &quot;name&quot;: &quot;示例&quot;&#10;}"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确定</el-button>
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

const tableLabels = {
  employees: '员工',
  customers: '客户',
  products: '产品',
  quoteOrders: '报价单',
  quoteItems: '报价明细',
  competitorQuotes: '同行报价',
  requestOrders: '需求单',
  requestItems: '需求明细',
  suppliers: '供应商',
  competitors: '竞争对手',
  purchaseOrders: '采购单',
  purchaseItems: '采购明细',
  follows: '跟进记录',
  suggestions: '建议',
  messages: '消息',
  settings: '设置'
}

const commonFieldLabels = {
  id: 'ID',
  createBy: '创建人',
  createTime: '创建时间',
  updateBy: '更新人',
  updateTime: '更新时间',
  remark: '备注'
}

const { proxy } = getCurrentInstance()
const route = useRoute()
const router = useRouter()

const tableOptions = sqmsTables.map(value => ({
  value,
  label: `${tableLabels[value]}（${value}）`
}))

const defaultTable = sqmsTables.includes(route.query.table) ? route.query.table : 'employees'
const activeTable = ref(defaultTable)
const rows = ref([])
const loading = ref(false)
const showSearch = ref(true)
const selectedRows = ref([])
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const open = ref(false)
const title = ref('')
const jsonText = ref('')
const formId = ref(undefined)

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    keyword: undefined
  }
})

const { queryParams } = toRefs(data)

const currentTableLabel = computed(() => tableLabels[activeTable.value] || activeTable.value)

const columns = computed(() => {
  const keys = []
  rows.value.forEach(row => {
    if (!row || typeof row !== 'object') {
      return
    }
    Object.keys(row).forEach(key => {
      if (!keys.includes(key)) {
        keys.push(key)
      }
    })
  })
  return keys.sort(sortColumnKeys).slice(0, 12)
})

watch(activeTable, table => {
  router.replace({ query: { ...route.query, table } })
})

function sortColumnKeys(a, b) {
  const fixed = ['id', 'name', 'title', 'code', 'status', 'createTime', 'updateTime']
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

function getList() {
  loading.value = true
  listSqms(activeTable.value, queryParams.value).then(response => {
    const list = readRows(response)
    rows.value = list
    total.value = readTotal(response, list)
  }).finally(() => {
    loading.value = false
  })
}

function handleTableChange() {
  queryParams.value.pageNum = 1
  selectedRows.value = []
  ids.value = []
  single.value = true
  multiple.value = true
  getList()
}

function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

function resetQuery() {
  queryParams.value.keyword = undefined
  handleQuery()
}

function handleSelectionChange(selection) {
  selectedRows.value = selection
  ids.value = selection.map(row => getRowId(row)).filter(id => id !== undefined)
  single.value = selection.length !== 1
  multiple.value = !ids.value.length
}

function handleAdd() {
  formId.value = undefined
  jsonText.value = '{\n  \n}'
  title.value = `新增${currentTableLabel.value}`
  open.value = true
}

function handleUpdate(row) {
  const currentRow = row || selectedRows.value[0]
  const id = getRowId(currentRow)
  if (id === undefined) {
    proxy.$modal.msgError('未找到记录 ID，无法编辑')
    return
  }
  formId.value = id
  title.value = `编辑${currentTableLabel.value}`
  getSqms(activeTable.value, id).then(response => {
    const detail = readDetail(response)
    jsonText.value = JSON.stringify(detail, null, 2)
    open.value = true
  })
}

function handleDelete(row) {
  const deleteIds = row ? [getRowId(row)] : ids.value
  const validIds = deleteIds.filter(id => id !== undefined)
  if (!validIds.length) {
    proxy.$modal.msgError('未找到记录 ID，无法删除')
    return
  }
  proxy.$modal.confirm(`是否确认删除 ${currentTableLabel.value} 记录：${validIds.join(', ')}？`).then(() => {
    return delSqms(activeTable.value, validIds.join(','))
  }).then(() => {
    proxy.$modal.msgSuccess('删除成功')
    getList()
  })
}

function submitForm() {
  let payload
  try {
    payload = JSON.parse(jsonText.value)
  } catch (error) {
    proxy.$modal.msgError(`JSON 格式错误：${error.message}`)
    return
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    proxy.$modal.msgError('请提交 JSON 对象')
    return
  }
  const request = formId.value === undefined
    ? addSqms(activeTable.value, payload)
    : updateSqms(activeTable.value, formId.value, payload)

  request.then(() => {
    proxy.$modal.msgSuccess(formId.value === undefined ? '新增成功' : '修改成功')
    open.value = false
    getList()
  })
}

function cancel() {
  open.value = false
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

function formatCell(value) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  return String(value)
}

function formatColumnLabel(column) {
  if (commonFieldLabels[column]) {
    return commonFieldLabels[column]
  }
  return column
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, char => char.toUpperCase())
}

function getColumnWidth(column) {
  if (column.toLowerCase().includes('time') || column.toLowerCase().includes('date')) {
    return 170
  }
  if (column.toLowerCase().endsWith('id')) {
    return 120
  }
  return 150
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

function exportRows() {
  return listSqms(activeTable.value, {
    ...queryParams.value,
    pageNum: 1,
    pageSize: 10000
  }).then(response => readRows(response))
}

function csvCell(value) {
  return `"${formatCell(value).replace(/"/g, '""')}"`
}

function escapeHtml(value) {
  return formatCell(value)
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
  return `${currentTableLabel.value}-${activeTable.value}-${date}.${ext}`
}

function money(value) {
  return `¥${Number(value || 0).toFixed(2)}`
}

function dateText(value) {
  if (!value) {
    return '-'
  }
  const date = new Date(Number(value) || value)
  if (Number.isNaN(date.getTime())) {
    return formatCell(value)
  }
  return date.toLocaleDateString()
}

function quoteOrderTotal(items) {
  return items.reduce((sum, item) => {
    return sum + (Number(item.qty) || 0) * (Number(item.price) || 0)
  }, 0)
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
      ...list.map(row => cols.map(col => csvCell(row[col])).join(','))
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
    const bodyRows = list.map(row => `<tr>${cols.map(col => `<td>${escapeHtml(row[col])}</td>`).join('')}</tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:"Microsoft YaHei",Arial,sans-serif;color:#1f2937;}
      h1{font-size:22px;margin:0 0 8px;}
      .meta{color:#6b7280;margin-bottom:16px;}
      table{border-collapse:collapse;width:100%;}
      th,td{border:1px solid #d9e2ec;padding:8px 10px;font-size:12px;vertical-align:middle;}
      th{background:#eef4ff;color:#1e40af;text-align:left;}
    </style></head><body>
      <h1>${escapeHtml(currentTableLabel.value)}数据导出</h1>
      <div class="meta">数据表：${escapeHtml(activeTable.value)}，导出时间：${new Date().toLocaleString()}</div>
      <table><thead><tr>${cols.map(col => `<th>${escapeHtml(formatColumnLabel(col))}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table>
    </body></html>`
    downloadTextFile('\ufeff' + html, exportFilename('doc'), 'application/msword;charset=utf-8')
  })
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
        const total = (Number(item.qty) || 0) * (Number(item.price) || 0)
        return `<tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td>${escapeHtml(item.spec)}</td>
          <td>${escapeHtml(item.unit || '个')}</td>
          <td>${money(item.price)}</td>
          <td>${escapeHtml(item.qty)}</td>
          <td>${money(total)}</td>
        </tr>`
      }).join('') : '<tr><td colspan="7" class="empty-row">暂无报价明细</td></tr>'
      return `<section class="quote-section">
        <h2>${escapeHtml(order.customerName || '客户')}采购物品询价单</h2>
        <div class="meta">报价员工：${escapeHtml(order.employeeName || '-')}，日期：${escapeHtml(dateText(order.createTime))}</div>
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
})
</script>

<style scoped>
.sqms-page__tip {
  margin-bottom: 12px;
}

.sqms-page__cell {
  display: inline-block;
  max-width: 100%;
  vertical-align: middle;
}

:deep(.el-textarea__inner) {
  font-family: Consolas, Monaco, 'Courier New', monospace;
}
</style>
