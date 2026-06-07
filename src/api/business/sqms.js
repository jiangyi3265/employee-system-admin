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
