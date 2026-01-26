document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('tabelaMedidasModal');
    const btn = document.querySelector('.btn-tabela-medidas'); // classe atualizada
    const span = document.querySelector('#tabelaMedidasModal .close'); // fecha dentro do modal

    // Abrir modal ao clicar no botão
    if (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault(); // evita que o link recarregue a página
            modal.style.display = 'block';
        });
    }

    // Fechar modal ao clicar no X
    if (span) {
        span.addEventListener('click', function () {
            modal.style.display = 'none';
        });
    }

    // Fechar modal ao clicar fora do conteúdo
    window.addEventListener('click', function (event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});