import request from '@/utils/request'

export const sqmsTables = [
  'employees',
  'customers',
  'products',
  'quoteOrders',
  'quoteItems',
  'competitorQuotes',
  'requestOrders',
  'requestItems',
  'suppliers',
  'competitors',
  'purchaseOrders',
  'purchaseItems',
  'purchaseRequests',
  'purchaseRequestItems',
  'follows',
  'suggestions',
  'messages',
  'settings'
]

function ensureTable(table) {
  if (!sqmsTables.includes(table)) {
    throw new Error(`Unsupported SQMS table: ${table}`)
  }
  return table
}

export function listSqms(table, query) {
  return request({
    url: `/sqms/${ensureTable(table)}/list`,
    method: 'get',
    params: query
  })
}

export function getSqms(table, id) {
  return request({
    url: `/sqms/${ensureTable(table)}/${id}`,
    method: 'get'
  })
}

export function addSqms(table, data) {
  return request({
    url: `/sqms/${ensureTable(table)}`,
    method: 'post',
    data
  })
}

// The import plan supplies stable IDs. The backend upserts by ID, so a lost
// acknowledgement can be retried without inserting the product a second time.
export function importSqmsProduct(data) {
  if (!data?._id) throw new Error('导入商品缺少稳定编号，请重新选择文件')
  return request({ url: '/sqms/products', method: 'post', data, headers: { repeatSubmit: false } })
}

export function updateSqms(table, id, data) {
  return request({
    url: `/sqms/${ensureTable(table)}/${id}`,
    method: 'put',
    data
  })
}

export function delSqms(table, ids) {
  return request({
    url: `/sqms/${ensureTable(table)}/${ids}`,
    method: 'delete'
  })
}

// 管理员强制清除某账号的微信绑定（员工/客户）
export function clearWechatBinding(table, id) {
  return request({
    url: '/sqms/auth/wechat/admin-unbind',
    method: 'post',
    data: { table: ensureTable(table), id }
  })
}
