import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const systemPrompt = `Sos el asistente central de SÚPERVECINO GESTIÓN, un comercio minorista de San Juan, Argentina.
Respondé en español rioplatense, claro, práctico y con importes en pesos argentinos.
Usá exclusivamente el contexto estructurado que se te proporciona para afirmar datos del negocio. Si falta información, decilo explícitamente; nunca inventes ventas, costos, pagos, stock ni fechas.
Diferenciá facturación, cobros, costo y ganancia. No llames ganancia neta a la facturación ni a la diferencia entre venta y costo si faltan gastos.
Explicá brevemente cómo llegaste a una cifra y el período al que corresponde.
AUTONOMÍA: solo lectura y recomendaciones. No afirmes que registraste, modificaste, pagaste, compraste, ajustaste o ejecutaste nada. No solicites contraseñas ni datos sensibles.
Si te piden una acción, prepará los pasos y pedí aprobación; en esta versión no hay herramientas de escritura habilitadas.`

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: 'Falta configurar la conexión con la base de datos.' }, { status: 500 })

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Iniciá sesión para usar el asistente.' }, { status: 401 })

    const db = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: 'Bearer ' + token } }
    })
    const { data: authData, error: authError } = await db.auth.getUser(token)
    if (authError || !authData.user) return NextResponse.json({ error: 'La sesión no es válida. Volvé a ingresar.' }, { status: 401 })

    const { data: profile, error: profileError } = await db.from('profiles').select('role,active').eq('id', authData.user.id).maybeSingle()
    if (profileError) return NextResponse.json({ error: 'No se pudo verificar tu perfil.' }, { status: 403 })
    if (!profile?.active || !['owner', 'manager'].includes(profile.role)) return NextResponse.json({ error: 'El asistente central está habilitado para propietarios y encargados autorizados.' }, { status: 403 })

    const body = await request.json()
    const incoming = Array.isArray(body.messages) ? body.messages.slice(-12) as ChatMessage[] : []
    const messages = incoming.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
    if (!messages.length || messages[messages.length - 1].role !== 'user') return NextResponse.json({ error: 'Escribí una consulta para continuar.' }, { status: 400 })

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const today = new Date().toISOString().slice(0, 10)
    const [productsResult, salesResult, cashResult, purchasesResult] = await Promise.all([
      db.from('products').select('name,brand,presentation,sale_price,cost_price,vat_rate,stock,min_stock,manages_stock,active').eq('active', true).order('name').limit(700),
      db.from('sales').select('sold_at,status,subtotal,discount,total').gte('sold_at', since).order('sold_at', { ascending: false }).limit(1500),
      db.from('cash_sessions').select('opened_at,closed_at,opening_amount,closing_amount,expected_amount,notes').order('opened_at', { ascending: false }).limit(40),
      db.from('purchases').select('invoice_number,purchase_date,due_date,status,subtotal,tax_total,total,supplier_id').order('purchase_date', { ascending: false }).limit(250)
    ])
    if (productsResult.error || salesResult.error || cashResult.error || purchasesResult.error) {
      return NextResponse.json({ error: 'No pude leer todos los datos. Revisá los permisos o intentá nuevamente.' }, { status: 500 })
    }

    const products = productsResult.data || []
    const sales = (salesResult.data || []).filter(s => s.status !== 'cancelled')
    const cash = cashResult.data || []
    const purchases = purchasesResult.data || []
    const lowStock = products.filter(p => p.manages_stock && Number(p.stock) <= Number(p.min_stock))
    const inventoryValueCost = products.reduce((sum, p) => sum + (p.manages_stock ? Number(p.stock) * Number(p.cost_price) : 0), 0)
    const grossSales = sales.reduce((sum, s) => sum + Number(s.total || 0), 0)
    const discounts = sales.reduce((sum, s) => sum + Number(s.discount || 0), 0)
    const duePurchases = purchases.filter(p => p.due_date && p.due_date <= today && !['paid', 'cancelled'].includes(String(p.status).toLowerCase()))
    const margins = products.filter(p => Number(p.sale_price) > 0).map(p => ({ name: p.name, brand: p.brand, salePrice: Number(p.sale_price), cost: Number(p.cost_price), grossMarginPercent: Number(p.sale_price) ? (((Number(p.sale_price) / (1 + Number(p.vat_rate || 0) / 100)) - Number(p.cost_price)) / (Number(p.sale_price) / (1 + Number(p.vat_rate || 0) / 100))) * 100 : 0 })).sort((a,b)=>a.grossMarginPercent-b.grossMarginPercent)
    const context = {
      fechaConsulta: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/San_Juan' }),
      periodoVentas: 'Últimos 30 días',
      resumen: {
        productosActivos: products.length,
        productosConStockBajo: lowStock.length,
        ventasRegistradas: sales.length,
        facturacionRegistrada30Dias: grossSales,
        descuentosRegistrados30Dias: discounts,
        inventarioValorizadoACosto: inventoryValueCost,
        comprasRegistradas: purchases.length,
        comprasVencidasOPorVencerHoy: duePurchases.length
      },
      stockBajo: lowStock.slice(0, 100).map(p => ({ producto: p.name, marca: p.brand, presentacion: p.presentation, stock: Number(p.stock), minimo: Number(p.min_stock) })),
      productosMenorMargen: margins.slice(0, 25),
      ventasRecientes: sales.slice(0, 80).map(s => ({ fecha: s.sold_at, total: Number(s.total), descuento: Number(s.discount), estado: s.status })),
      cajasRecientes: cash.slice(0, 20),
      comprasProximasOVencidas: duePurchases.slice(0, 60).map(p => ({ factura: p.invoice_number, fecha: p.purchase_date, vencimiento: p.due_date, estado: p.status, total: Number(p.total) })),
      limitaciones: ['No se consultan movimientos bancarios ni saldos externos.', 'Los gastos operativos no están incluidos en el cálculo de ganancia.', 'La deuda de compras se estima por vencimiento y estado; no equivale necesariamente a saldo impago confirmado.', 'El margen usa precio de venta y costo cargados en la ficha; puede no reflejar promociones, descuentos ni costos adicionales.']
    }

    const gatewayKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
    const model = process.env.AI_GATEWAY_MODEL || 'openai/gpt-5-mini'
    if (!gatewayKey) return NextResponse.json({ error: 'El asistente está instalado, pero falta habilitar AI Gateway en Vercel (AI_GATEWAY_API_KEY). No se modificó ningún dato.' }, { status: 503 })

    const completion = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + gatewayKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt + '\\n\\nCONTEXTO ACTUAL DEL NEGOCIO (datos de solo lectura):\\n' + JSON.stringify(context) },
          ...messages
        ]
      }),
      signal: AbortSignal.timeout(25000)
    })
    if (!completion.ok) {
      const detail = await completion.text()
      console.error('AI Gateway error', completion.status, detail.slice(0, 500))
      return NextResponse.json({ error: completion.status === 401 ? 'La credencial de AI Gateway no es válida.' : 'El proveedor de IA no respondió correctamente. Intentá de nuevo.' }, { status: 502 })
    }
    const payload = await completion.json()
    const reply = payload.choices?.[0]?.message?.content
    if (typeof reply !== 'string' || !reply.trim()) return NextResponse.json({ error: 'El modelo no devolvió una respuesta válida.' }, { status: 502 })
    return NextResponse.json({ reply: reply.trim(), model })
  } catch (error) {
    console.error('Central assistant error', error)
    return NextResponse.json({ error: 'No se pudo completar el análisis. Intentá nuevamente.' }, { status: 500 })
  }
}
