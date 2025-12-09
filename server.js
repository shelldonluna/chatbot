import express from "express";
import cors from "cors";
import fs from "fs";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

// 1. Inicializar cliente Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// 2. Cargar FAQs
const faqs = JSON.parse(fs.readFileSync("./faqs.json", "utf8"));

// 3. Buscar la FAQ más parecida (misma lógica que ya usas)
function findBestFAQ(userQuestion) {
  const question = userQuestion.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const faq of faqs) {
    let score = 0;
    for (const word of faq.question.toLowerCase().split(/\s+/)) {
      if (question.includes(word)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = faq;
    }
  }
  return best;
}

// 4. Generar respuesta con GROQ + LLaMA
async function generateAnswer(userQuestion, faq) {
  const context = faq
    ? `Pregunta frecuente encontrada: "${faq.question}"
       Respuesta sugerida: "${faq.answer}"`
    : "No se encontró una FAQ exacta. Usa sentido común sin inventar datos médicos específicos.";

  const prompt = `
Eres un asistente amable y claro. Respondes SOLO en español.

Este DEMO usa un medicamento FICTICIO llamado **DolexFem Forte**, creado únicamente para efectos de la demostración. No representa un medicamento real.

Ficha técnica FICTICIA para DEMO:
- Indicaciones: cólicos menstruales.
- Dosis usual: 1 tableta cada 8 horas, máximo 3 al día.
- Efectos secundarios comunes: somnolencia leve, calor abdominal, sabor metálico temporal.
- Advertencias: suspender si hay mareos intensos; no usar en embarazo (DEMO).
- Contraindicaciones ficticias: alergia a "Femotrix" o úlcera gástrica activa.

Contexto adicional del DEMO:
${context}

Instrucciones:
- Responde usando ESTA información ficticia como referencia.
- Puedes detallar dosis, efectos y advertencias, siempre aclarando que es información ficticia.
- No digas “pregunta a un médico”, excepto si la pregunta es peligrosa o muy específica.
- Mantén tono natural y útil para un usuario que busca orientación.
- No inventes datos fuera de lo ficticio definido arriba.
- No uses lenguaje técnico innecesario.

Pregunta del usuario:
"${userQuestion}"
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: "Eres un asistente experto en medicamentos, claro, empático y prudente.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 300,
  });

  return (
    completion.choices[0]?.message?.content ??
    "Lo siento, hubo un problema al generar la respuesta."
  );
}

// 5. Configurar Express
const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde la carpeta "public"
app.use(express.static("public"));

// 6. Endpoint de chat para la página web
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res
        .status(400)
        .json({ error: 'Falta el campo "message" en el body.' });
    }

    const bestFAQ = findBestFAQ(message);
    const reply = await generateAnswer(message, bestFAQ);

    res.json({ reply });
  } catch (err) {
    console.error("Error en /api/chat:", err);
    res
      .status(500)
      .json({ error: "Error al generar la respuesta del chatbot." });
  }
});

// 7. Levantar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor de chatbot escuchando en http://localhost:${PORT}`);
});
