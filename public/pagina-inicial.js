// Exemplo de funcionalidade: Configurar eventos para busca
document.getElementById('search-input').addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    console.log(`Buscando por: ${query}`);
    // Você pode implementar aqui uma busca dinâmica nos produtos exibidos
});

// Exemplo de interação com botões de destaque
document.querySelectorAll('.produto-destaque').forEach((produto) => {
    produto.addEventListener('click', () => {
        const productId = produto.getAttribute('data-id');
        window.location.href = `/produto/${productId}`;
    });
});

    // Exemplo de animação ao passar o mouse nos produtos
document.querySelectorAll('.produto-card').forEach((card) => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'scale(1.05)';
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'scale(1)';
    });
});

document.querySelectorAll('.favorito-btn-imagem').forEach(btn => {
    btn.addEventListener('click', () => {
        const productId = btn.getAttribute('data-id');
        btn.classList.toggle('favoritado');
        // Aqui você pode enviar para o backend via fetch/AJAX
        console.log("Produto favoritado:", productId);
    });
});

document.addEventListener("DOMContentLoaded", () => {
  // Carrossel de Destaques
  const carrosselDestaques = document.querySelector(".destaques .carrossel");
  const esquerdaDestaques = document.querySelector(".destaques .seta.esquerda");
  const direitaDestaques = document.querySelector(".destaques .seta.direita");

  direitaDestaques.addEventListener("click", () => {
    carrosselDestaques.scrollBy({ left: 320, behavior: "smooth" });
  });

  esquerdaDestaques.addEventListener("click", () => {
    carrosselDestaques.scrollBy({ left: -320, behavior: "smooth" });
  });

  setInterval(() => {
    carrosselDestaques.scrollBy({ left: 320, behavior: "smooth" });
  }, 4000);

  // Carrossel de Promoções
  const carrosselPromocoes = document.querySelector(".promocoes .carrossel");
  const esquerdaPromocoes = document.querySelector(".promocoes .seta.esquerda");
  const direitaPromocoes = document.querySelector(".promocoes .seta.direita");

  direitaPromocoes.addEventListener("click", () => {
    carrosselPromocoes.scrollBy({ left: 320, behavior: "smooth" });
  });

  esquerdaPromocoes.addEventListener("click", () => {
    carrosselPromocoes.scrollBy({ left: -320, behavior: "smooth" });
  });

  setInterval(() => {
    carrosselPromocoes.scrollBy({ left: 320, behavior: "smooth" });
  }, 4000);
});