import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'

test('SheetJS reads and converts a generated workbook', () => {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Código', 'Producto', 'Precio'],
    ['7790000000012', 'Alimento balanceado', 1234.5],
  ])
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  const parsed = XLSX.read(buffer, { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(parsed.Sheets.Productos, { header: 1 })

  assert.deepEqual(rows[0], ['Código', 'Producto', 'Precio'])
  assert.deepEqual(rows[1], ['7790000000012', 'Alimento balanceado', 1234.5])
})
