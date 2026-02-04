import express from "express";
import cors from "cors";
import fs from "fs";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const products = JSON.parse(fs.readFileSync("./products.demo.json", "utf8"));

function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9\s]/g, " ") // quita signos
    .replace(/\s+/g, " ")
    .trim();
}

function isCompetitorQuestion(text = "") {
  const t = normalize(text);
  return (
    t.includes("competencia") ||
    t.includes("compar") || // comparar, comparacion, compara
    t.includes("vs") ||
    t.includes("versus") ||
    t.includes("diferencia") ||
    t.includes("mejor que") ||
    t.includes("ventaja")
  );
}

function detectProduct(userMessage, forcedProduct = "") {
  // 1) Si viene producto seleccionado desde el frontend, úsalo
  if (forcedProduct) {
    return (
      products.find(
        (p) => p.product.toLowerCase() === forcedProduct.toLowerCase()
      ) || null
    );
  }

  // 2) Match directo por nombre o alias (SIN scoring)
  const msg = normalize(userMessage);

  for (const p of products) {
    const names = [p.product, ...(p.aliases || [])];

    for (const name of names) {
      if (msg.includes(normalize(name))) {
        return p;
      }
    }
  }

  // 3) Si no hay match claro → null (que pregunte)
  return null;
}

function getProductMenuText() {
  return products
    .map((p) => `- ${p.product} (${p.category || "Producto"})`)
    .join("\n");
}

function buildProductContext(product) {
  const ai = product.approved_info || {};
  const dosageText =
    typeof ai.dosage === "string" ? ai.dosage : ai.dosage?.text || "";

  const guidance = product.extended_guidance || {};
  const keyPoints = product.key_points || [];
  const faqs = product.faqs || [];

  return `
Marca: ${product.brand}
Producto: ${product.product}
Categoría: ${product.category || "N/A"}
Ingrediente activo: ${product.active_ingredient || "N/A"}
Presentaciones: ${(product.presentations || []).join(", ") || "N/A"}

Información del producto (DEMO):
- Indicaciones: ${ai.indications || "N/A"}
- Cómo se usa / dosis: ${dosageText || "N/A"}
- Contraindicaciones: ${ai.contraindications || "N/A"}
- Advertencias: ${ai.warnings || "N/A"}
- Efectos secundarios: ${ai.adverse_effects || "N/A"}

Puntos clave:
${keyPoints.length ? keyPoints.map((x) => `- ${x}`).join("\n") : "- N/A"}

Guía extendida (DEMO):
${
  Object.keys(guidance).length
    ? Object.entries(guidance)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")
    : "- N/A"
}

FAQs internas:
${
  faqs.length
    ? faqs.map((f) => `- Q: ${f.q}\n  A: ${f.a}`).join("\n")
    : "- N/A"
}
`.trim();
}

async function generateAnswer({ userMessage, product }) {
  // Si no hay producto, pedimos aclaración
  if (!product) {
    const menu = getProductMenuText();

    const prompt = `
Eres un asistente de un laboratorio farmacéutico en modo DEMO. Respondes SOLO en español.
Tu objetivo es ayudar a un usuario, pero antes debes identificar el producto correcto.

El usuario escribió:
"${userMessage}"

No detectaste un producto con certeza.

Instrucciones:
- Haz UNA pregunta de aclaración muy corta para elegir el producto.
- Muestra un listado de opciones disponibles.
- Tono profesional y amable.
- No des dosis/indicaciones sin saber el producto.

Opciones:
${menu}

Responde con:

$$ Pregunta de aclaración
- (Una sola pregunta)

$$ Opciones disponibles
${menu}
`.trim();

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "Asistente de demo de laboratorio, claro y profesional.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.25,
      max_tokens: 260,
    });

    return (
      completion.choices[0]?.message?.content ??
      "$$ Pregunta de aclaración\n- ¿Sobre cuál producto te refieres?\n\n$$ Opciones disponibles\n" +
        menu
    );
  }

  // Si hay producto
  const context = buildProductContext(product);
  const competitorMode = isCompetitorQuestion(userMessage);

  const prompt = `
Eres un asistente de un laboratorio farmacéutico en modo DEMO. Respondes SOLO en español.

REGLAS ABSOLUTAS:
- Usa ÚNICAMENTE el contexto proporcionado como fuente del producto.
- NO inventes datos fuera del contexto.
- Si falta información, dilo y sugiere confirmarlo con la ficha oficial del laboratorio.
- Nunca menciones marcas competidoras específicas.
- No descalifiques a la competencia. Habla en términos generales.

Contexto del producto (ÚNICA FUENTE DE VERDAD):
${context}

Pregunta del usuario:
"${userMessage}"

${
  competitorMode
    ? `
MODO COMPARATIVO (DEMO) ACTIVADO:
- Responde destacando ventajas del producto BASADAS EN EL CONTEXTO.
- Si no hay elementos comparables, usa diferenciadores generales (claridad de uso, precauciones, consistencia del mensaje).
- Agrega diferenciadores del servicio (chatbot): disponibilidad 24/7, respuestas consistentes, escalamiento responsable, analítica de preguntas.
`
    : ""
}

Formato obligatorio de salida:

$$ Respuesta directa
- 1 a 2 líneas claras y directas.

$$ Cómo se usa
- Vía de administración.
- Frecuencia o momento de uso.

$$ Precauciones importantes
- 3 a 5 viñetas con lo más importante.

$$ Efectos secundarios frecuentes
- Lista separada por viñetas.

${
  competitorMode
    ? `
$$ Diferenciadores del producto
- 3 a 5 viñetas (solo basadas en el contexto).

$$ Diferenciadores del servicio (chatbot)
- 3 a 5 viñetas (UX, disponibilidad, consistencia, escalamiento, analítica).
`
    : ""
}

$$ Nota demo
- 1 línea breve (información referencial; validar con laboratorio).
`.trim();

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: "Asistente de demo de laboratorio, claro, empático y prudente.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: competitorMode ? 520 : 420,
  });

  return completion.choices[0]?.message?.content ?? "Lo siento, no pude generar respuesta.";
}

// Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Endpoint chat
app.post("/api/chat", async (req, res) => {
  try {
    const { message, product: forcedProduct } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: 'Falta el campo "message".' });
    }

    const productDetected = detectProduct(message, forcedProduct);

    const reply = await generateAnswer({
      userMessage: message,
      product: productDetected,
    });

    res.json({
      reply,
      detected_product: productDetected ? productDetected.product : null,
    });
  } catch (err) {
    console.error("Error /api/chat:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});
