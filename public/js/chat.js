const messagesDiv = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const statusEl = document.getElementById("status");
const chips = document.querySelectorAll(".chip");

function addMessage(text, role) {
  const row = document.createElement("div");
  row.classList.add("message-row", role);

  const bubble = document.createElement("div");
  bubble.classList.add("message-bubble", role);
  bubble.textContent = text;

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
  if (typingRow) {
    typingRow.remove();
  }
}

// Mensaje inicial
addMessage(
  "Hola, soy tu asistente virtual para resolver dudas sobre el medicamento para aliviar cólicos menstruales. ¿En qué te puedo ayudar?",
  "bot"
);

async function sendMessage(text) {
  if (!text.trim()) return;

  addMessage(text, "user");
  input.value = "";
  input.focus();
  sendButton.disabled = true;
  statusEl.textContent = "El asistente está respondiendo...";
  addTypingIndicator();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();
    removeTypingIndicator();

    if (data.reply) {
      addMessage(data.reply, "bot");
      statusEl.textContent = "";
    } else {
      addMessage(
        "Lo siento, hubo un problema al obtener la respuesta.",
        "bot"
      );
      statusEl.textContent = "Error al procesar la respuesta.";
    }
  } catch (err) {
    console.error(err);
    removeTypingIndicator();
    addMessage(
      "Lo siento, ocurrió un error de conexión con el servidor.",
      "bot"
    );
    statusEl.textContent = "Error de conexión.";
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
