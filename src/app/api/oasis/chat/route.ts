import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 60

type ChatBody = {
  agentId?: string
  businessId?: string | null
  conversationId?: string | null
  message?: string
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'La conexión con la base de datos no está configurada.' }, { status: 500 })
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(values) {
          try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    })

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return Response.json({ error: 'Tu sesión venció. Volvé a iniciar sesión.' }, { status: 401 })

    const body = (await request.json()) as ChatBody
    const agentId = String(body.agentId || '')
    const message = String(body.message || '').trim()
    const businessId = body.businessId ? String(body.businessId) : null
    if (!agentId || !message) return Response.json({ error: 'Falta seleccionar un agente o escribir un mensaje.' }, { status: 400 })
    if (message.length > 4000) return Response.json({ error: 'El mensaje no puede superar los 4.000 caracteres.' }, { status: 400 })

    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('organization_id,role')
      .eq('user_id', authData.user.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle()
    if (membershipError || !membership) return Response.json({ error: 'No tenés una organización activa en OASIS HQ.' }, { status: 403 })

    const { data: agent, error: agentError } = await supabase
      .from('oasis_agents')
      .select('id,name,job_title,department,specialty,instructions,business_id')
      .eq('id', agentId)
      .eq('organization_id', membership.organization_id)
      .eq('active', true)
      .single()
    if (agentError || !agent) return Response.json({ error: 'No encontramos ese agente en tu organización.' }, { status: 404 })

    let conversationId = body.conversationId || null
    if (conversationId) {
      const { data: existing, error: conversationError } = await supabase
        .from('oasis_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('organization_id', membership.organization_id)
        .eq('primary_agent_id', agent.id)
        .single()
      if (conversationError || !existing) return Response.json({ error: 'La conversación no existe o no tenés acceso.' }, { status: 404 })
    } else {
      const { data: recent } = await supabase
        .from('oasis_conversations')
        .select('id')
        .eq('organization_id', membership.organization_id)
        .eq('primary_agent_id', agent.id)
        .eq('created_by', authData.user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      conversationId = recent?.id || null
    }

    if (!conversationId) {
      const title = message.length > 70 ? message.slice(0, 67) + '…' : message
      const { data: created, error: createError } = await supabase
        .from('oasis_conversations')
        .insert({
          organization_id: membership.organization_id,
          business_id: businessId || agent.business_id,
          primary_agent_id: agent.id,
          title,
          created_by: authData.user.id,
        })
        .select('id')
        .single()
      if (createError || !created) return Response.json({ error: createError?.message || 'No se pudo crear la conversación.' }, { status: 500 })
      conversationId = created.id
    }

    const { error: insertMessageError } = await supabase.from('oasis_messages').insert({
      organization_id: membership.organization_id,
      conversation_id: conversationId,
      sender_type: 'user',
      sender_user_id: authData.user.id,
      content: message,
    })
    if (insertMessageError) return Response.json({ error: insertMessageError.message }, { status: 500 })

    const { data: history, error: historyError } = await supabase
      .from('oasis_messages')
      .select('sender_type,content,sender_agent_id,sender_user_id,created_at')
      .eq('conversation_id', conversationId)
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: false })
      .limit(18)
    if (historyError) return Response.json({ error: historyError.message }, { status: 500 })

    let businessContext = 'No se proporcionaron datos comerciales en esta consulta.'
    const { count: businessCount } = await supabase
      .from('businesses')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', membership.organization_id)
      .eq('active', true)

    if ((businessCount || 0) === 1) {
      const { data: products } = await supabase
        .from('products')
        .select('name,stock,min_stock,cost_price,sale_price,vat_rate')
        .eq('active', true)
        .limit(250)
      const since = new Date(Date.now() - 30 * 86400000).toISOString()
      const { data: sales } = await supabase
        .from('sales')
        .select('total,sold_at,status')
        .eq('status', 'completed')
        .gte('sold_at', since)
        .order('sold_at', { ascending: false })
        .limit(500)
      const items = products || []
      const completedSales = sales || []
      const revenue = completedSales.reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0)
      const lowStock = items.filter((p: any) => Number(p.min_stock || 0) > 0 && Number(p.stock || 0) <= Number(p.min_stock || 0))
      const stockValue = items.reduce((sum: number, p: any) => sum + Number(p.stock || 0) * Number(p.cost_price || 0), 0)
      businessContext = [
        'Datos de solo lectura del único negocio activo conectado al POS:',
        'Período de ventas: últimos 30 días.',
        'Ventas completadas registradas: ' + completedSales.length,
        'Facturación registrada: $' + revenue.toFixed(2),
        'Productos activos consultados: ' + items.length,
        'Productos bajo o en stock mínimo: ' + lowStock.length,
        'Valuación estimada del stock a costo neto: $' + stockValue.toFixed(2),
        'Alertas de stock: ' + lowStock.slice(0, 20).map((p: any) => p.name + ' (stock ' + p.stock + ', mínimo ' + p.min_stock + ')').join('; '),
      ].join('\n')
    } else {
      businessContext = 'Hay más de un negocio activo, pero las tablas actuales del POS todavía no tienen una relación business_id. No atribuyas ventas ni stock a un negocio específico hasta completar esa vinculación.'
    }

    const systemPrompt = [
      'Sos ' + agent.name + ', ' + agent.job_title + ' de OASIS HQ.',
      'Departamento: ' + agent.department + '.',
      'Especialidad: ' + (agent.specialty || 'Gestión general') + '.',
      'Instrucciones del perfil: ' + (agent.instructions || 'Ayudar al propietario con análisis y organización.') ,
      'Respondé siempre en español rioplatense claro y profesional.',
      'Tu función es analizar, explicar, proponer y ayudar a organizar el trabajo. No afirmes haber ejecutado acciones en sistemas.',
      'No inventes datos, cifras, proveedores, compras ni movimientos. Si falta información, aclaralo.',
      'No podés modificar precios, stock, caja, ventas, usuarios ni realizar compras. Para acciones sensibles, pedí aprobación expresa del propietario.',
      'Los datos comerciales siguientes son de solo lectura y pueden estar incompletos:',
      businessContext,
    ].join('\n\n')

    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
    if (!apiKey) return Response.json({ error: 'El acceso a IA todavía no está habilitado en este entorno.' }, { status: 503 })
    const model = process.env.AI_GATEWAY_MODEL || 'openai/gpt-5-mini'
    const messages = (history || []).slice().reverse().map((item: any) => ({
      role: item.sender_type === 'user' ? 'user' : 'assistant',
      content: item.content,
    }))

    const gatewayResponse = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_completion_tokens: 1000,
        stream: false,
      }),
      signal: AbortSignal.timeout(55000),
    })
    const gatewayData = await gatewayResponse.json()
    if (!gatewayResponse.ok) {
      const detail = gatewayData?.error?.message || gatewayData?.message || 'El proveedor de IA no pudo responder.'
      return Response.json({ error: detail }, { status: gatewayResponse.status >= 500 ? 502 : gatewayResponse.status })
    }

    const answer = gatewayData?.choices?.[0]?.message?.content
    if (typeof answer !== 'string' || !answer.trim()) return Response.json({ error: 'El agente no devolvió una respuesta de texto.' }, { status: 502 })

    const { error: saveError } = await supabase.from('oasis_messages').insert({
      organization_id: membership.organization_id,
      conversation_id: conversationId,
      sender_type: 'agent',
      sender_agent_id: agent.id,
      content: answer,
      metadata: { model, usage: gatewayData.usage || null },
    })
    if (saveError) return Response.json({ error: saveError.message }, { status: 500 })

    await supabase.from('oasis_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
    return Response.json({ answer, conversationId, model, usage: gatewayData.usage || null })
  } catch (error: any) {
    const message = error?.name === 'TimeoutError' ? 'La respuesta tardó demasiado. Intentá nuevamente.' : 'No se pudo completar la conversación.'
    return Response.json({ error: message }, { status: 500 })
  }
}
