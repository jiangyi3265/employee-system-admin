// One import/export contract: editable CSV values, never UI-formatted placeholders.
export const PRODUCT_COLUMNS = [
  ['_id', '商品编号'], ['name', '商品名称'], ['spec', '规格'], ['brand', '品牌'], ['category', '分类'],
  ['purchasePrice', '采购价'], ['attr1', '一级属性'], ['attr2', '二级属性'], ['costPrice', '成本价'],
  ['minPrice', '最低价'], ['suggestPrice', '建议价'], ['retailPrice', '零售价'],
  ['unitSmall', '小单位'], ['unitMedium', '中单位'], ['unitLarge', '大单位'],
  ['mediumToSmall', '中转小'], ['largeToMedium', '大转中']
]
const aliases = Object.fromEntries(PRODUCT_COLUMNS.flatMap(([key, label]) => [[key.toLowerCase(), key], [label, key]]))
Object.assign(aliases, { 名称: 'name', 规格型号: 'spec', id: '_id', 中单位换算: 'mediumToSmall', 大单位换算: 'largeToMedium' })
const optionalNumbers = ['costPrice', 'minPrice', 'suggestPrice', 'retailPrice', 'mediumToSmall', 'largeToMedium']
const empty = value => value == null || String(value).trim() === '' || String(value).trim() === '-'

export function decodeProductFile(buffer) {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le', { fatal: true }).decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be', { fatal: true }).decode(bytes)
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { return new TextDecoder('gb18030', { fatal: true }).decode(bytes) }
}

export function parseDelimited(text) {
  const source = text.replace(/^\uFEFF/, '')
  const header = source.split(/\r?\n/, 1)[0]
  const delimiter = header.includes('\t') ? '\t' : header.includes(',') ? ',' : ';'
  const records = []
  let row = [], cell = '', quoted = false, line = 1, start = 1
  const finish = () => { row.push(cell.trim()); if (row.some(value => value !== '')) records.push({ values: row, line: start }); row = []; cell = '' }
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++ }
      else if (quoted || !cell.trim()) quoted = !quoted
      else cell += char
    } else if (char === delimiter && !quoted) { row.push(cell.trim()); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      finish(); if (char === '\r' && source[i + 1] === '\n') i++; line++; start = line
    } else { cell += char; if (char === '\n') line++ }
  }
  if (quoted) throw new Error(`第 ${start} 行的引号未闭合，请检查 CSV`)
  finish()
  return records
}

function numberCell(value, line, label, positive = false) {
  if (empty(value)) throw new Error(`第 ${line} 行缺少${label}`)
  const normalized = String(value).trim().replace(/^[¥￥]\s*/, '').replace(/元$/, '').replace(/,/g, '').trim()
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`第 ${line} 行${label}不是有效的非负数字：${value}`)
  const number = Number(normalized)
  if (!Number.isFinite(number) || (positive && number <= 0)) throw new Error(`第 ${line} 行${label}必须大于 0`)
  return number
}

export function parseProductImport(text) {
  const [header, ...rows] = parseDelimited(text)
  if (!header) throw new Error('文件为空')
  const keys = header.values.map(value => aliases[value.trim().toLowerCase()] || '')
  for (const key of ['name', 'spec', 'purchasePrice']) {
    if (!keys.includes(key)) throw new Error('表头需包含商品名称、规格、采购价；支持本系统导出的 CSV')
  }
  if (keys.filter(Boolean).some((key, index, list) => list.indexOf(key) !== index)) throw new Error('表头存在重复字段，请检查后导入')
  return rows.map(({ values, line }) => {
    if (values.length !== header.values.length) throw new Error(`第 ${line} 行列数与表头不一致，请检查逗号和引号`)
    const record = {}
    keys.forEach((key, i) => { if (key) record[key] = empty(values[i]) ? '' : values[i].replace(/^'(?=[=+@-])/, '') })
    if (!record.name || !record.spec) throw new Error(`第 ${line} 行缺少商品名称或规格`)
    record.purchasePrice = numberCell(record.purchasePrice, line, '采购价')
    for (const key of optionalNumbers) {
      if (empty(record[key])) delete record[key]
      else record[key] = numberCell(record[key], line, PRODUCT_COLUMNS.find(([field]) => field === key)[1], key.endsWith('Small') || key.endsWith('Medium'))
    }
    return { record, line }
  })
}

function productKey(record) { return JSON.stringify([record.name, record.spec, record.brand || ''].map(value => String(value).trim())) }
export function planProductImport(entries, existing, defaults, generateId) {
  const ids = new Map(existing.map(record => [String(record._id), record]))
  const identities = new Map()
  for (const record of existing) {
    const key = productKey(record)
    identities.set(key, [...(identities.get(key) || []), record])
  }
  const seen = new Set()
  return entries.map(({ record, line }) => {
    const matches = identities.get(productKey(record)) || []
    const byId = record._id && ids.get(String(record._id))
    if (!byId && matches.length > 1) throw new Error(`第 ${line} 行匹配多个同名同规格商品，请保留导出文件中的商品编号`)
    const current = byId || matches[0]
    const id = current?._id || record._id || generateId()
    if (seen.has(id)) throw new Error(`第 ${line} 行重复导入同一商品，请先合并重复行`)
    const key = productKey(record)
    if (!current && seen.has('new:' + key)) throw new Error(`第 ${line} 行商品名称、规格和品牌重复`)
    seen.add(id); seen.add('new:' + key)
    const prices = defaults(record.purchasePrice)
    // Re-import must preserve values present in the file, and units absent from old CSVs.
    const payload = { unitSmall: '个', unitMedium: '包', unitLarge: '箱', mediumToSmall: 12, largeToMedium: 12, stock: 0,
      ...current, ...prices, ...record, _id: id }
    for (const field of ['unitSmall', 'unitMedium', 'unitLarge']) if (!payload[field]) payload[field] = current?.[field] || ({ unitSmall: '个', unitMedium: '包', unitLarge: '箱' })[field]
    return { line, record: payload, kind: current ? 'update' : 'add', done: false, error: '' }
  })
}

export async function executeProductImport(plan, save, progress = () => {}, concurrency = 4) {
  const remaining = plan.filter(item => !item.done)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, remaining.length) }, async () => {
    while (cursor < remaining.length) {
      const item = remaining[cursor++]
      item.error = ''
      try {
        const response = await save(item)
        if (response?.code !== 200) throw new Error('服务器未确认入库，请重试')
        item.done = true
      }
      catch (error) { item.error = error?.message || '服务器未确认，请重试' }
      progress()
    }
  }))
  return { succeeded: plan.filter(item => item.done).length, failed: plan.filter(item => !item.done).length }
}

export function exportProductsCsv(records) {
  const cell = value => {
    let text = String(value ?? '')
    if (typeof value !== 'number' && /^[=+@-]/.test(text)) text = "'" + text
    return '"' + text.replace(/"/g, '""') + '"'
  }
  return '\uFEFF' + [PRODUCT_COLUMNS.map(([, label]) => label), ...records.map(record => PRODUCT_COLUMNS.map(([key]) => record[key] ?? ''))]
    .map(row => row.map(cell).join(',')).join('\r\n')
}

export async function fetchAllRows(fetchPage) {
  const result = []
  for (let page = 1; ; page++) {
    const response = await fetchPage(page, 1000)
    const rows = response.rows || response.data?.rows
    if (!Array.isArray(rows)) throw new Error('服务器未返回完整列表，请重试')
    result.push(...rows)
    const total = Number(response.total ?? response.data?.total)
    if ((Number.isFinite(total) && result.length >= total) || (!Number.isFinite(total) && rows.length < 1000)) return result
    if (!rows.length) throw new Error('列表读取不完整，请重试')
  }
}
