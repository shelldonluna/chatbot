// bot.js
import fs from 'fs';
import readline from 'readline';

// 1. Cargar las FAQs desde el archivo JSON
const faqsRaw = fs.readFileSync('./faqs.json', 'utf8');
const faqs = JSON.parse(faqsRaw);

// 2. Función muy sencilla para medir similitud (por ahora: cuántas palabras coinciden)
function scoreSimilarity(userQuestion, faqQuestion) {
  const userWords = userQuestion.toLowerCase().split(/\s+/);
  const faqWords = faqQuestion.toLowerCase().split(/\s+/);

  let score = 0;
  for (const uw of userWords) {
    if (faqWords.includes(uw)) {
      score++;
    }
  }

  return score;
}

// 3. Buscar la FAQ más parecida
function findBestMatch(userQuestion) {
  let best = null;
  let bestScore = -1;

  for (const faq of faqs) {
    const s = scoreSimilarity(userQuestion, faq.question);
    if (s > bestScore) {
      bestScore = s;
      best = faq;
    }
  }

  return { best, bestScore };
}

// 4. Interfaz de línea de comandos para probar
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('Chatbot FAQ (medicamento para cólicos menstruales)');
console.log('Escribe tu pregunta (o "salir" para terminar):');

rl.on('line', (input) => {
  const question = input.trim();
  if (question.toLowerCase() === 'salir') {
    rl.close();
    return;
  }

  const { best, bestScore } = findBestMatch(question);

  if (!best || bestScore === 0) {
    console.log('🤖 No encontré una respuesta exacta en las preguntas frecuentes.');
    console.log('Te recomiendo consultar a un profesional de la salud para una orientación personalizada.\n');
  } else {
    console.log(`🤖 Quizá te refieres a: "${best.question}"`);
    console.log(`Respuesta: ${best.answer}\n`);
  }

  console.log('Puedes hacer otra pregunta o escribir "salir" para terminar:');
});
