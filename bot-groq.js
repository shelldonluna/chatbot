// bot-groq.js
import fs from 'fs';
import dotenv from 'dotenv';
import readline from 'readline';
import Groq from 'groq-sdk';

dotenv.config();

// 1. Inicializar cliente de Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// 2. Cargar FAQs
const faqs = JSON.parse(fs.readFileSync('./faqs.json', 'utf8'));

// 3. Función muy sencilla para encontrar la FAQ más parecida
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

// 4. Generar respuesta con LLaMA 3.1 70B a través de Groq
async function generateAnswer(userQuestion, faq) {
  const context = faq
    ? `Pregunta frecuente encontrada: "${faq.question}"
       Respuesta sugerida: "${faq.answer}"`
    : "No se encontró una FAQ exacta. Usa sentido común sin inventar datos médicos específicos.";

  const prompt = `
Eres un asistente amable y claro. Respondes SOLO en español.
Estás ayudando a responder preguntas sobre un medicamento para aliviar cólicos menstruales.

Contexto disponible:
${context}

Instrucciones importantes:
- Responde de forma natural, breve y fácil de entender.
- No inventes efectos, dosis, ni afirmaciones médicas no incluidas en el contexto.
- Si no tienes datos exactos, da una sugerencia general y recomienda consultar a un profesional de la salud.

Pregunta del usuario:
"${userQuestion}"
`;

const completion = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    { role: "system", content: "Eres un asistente experto en medicamentos, claro, empático y prudente." },
    { role: "user", content: prompt }
  ],
  temperature: 0.4,
  max_tokens: 300,
});


  return completion.choices[0]?.message?.content ?? "Lo siento, hubo un problema al generar la respuesta.";
}

// 5. Interfaz por consola
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("Chatbot Inteligente FAQ 💊 (GROQ + LLaMA 3.1 70B)");
console.log('Escribe tu pregunta (o "salir" para terminar):');

rl.on("line", async (input) => {
  const question = input.trim();
  if (question.toLowerCase() === "salir") {
    rl.close();
    return;
  }

  try {
    const bestFAQ = findBestFAQ(question);
    const answer = await generateAnswer(question, bestFAQ);

    console.log("\n🤖 Respuesta inteligente:");
    console.log(answer);
  } catch (err) {
    console.error("Error al generar respuesta:", err.message || err);
    console.log("Lo siento, hubo un problema al procesar tu pregunta.\n");
  }

  console.log("\nHaz otra pregunta o usa 'salir' para terminar:");
});
