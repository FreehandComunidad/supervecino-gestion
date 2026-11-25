import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]/g, "")

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  if (request.method !== "POST") return respond({ error: "Método no permitido." }, 405)

  const answersSecret = Deno.env.get("CRYPTIC_ANSWERS_JSON")
  if (!answersSecret) {
    return respond({ error: "El sistema de respuestas todavía no está configurado." }, 503)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) {
    return respond({ error: "El servicio de puntuación no está disponible." }, 503)
  }

  let answers: Record<string, string>
  try {
    answers = JSON.parse(answersSecret)
  } catch {
    return respond({ error: "La configuración de respuestas no es válida." }, 500)
  }

  let body: {
    guest_id?: string
    stage_number?: number
    answer?: string
    hints_used?: number
  }
  try {
    body = await request.json()
  } catch {
    return respond({ error: "Solicitud inválida." }, 400)
  }

  const guestId = String(body.guest_id || "")
  const stageNumber = Number(body.stage_number)
  const submittedAnswer = String(body.answer || "")
  const hintsUsed = Number(body.hints_used)

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(guestId)) {
    return respond({ error: "Participante inválido." }, 400)
  }
  if (!Number.isInteger(stageNumber) || stageNumber < 1 || stageNumber > 20) {
    return respond({ error: "Etapa inválida." }, 400)
  }
  if (!Number.isInteger(hintsUsed) || hintsUsed < 0 || hintsUsed > 3) {
    return respond({ error: "Cantidad de pistas inválida." }, 400)
  }

  const expectedAnswer = answers[String(stageNumber)]
  if (typeof expectedAnswer !== "string" || !expectedAnswer.trim()) {
    return respond({ error: "La etapa no está configurada." }, 503)
  }

  const isCorrect = normalize(submittedAnswer) === normalize(expectedAnswer)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.rpc("record_cryptic_attempt", {
    p_guest_id: guestId,
    p_stage_number: stageNumber,
    p_is_correct: isCorrect,
    p_hints_used: hintsUsed,
  })

  if (error) {
    return respond({ error: "No se pudo registrar el intento." }, 500)
  }

  const result = data as {
    correct?: boolean
    awarded?: boolean
    points_awarded?: number
    total_points?: number
    already_completed?: boolean
    attempts_used?: number
    remaining_attempts?: number
    locked?: boolean
    points_preview?: number
  }
  return respond({
    correct: Boolean(result?.correct),
    awarded: Number(result?.points_awarded || 0) > 0,
    points_awarded: Number(result?.points_awarded || 0),
    total_points: Number(result?.total_points || 0),
    already_completed: Boolean(result?.already_completed),
    attempts_used: Number(result?.attempts_used || 0),
    remaining_attempts: Number(result?.remaining_attempts || 0),
    locked: Boolean(result?.locked),
    points_preview: Number(result?.points_preview || 0),
  })
})
