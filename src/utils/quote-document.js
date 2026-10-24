// Shared export contract. Keep the admin copy (src/utils/quote-document.js) identical.
// Native OOXML files work in Word/Excel/WPS and WeChat's document viewer.
import { zipSync, strToU8 } from 'fflate'

export const QUOTE_COLUMNS = ['序号', '物品名称', '规格型号', '单位', '单价', '备注']
const ROWS_PER_PAGE = 18
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const SML = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const WML = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function clean(value) {
	return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}
function xml(value) {
	return clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
function dateText(value) {
	if (!value) return ''
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
	const date = new Date(Number(value) || value)
	if (Number.isNaN(date.getTime())) return ''
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function reviewPending(value) { return value === true || value === 1 || value === '1' || value === 'true' }

export function buildQuoteDocument(order, allItems) {
	if (!order || !order._id) throw new Error('报价单不存在，请刷新后重试')
	const rows = allItems.filter((item) => String(item.orderId) === String(order._id) && !reviewPending(item.needsAdminReview))
	if (!rows.length) throw new Error('暂无可导出的已审核报价明细，请先保存并同步报价单')
	return {
		title: `${clean(order.customerName).trim() || '未命名客户'}采购物资报价单`,
		customerName: clean(order.customerName).trim() || '未命名客户',
		person: clean(order.employeeName || order.ownerName),
		date: dateText(order.createTime || order.updateTime),
		rows: rows.map((item, index) => {
			// Never substitute a product's current price for the saved quotation price.
			const missingPrice = item.price == null || String(item.price).trim() === ''
			const price = missingPrice ? null : Number(item.price)
			if (price !== null && !Number.isFinite(price)) throw new Error(`第 ${index + 1} 项报价单价无效，请先修改并保存`)
			return [index + 1, clean(item.productName), clean(item.spec), clean(item.unit), price, clean(item.remark)]
		})
	}
}

export function quoteFilename(documents, extension) {
	const title = documents.length === 1 ? documents[0].title : `采购物资报价单（${documents.length}张）`
	return title.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').replace(/[. ]+$/, '').slice(0, 100) + '.' + extension
}

export function quoteText(document, delimiter = '\t') {
	const cell = (value) => {
		const text = clean(value)
		return delimiter === ',' ? `"${(/^[=+@-]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"` : text.replace(/[\t\r\n]+/g, ' ')
	}
	const rows = [[document.title], ['报价单位名称（盖章）'], QUOTE_COLUMNS,
		...document.rows.map((row) => row.map((value, index) => index === 4 && value !== null ? value.toFixed(2) : value)),
		[], [`报价日期：${document.date}`], [`报价人：${document.person}`]]
	return rows.map((row) => row.map(cell).join(delimiter)).join('\r\n')
}

function pages(document) {
	const result = []
	for (let start = 0; start < document.rows.length; start += ROWS_PER_PAGE) {
		const rows = document.rows.slice(start, start + ROWS_PER_PAGE)
		while (rows.length < ROWS_PER_PAGE) rows.push([start + rows.length + 1, '', '', '', null, ''])
		result.push(rows)
	}
	return result
}
function archive(files) {
	return zipSync(Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)])), { level: 6 })
}
function relations(entries) {
	return XML + `<Relationships xmlns="${PKG_REL}">${entries.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`).join('')}</Relationships>`
}
function contentTypes(overrides) {
	return XML + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.map(([part, type]) => `<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.${type}+xml"/>`).join('')}</Types>`
}

function wordParagraph(text, { center = false, title = false, after = 0 } = {}) {
	return `<w:p><w:pPr>${title ? '<w:pStyle w:val="Title"/>' : ''}<w:spacing w:before="0" w:after="${after}"/><w:jc w:val="${center ? 'center' : 'left'}"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="宋体"/><w:color w:val="000000"/><w:sz w:val="${title ? 36 : 24}"/><w:szCs w:val="${title ? 36 : 24}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`
}
function wordCell(text, width, span = 1, center = false) {
	return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${wordParagraph(text, { center })}</w:tc>`
}
function wordTable(rows) {
	const widths = [700, 3200, 2600, 850, 1250, 1600]
	const header = `<w:tr><w:trPr><w:trHeight w:val="400" w:hRule="atLeast"/><w:tblHeader/></w:trPr>${wordCell('报价单位名称（盖章）', 6500, 3, true)}${wordCell('', 3700, 3)}</w:tr>`
	const detail = [QUOTE_COLUMNS, ...rows].map((row, index) => `<w:tr><w:trPr><w:trHeight w:val="400" w:hRule="atLeast"/><w:cantSplit/>${index === 0 ? '<w:tblHeader/>' : ''}</w:trPr>${row.map((value, column) => wordCell(column === 4 && typeof value === 'number' ? value.toFixed(2) : value, widths[column], 1, index === 0 || [0, 3, 4].includes(column))).join('')}</w:tr>`).join('')
	return `<w:tbl><w:tblPr><w:tblW w:w="10200" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map((side) => `<w:${side} w:val="single" w:sz="4" w:color="000000"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="35" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="35" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${header}${detail}</w:tbl>`
}
export function createQuoteDocx(documents) {
	const sheets = documents.flatMap((document) => pages(document).map((rows) =>
		wordParagraph(document.title, { center: true, title: true, after: 160 }) + wordTable(rows) +
		wordParagraph(`报价日期：${document.date}`, { after: 100 }) + wordParagraph(`报价人：${document.person}`)))
	const files = {
		'[Content_Types].xml': contentTypes([['word/document.xml', 'wordprocessingml.document.main'], ['word/styles.xml', 'wordprocessingml.styles']]),
		'_rels/.rels': relations([['rId1', 'officeDocument', 'word/document.xml']]),
		'word/_rels/document.xml.rels': relations([['rId1', 'styles', 'styles.xml']]),
		'word/styles.xml': XML + `<w:styles xmlns:w="${WML}"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/></w:style></w:styles>`,
		'word/document.xml': XML + `<w:document xmlns:w="${WML}"><w:body>${sheets.join('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`
	}
	return archive(files)
}

function sheetCell(value, row, col, style = 0) {
	const ref = String.fromCharCode(65 + col) + row
	return typeof value === 'number' ? `<c r="${ref}" s="${style}"><v>${value}</v></c>` : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
}
function sheetXml(document) {
	const rows = [], merges = [], breaks = []
	const addRow = (number, values, styles, height) => rows.push(`<row r="${number}" ht="${height}" customHeight="1">${values.map((value, col) => sheetCell(value, number, col, styles[col] || 0)).join('')}</row>`)
	pages(document).forEach((items, index) => {
		const first = index * 25 + 1
		if (index) breaks.push(first - 1)
		addRow(first, [document.title], [1], 44)
		addRow(first + 1, ['报价单位名称（盖章）', '', '', '', '', ''], [2, 2, 2, 2, 2, 2], 24)
		addRow(first + 2, QUOTE_COLUMNS, [2, 2, 2, 2, 2, 2], 24)
		merges.push(`A${first}:F${first}`, `A${first + 1}:C${first + 1}`, `D${first + 1}:F${first + 1}`)
		items.forEach((row, i) => {
			const lines = Math.max(1, Math.ceil(row[1].length / 14), Math.ceil(row[2].length / 12), Math.ceil(row[5].length / 7))
			addRow(first + 3 + i, row, [2, 3, 3, 2, 4, 3], Math.max(24, lines * 16))
		})
		addRow(first + 22, [`报价日期：${document.date}`], [0], 24)
		addRow(first + 23, [`报价人：${document.person}`], [0], 24)
		merges.push(`A${first + 22}:F${first + 22}`, `A${first + 23}:F${first + 23}`)
	})
	const cols = [7, 30, 25, 8, 12, 15].map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')
	return XML + `<worksheet xmlns="${SML}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${cols}</cols><sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.59" right="0.59" top="0.59" bottom="0.59" header="0" footer="0"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>${breaks.length ? `<rowBreaks count="${breaks.length}" manualBreakCount="${breaks.length}">${breaks.map((id) => `<brk id="${id}" max="16383" man="1"/>`).join('')}</rowBreaks>` : ''}</worksheet>`
}
export function createQuoteXlsx(documents) {
	const names = new Set()
	const sheetNames = documents.map((document) => {
		const base = document.customerName.replace(/[\\/*?:\[\]]/g, '_').replace(/^'+|'+$/g, '').slice(0, 25) || '报价单'
		let name = base, i = 2
		while (names.has(name.toLowerCase())) name = `${base} (${i++})`
		names.add(name.toLowerCase())
		return name
	})
	const border = '<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>'
	const xf = (fontId, borderId, align, numFmtId = 0) => `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="0" borderId="${borderId}" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="${align}" vertical="center" wrapText="1"/></xf>`
	const files = {
		'[Content_Types].xml': contentTypes([['xl/workbook.xml', 'spreadsheetml.sheet.main'], ['xl/styles.xml', 'spreadsheetml.styles'], ...documents.map((_, i) => [`xl/worksheets/sheet${i + 1}.xml`, 'spreadsheetml.worksheet'])]),
		'_rels/.rels': relations([['rId1', 'officeDocument', 'xl/workbook.xml']]),
		'xl/_rels/workbook.xml.rels': relations([...documents.map((_, i) => [`rId${i + 1}`, 'worksheet', `worksheets/sheet${i + 1}.xml`]), ['styles', 'styles', 'styles.xml']]),
		'xl/workbook.xml': XML + `<workbook xmlns="${SML}" xmlns:r="${REL}"><sheets>${sheetNames.map((name, i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><definedNames>${sheetNames.map((name, i) => `<definedName name="_xlnm.Print_Area" localSheetId="${i}">${xml("'" + name.replace(/'/g, "''") + "'!$A$1:$F$" + (pages(documents[i]).length * 25 - 1))}</definedName>`).join('')}</definedNames></workbook>`,
		'xl/styles.xml': XML + `<styleSheet xmlns="${SML}"><fonts count="2">${[12, 18].map((size) => `<font><sz val="${size}"/><color rgb="FF000000"/><name val="宋体"/><charset val="134"/></font>`).join('')}</fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${border}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5">${xf(0, 0, 'left')}${xf(1, 0, 'center')}${xf(0, 1, 'center')}${xf(0, 1, 'left')}${xf(0, 1, 'right', 2)}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
	}
	documents.forEach((document, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(document) })
	return archive(files)
}

export function createQuoteFile(documents, format) {
	if (!documents.length) throw new Error('请选择要导出的报价单')
	if (!['xlsx', 'docx'].includes(format)) throw new Error('不支持的导出格式')
	return { name: quoteFilename(documents, format), bytes: format === 'xlsx' ? createQuoteXlsx(documents) : createQuoteDocx(documents),
		mime: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
}
