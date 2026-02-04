const messagesDiv = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const statusEl = document.getElementById("status");
const chips = document.querySelectorAll(".chip");

// ✅ Mantiene contexto del producto detectado
let lastProduct = "";

// Lista de productos disponibles (DEMO)
const PRODUCT_NAMES = ["Ariadne", "Post Day", "Gynomunal", "Nitesom"];

function detectProductFromText(text) {
  const normalized = text.trim().toLowerCase();
  return (
    PRODUCT_NAMES.find((p) => p.toLowerCase() === normalized) || ""
  );
}

function addMessage(text, role) {
  const row = document.createElement("div");
  row.classList.add("message-row", role);

  const bubble = document.createElement("div");
  bubble.classList.add("message-bubble", role);
  bubble.innerHTML = text
  .replace(/\n/g, "<br>")
  .replace(/  (.+)/g, "<strong>$1</strong><br>");


  if (role === "bot") {
    const avatar = document.createElement("div");
    avatar.classList.add("avatar");
    avatar.textContent = "A"; // Asistente
    row.appendChild(avatar);
    row.appendChild(bubble);
  } else {
    const avatar = document.createElement("div");
    avatar.classList.add("avatar", "user");
    avatar.textContent = "T"; // Tú
    row.appendChild(bubble);
    row.appendChild(avatar);
  }

  messagesDiv.appendChild(row);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addTypingIndicator() {
  const row = document.createElement("div");
  row.classList.add("message-row", "bot");
  row.setAttribute("data-typing", "true");

  const avatar = document.createElement("div");
  avatar.classList.add("avatar");
  avatar.textContent = "A";

  const bubble = document.createElement("div");
  bubble.classList.add("message-bubble", "bot");

  const typing = document.createElement("div");
  typing.classList.add("typing");
  typing.innerHTML = `
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  `;

  bubble.appendChild(typing);
  row.appendChild(avatar);
  row.appendChild(bubble);

  messagesDiv.appendChild(row);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function removeTypingIndicator() {
  const typingRow = messagesDiv.querySelector('[data-typing="true"]');
  if (typingRow) typingRow.remove();
}

function setStatus(text) {
  statusEl.textContent = text || "";
}

// Mensaje inicial
addMessage(
  "Hola, soy el asistente virtual (demo) para resolver dudas sobre productos. Puedes escribir el nombre del producto (ej. “Ariadne”) o hacer tu pregunta directamente.",
  "bot"
);

async function sendMessage(text) {
  if (!text.trim()) return;

  // 🔁 CAMBIO CLAVE: si el usuario escribe el nombre de un producto, cambiamos contexto
  const typedProduct = detectProductFromText(text);
  if (typedProduct) {
    lastProduct = typedProduct;
  }

  addMessage(text, "user");
  input.value = "";
  input.focus();
  sendButton.disabled = true;

  setStatus(
    lastProduct
      ? `Producto activo: ${lastProduct} · El asistente está respondiendo...`
      : "El asistente está respondiendo..."
  );

  addTypingIndicator();

  try {
    const payload = { message: text };

    // ✅ SOLO enviamos product si existe (evita confusión en backend)
    if (lastProduct) {
      payload.product = lastProduct;
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    removeTypingIndicator();

    // ✅ Si el backend detectó producto, lo guardamos
    if (data.detected_product) {
      lastProduct = data.detected_product;
    }

    if (data.reply) {
      addMessage(data.reply, "bot");
      setStatus(lastProduct ? `Producto activo: ${lastProduct}` : "");
    } else {
      addMessage("Lo siento, hubo un problema al obtener la respuesta.", "bot");
      setStatus("Error al procesar la respuesta.");
    }
  } catch (err) {
    console.error(err);
    removeTypingIndicator();
    addMessage(
      "Lo siento, ocurrió un error de conexión con el servidor.",
      "bot"
    );
    setStatus("Error de conexión.");
  } finally {
    sendButton.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  sendMessage(text);
});

// Chips de preguntas rápidas
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const text = chip.getAttribute("data-text") || chip.textContent.trim();
    sendMessage(text);
  });
});
