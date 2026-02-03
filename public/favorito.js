// Função principal para inicializar os botões de favoritos
function inicializarFavoritos() {
  const botoesFavorito = document.querySelectorAll(".favorito-btn-imagem");

  botoesFavorito.forEach(btn => {
    const productId = btn.getAttribute("data-id");

    // Verifica no backend se já está favoritado
    isFavorited(productId).then(favoritado => {
      if (favoritado) {
        btn.classList.add("favoritado");
      } else {
        btn.classList.remove("favoritado");
      }
    });

    // Usamos onclick para evitar múltiplos listeners duplicados
    btn.onclick = () => {
      isFavorited(productId).then(favoritado => {
        if (favoritado) {
          removeFavorite(productId).then(() => {
            btn.classList.remove("favoritado");
            showAlert("Produto removido dos favoritos!", "error");
          });
        } else {
          addFavorite(productId).then(() => {
            btn.classList.add("favoritado");
            showAlert("Produto adicionado aos favoritos!");
          });
        }
      });
    };
  });
}

// Executa automaticamente nas páginas normais
document.addEventListener("DOMContentLoaded", inicializarFavoritos);

// Também expõe a função para ser chamada manualmente em páginas dinâmicas (como favoritos.ejs)
window.inicializarFavoritos = inicializarFavoritos;

// Funções auxiliares com backend
function isFavorited(id) {
  return fetch(`/api/favoritos/check/${id}`, {
    credentials: "include" // mantém envio de cookies da sessão
  })
    .then(res => res.json())
    .then(data => data.favoritado)
    .catch(() => false);
}

function addFavorite(id) {
  return fetch(`/api/favoritos/add`, {
    method: "POST",
    credentials: "include", // garante que a sessão seja enviada
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId: id })
  }).then(res => res.json());
}

function removeFavorite(id) {
  return fetch(`/api/favoritos/remove`, {
    method: "POST",
    credentials: "include", // garante que a sessão seja enviada
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId: id })
  }).then(res => res.json());
}

// Feedback visual
function showAlert(msg, type = "success") {
  const alerta = document.createElement("div");
  alerta.className = "alerta " + (type === "error" ? "alerta-error" : "");
  alerta.textContent = msg;
  document.body.appendChild(alerta);

  setTimeout(() => alerta.remove(), 3000);
}