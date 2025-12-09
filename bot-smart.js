import fs from 'fs';
import dotenv from 'dotenv';
import readline from 'readline';
import OpenAI from 'openai';

dotenv.config();

// 1. Inicializar cliente OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 2. Cargar FAQs
const faqs = JSON.parse(fs.readFileSync('./faqs.json', 'utf8'));

// 3. Función simple para encontrar la FAQ más parecida
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

// 4. Generar respuesta con OpenAI
async function generateAnswer(userQuestion, faq) {
  const context = faq
    ? `Pregunta frecuente encontrada: "${faq.question}"
       Respuesta sugerida: "${faq.answer}"`
    : "No se encontró una FAQ exacta. Usa sentido común sin inventar datos médicos específicos.";

  const prompt = `
Eres un asistente amable y claro. Respondes SOLO en español.
Tienes este contexto:

${context}

Ahora responde a la pregunta del usuario de forma natural, clara y útil.
No inventes efectos, dosis, ni afirmaciones médicas no incluidas en las FAQs.
Si no tienes datos exactos, da una sugerencia general y recomienda consultar a un profesional.

Pregunta del usuario:
"${userQuestion}"
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: "Eres un asistente experto en medicamentos, claro y seguro." },
      { role: "user", content: prompt }
    ]
  });

  return completion.choices[0].message.content;
}

// 5. Interfaz por consola
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("Chatbot Inteligente FAQ 💊");
console.log('Escribe tu pregunta (o "salir" para terminar):');

rl.on("line", async (input) => {
  const question = input.trim();
  if (question.toLowerCase() === "salir") {
    rl.close();
    return;
  }

  const bestFAQ = findBestFAQ(question);
  const answer = await generateAnswer(question, bestFAQ);

  console.log("\n🤖 Respuesta inteligente:");
  console.log(answer);
  console.log("\nHaz otra pregunta o usa 'salir' para terminar:");
});
