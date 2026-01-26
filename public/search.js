document.addEventListener('DOMContentLoaded', function() {
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    const cartIcon = document.getElementById('cartIcon'); 
    const feedback = document.getElementById('search-feedback'); 

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', function() {
            realizarPesquisa();
        });

        searchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                realizarPesquisa();
            }
        });

        function realizarPesquisa() {
            const query = searchInput.value.toLowerCase().trim();

            if (query) {
                // Remove estado de erro
                searchInput.classList.remove("input-error");
                if (feedback) feedback.style.display = "none";

                window.location.href = `/resultados?q=${encodeURIComponent(query)}`;
            } else {
                if (feedback) {
                    feedback.innerText = "Digite algo para pesquisar.";
                    feedback.style.display = "block";
                }
                searchInput.classList.add("input-error");
            }
        }
    } else {
        console.error('Elementos de pesquisa não encontrados.');
    }

    // Interatividade do carrinho
    if (cartIcon) {
        cartIcon.addEventListener('click', function() {
            window.location.href = '/carrinho';
        });
    }
});