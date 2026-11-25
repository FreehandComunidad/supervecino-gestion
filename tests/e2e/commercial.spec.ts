import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const password = 'CI-only-Synthetic-Password-2026!'
const service = createClient<any>(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
let cashierId = '', managerId = '', stockProductId = '', nonStockProductId = '', supplierId = ''
let cashierClient: ReturnType<typeof createClient<any>>, managerClient: ReturnType<typeof createClient<any>>, ownerClient: ReturnType<typeof createClient<any>>
let cashierToken = '', managerToken = ''

async function createUser(email: string, role: 'owner' | 'manager' | 'cashier') {
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('No se pudo crear el usuario sintético ' + email)
  const profile = await service.from('profiles').upsert({ id: data.user.id, full_name: email.split('@')[0], role, active: true })
  if (profile.error) throw profile.error
  const client = createClient<any>(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const signedIn = await client.auth.signInWithPassword({ email, password })
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error('No se pudo iniciar sesión: ' + email)
  return { id: data.user.id, client, token: signedIn.data.session.access_token }
}

test.describe('SÚPERVECINO — flujos comerciales aislados', () => {
  test.describe.configure({ mode: 'serial' })
  test.beforeAll(async () => {
    if (!url || !anonKey || !serviceKey) throw new Error('Faltan credenciales efímeras locales de Supabase')
    const cashier = await createUser('ci-cashier@supervecino.local', 'cashier')
    const manager = await createUser('ci-manager@supervecino.local', 'manager')
    const owner = await createUser('ci-owner@supervecino.local', 'owner')
    cashierId = cashier.id; cashierClient = cashier.client; cashierToken = cashier.token
    managerId = manager.id; managerClient = manager.client; managerToken = manager.token
    ownerClient = owner.client
    const supplier = await service.from('suppliers').insert({ name: 'CI Synthetic Supplier', active: true }).select('id').single()
    if (supplier.error) throw supplier.error
    supplierId = supplier.data.id
    const products = await service.from('products').insert([
      { name: 'CI E2E Stock Product', sale_price: 100, cost_price: 40, vat_rate: 21, stock: 10, min_stock: 1, manages_stock: true, active: true, unit: 'unidad' },
      { name: 'CI E2E Nonstock Product', sale_price: 50, cost_price: 20, vat_rate: 21, stock: 0, min_stock: 0, manages_stock: false, active: true, unit: 'unidad' },
    ]).select('id,name')
    if (products.error) throw products.error
    stockProductId = products.data.find(p => p.name === 'CI E2E Stock Product')!.id
    nonStockProductId = products.data.find(p => p.name === 'CI E2E Nonstock Product')!.id
  })

  test('POS: apertura, ingresos/egresos, descuento, medios de pago, stock y cierre conciliado', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Usuario').fill('ci-cashier')
    await page.getByLabel('Contraseña').fill(password)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('heading', { name: 'Punto de venta' })).toBeVisible()
    await page.getByLabel('Monto inicial de caja').fill('1000')
    await page.getByRole('button', { name: 'Abrir caja' }).click()
    await expect(page.getByText('Caja abierta')).toBeVisible()

    await page.getByLabel('Tipo de movimiento de caja').selectOption('in')
    await page.getByLabel('Importe del movimiento').fill('100')
    await page.getByLabel('Descripción del movimiento').fill('CI ingreso de caja')
    await page.getByRole('button', { name: 'Registrar movimiento' }).click()
    await expect(page.getByRole('status')).toContainText('Ingreso de caja registrado.')
    await page.getByLabel('Tipo de movimiento de caja').selectOption('out')
    await page.getByLabel('Importe del movimiento').fill('20')
    await page.getByLabel('Descripción del movimiento').fill('CI egreso de caja')
    await page.getByRole('button', { name: 'Registrar movimiento' }).click()
    await expect(page.getByRole('status')).toContainText('Egreso de caja registrado.')

    await page.getByRole('button', { name: /CI E2E Stock Product/ }).click()
    await page.getByRole('button', { name: /CI E2E Nonstock Product/ }).click()
    await page.getByLabel('Descuento en pesos').fill('10')
    await page.getByRole('button', { name: 'Efectivo' }).click()
    await page.getByRole('button', { name: /Cobrar/ }).click()
    await expect(page.getByRole('status')).toContainText('Venta registrada correctamente.')

    await page.getByRole('button', { name: /CI E2E Nonstock Product/ }).click()
    await page.getByRole('button', { name: 'Transfer.' }).click()
    await page.getByRole('button', { name: /Cobrar/ }).click()
    await expect(page.getByRole('status')).toContainText('Venta registrada correctamente.')
    await page.getByLabel('Efectivo contado al cierre').fill('1220')
    await page.getByRole('button', { name: 'Cerrar caja' }).click()
    await expect(page.getByRole('status')).toContainText('Caja cerrada. Esperado:')

    const sales = await service.from('sales').select('id,total,discount,cashier_id').eq('cashier_id', cashierId)
    expect(sales.error).toBeNull(); expect(sales.data).toHaveLength(2)
    expect(sales.data!.some(s => Number(s.total) === 140 && Number(s.discount) === 10)).toBeTruthy()
    const saleIds = sales.data!.map(s => s.id)
    const payments = await service.from('payments').select('method,amount,sale_id').in('sale_id', saleIds)
    expect(payments.error).toBeNull(); expect(new Set(payments.data!.map(p => p.method))).toEqual(new Set(['cash', 'transfer']))
    const items = await service.from('sale_items').select('id').in('sale_id', saleIds)
    expect(items.data).toHaveLength(3)
    const stock = await service.from('products').select('id,stock').in('id', [stockProductId, nonStockProductId])
    expect(Number(stock.data!.find(p => p.id === stockProductId)!.stock)).toBe(9)
    expect(Number(stock.data!.find(p => p.id === nonStockProductId)!.stock)).toBe(0)
    const session = await service.from('cash_sessions').select('id,expected_amount,closing_amount,closed_at').eq('opened_by', cashierId).single()
    expect(Number(session.data!.expected_amount)).toBe(1220); expect(Number(session.data!.closing_amount)).toBe(1220); expect(session.data!.closed_at).toBeTruthy()
    const movements = await service.from('cash_movements').select('movement_type,amount').eq('session_id', session.data!.id)
    expect(movements.data).toHaveLength(3)
    expect(new Set(movements.data!.map(m => m.movement_type))).toEqual(new Set(['in', 'out', 'sale']))
    expect((await cashierClient.from('cash_sessions').select('id')).data).toHaveLength(1)
    expect((await cashierClient.from('cash_movements').select('id')).data).toHaveLength(3)
    expect((await cashierClient.from('sales').select('id')).data).toHaveLength(2)
  })

  test('compras, pagos, stock, reportes, permisos directos, idempotencia y asistente', async ({ request }) => {
    const today = new Date().toISOString().slice(0, 10)
    const purchase = await managerClient.rpc('create_purchase_with_items', {
      p_supplier_id: supplierId, p_invoice_number: 'CI-E2E-PURCHASE-001', p_purchase_date: today, p_due_date: today,
      p_notes: 'Compra sintética de CI', p_items: [{ product_id: stockProductId, quantity: 2, unit_cost_net: 50, vat_rate: 21 }],
    })
    expect(purchase.error).toBeNull()
    const purchaseId = purchase.data as string
    const received = await managerClient.rpc('receive_purchase', { p_purchase_id: purchaseId })
    expect(received.error).toBeNull()
    const receivedAgain = await managerClient.rpc('receive_purchase', { p_purchase_id: purchaseId })
    expect(receivedAgain.error?.message).toContain('La compra ya fue procesada.')
    const partial = await managerClient.rpc('register_supplier_payment', { p_purchase_id: purchaseId, p_amount: 50, p_payment_date: today, p_payment_method: 'transfer', p_reference: null, p_notes: 'CI parcial' })
    expect(partial.error).toBeNull()
    const final = await managerClient.rpc('register_supplier_payment', { p_purchase_id: purchaseId, p_amount: 71, p_payment_date: today, p_payment_method: 'transfer', p_reference: null, p_notes: 'CI saldo' })
    expect(final.error).toBeNull()
    const overpay = await managerClient.rpc('register_supplier_payment', { p_purchase_id: purchaseId, p_amount: 1, p_payment_date: today, p_payment_method: 'transfer', p_reference: null, p_notes: 'CI exceso' })
    expect(overpay.error?.message).toContain('El pago supera el saldo pendiente.')

    const expense = await managerClient.from('operating_expenses').insert({ expense_date: today, category: 'CI', description: 'Gasto operativo sintético', amount: 25, payment_method: 'cash' }).select('id').single()
    expect(expense.error).toBeNull()
    const cashierPurchases = await cashierClient.from('purchases').select('id')
    const cashierPayments = await cashierClient.from('supplier_payments').select('id')
    const cashierExpenses = await cashierClient.from('operating_expenses').select('id')
    const cashierSuppliers = await cashierClient.from('suppliers').select('id')
    const cashierStockMovements = await cashierClient.from('stock_movements').select('id')
    expect(cashierPurchases.data).toEqual([]); expect(cashierPayments.data).toEqual([]); expect(cashierExpenses.data).toEqual([])
    expect(cashierSuppliers.data).toEqual([]); expect(cashierStockMovements.data).toEqual([])
    expect((await cashierClient.from('products').select('cost_price')).error).not.toBeNull()
    expect((await cashierClient.rpc('get_products_management')).error).not.toBeNull()
    expect((await cashierClient.rpc('create_purchase_with_items', { p_supplier_id: supplierId, p_invoice_number: 'CI-CASHIER-BLOCKED', p_purchase_date: today, p_due_date: today, p_notes: null, p_items: [{ product_id: stockProductId, quantity: 1, unit_cost_net: 50, vat_rate: 21 }] })).error).not.toBeNull()
    expect((await cashierClient.rpc('receive_purchase', { p_purchase_id: purchaseId })).error).not.toBeNull()
    expect((await cashierClient.rpc('register_supplier_payment', { p_purchase_id: purchaseId, p_amount: 1, p_payment_date: today, p_payment_method: 'cash', p_reference: null, p_notes: null })).error).not.toBeNull()
    expect((await cashierClient.rpc('adjust_product_stock', { p_product_id: stockProductId, p_quantity_delta: 1, p_notes: 'CI cashier blocked' })).error).not.toBeNull()

    const managerProducts = await managerClient.rpc('get_products_management')
    const ownerProducts = await ownerClient.rpc('get_products_management')
    expect(managerProducts.error).toBeNull(); expect(ownerProducts.error).toBeNull()
    const productRows = managerProducts.data as Array<{ id: string; sale_price: number | string; cost_price: number | string }>
    const stockProductContext = productRows.find((product) => product.id === stockProductId)
    expect(stockProductContext).toBeTruthy()
    expect(Number(stockProductContext!.sale_price) - Number(stockProductContext!.cost_price)).toBe(50)
    expect((await managerClient.from('cash_sessions').select('id')).data).toHaveLength(1)
    expect((await managerClient.from('cash_movements').select('id')).data).toHaveLength(3)
    expect((await managerClient.from('purchases').select('id').eq('id', purchaseId)).data).toHaveLength(1)
    expect((await managerClient.from('supplier_payments').select('id').eq('purchase_id', purchaseId)).data).toHaveLength(2)
    expect((await managerClient.from('operating_expenses').select('id')).data).toHaveLength(1)
    expect((await managerClient.from('sales').select('id')).data!.length).toBeGreaterThanOrEqual(2)
    expect((await ownerClient.from('purchases').select('id').eq('id', purchaseId)).data).toHaveLength(1)

    const cashierAssistant = await request.post('/api/assistant', { headers: { Authorization: 'Bearer ' + cashierToken }, data: { messages: [{ role: 'user', content: 'Resumen de ventas' }] } })
    expect(cashierAssistant.status()).toBe(403)
    const managerAssistant = await request.post('/api/assistant', { headers: { Authorization: 'Bearer ' + managerToken }, data: { messages: [{ role: 'user', content: 'Resumen de ventas' }] } })
    expect(managerAssistant.status()).toBe(503)

    const opened = await managerClient.rpc('open_cash_session', { p_opening_amount: 0 })
    expect(opened.error).toBeNull()
    const idempotencyKey = randomUUID()
    const saleArgs = { p_items: [{ product_id: stockProductId, quantity: 1 }], p_payments: [{ method: 'cash', amount: 60 }, { method: 'transfer', amount: 40 }], p_discount: 0, p_customer_id: null, p_notes: 'CI concurrent retry', p_idempotency_key: idempotencyKey }
    const before = await service.from('products').select('stock').eq('id', stockProductId).single()
    const [first, retry] = await Promise.all([managerClient.rpc('create_pos_sale', saleArgs), managerClient.rpc('create_pos_sale', saleArgs)])
    expect(first.error).toBeNull(); expect(retry.error).toBeNull()
    expect([first.data?.duplicate, retry.data?.duplicate].filter(Boolean)).toHaveLength(1)
    const idempotentSales = await service.from('sales').select('id').eq('idempotency_key', idempotencyKey)
    expect(idempotentSales.data).toHaveLength(1)
    expect((await service.from('sales').select('id').eq('cashier_id', managerId).eq('idempotency_key', idempotencyKey)).data).toHaveLength(1)
    const splitPayments = await service.from('payments').select('method,amount').eq('sale_id', idempotentSales.data![0].id)
    expect(splitPayments.data).toHaveLength(2)
    expect(new Set(splitPayments.data!.map(p => p.method))).toEqual(new Set(['cash', 'transfer']))
    const after = await service.from('products').select('stock').eq('id', stockProductId).single()
    expect(Number(after.data!.stock)).toBe(Number(before.data!.stock) - 1)
    const mismatched = await managerClient.rpc('create_pos_sale', { ...saleArgs, p_discount: 1, p_payments: [{ method: 'cash', amount: 60 }, { method: 'transfer', amount: 39 }] })
    expect(mismatched.error?.message).toContain('La clave de idempotencia ya fue utilizada para otra operación.')
    const closed = await managerClient.rpc('close_cash_session', { p_closing_amount: 60, p_notes: 'CI cierre de idempotencia' })
    expect(closed.error).toBeNull()
  })
})
