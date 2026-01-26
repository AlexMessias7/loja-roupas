document.addEventListener('DOMContentLoaded', function () {
    // Recupera o carrinho do localStorage ou inicializa um vazio
    let carrinho = [];
    try {
        carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];
    } catch (error) {
        console.error('Erro ao carregar o carrinho do localStorage:', error);
        carrinho = [];
    }

    const adicionarCarrinhoBtns = document.querySelectorAll('.adicionar-carrinho-btn'); // Botões de adicionar ao carrinho
    const comprarBtns = document.querySelectorAll('.comprar-btn'); // Botões de comprar agora
    const cartIcon = document.querySelector('.fa-shopping-cart'); // Ícone do carrinho
    const cartCount = document.querySelector('.cart-count'); // Elemento do contador do carrinho
    const sizeButtons = document.querySelectorAll('.size-button'); // Botões de tamanho dinâmico

    // Atualiza o contador de itens no carrinho
    function atualizarContador() {
        if (cartCount) {
            try {
                const totalItens = carrinho.reduce((acc, item) => acc + (item.quantity || 1), 0);
                cartCount.textContent = totalItens;
            } catch (error) {
                console.error('Erro ao calcular o total de itens do carrinho:', error);
                cartCount.textContent = 0;
            }
        }
    }

    // Exibe um alerta no frontend
    function mostrarAlerta(mensagem, tipo = 'success') {
        const alerta = document.createElement('div');
        alerta.className = `alerta alerta-${tipo}`;
        alerta.textContent = mensagem;
        document.body.appendChild(alerta);

        setTimeout(() => {
            alerta.remove();
        }, 3000);
    }

    // Sincroniza o carrinho com o backend e localStorage
    async function adicionarAoCarrinho(produto) {
        console.log('Adicionando produto ao carrinho:', produto);

        try {
            const response = await fetch('/adicionar-carrinho', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(produto),
            });

            if (!response.ok) {
                throw new Error('Erro ao adicionar ao carrinho');
            }

            const data = await response.json();
            console.log('Resposta do backend:', data);

            const existente = carrinho.find(item => item.id === produto.id && item.size === produto.size);
            if (existente) {
                existente.quantity += 1;
            } else {
                carrinho.push({ ...produto, quantity: 1 });
            }

            localStorage.setItem('carrinho', JSON.stringify(carrinho));
            atualizarContador();
            mostrarAlerta('Produto adicionado ao carrinho!', 'success');
        } catch (error) {
            console.error('Erro ao adicionar ao carrinho:', error);
            mostrarAlerta('Erro ao adicionar produto ao carrinho.', 'error');
        }
    }

    // Remove produto do carrinho
    function removerProduto(produtoId, tamanho) {
        carrinho = carrinho.filter(item => !(item.id === produtoId && item.size === tamanho));
        localStorage.setItem('carrinho', JSON.stringify(carrinho));
        atualizarContador();
    }

    // Função auxiliar para montar objeto produto
    function montarProduto(button) {
        const productId = button.getAttribute('data-product-id');
        const productName = button.getAttribute('data-product-name');
        const productPrice = parseFloat(button.getAttribute('data-product-price'));
        const productImage = button.getAttribute('data-product-image');
        const selectedSize = document.querySelector('input[name="size"]:checked');

        if (!selectedSize) {
            mostrarAlerta('Por favor, selecione um tamanho antes de continuar.', 'error');
            return null;
        }

        return {
            id: productId,
            name: productName,
            price: productPrice,
            image: productImage,
            size: selectedSize.value,
            quantity: 1,
        };
    }

    // Adicionar ao carrinho
    adicionarCarrinhoBtns.forEach((button) => {
        button.addEventListener('click', async function () {
            const produto = montarProduto(this);
            if (!produto) return;

            try {
                await adicionarAoCarrinho(produto);
                // limpa seleção
                const selectedSize = document.querySelector('input[name="size"]:checked');
                if (selectedSize) selectedSize.checked = false;
                sizeButtons.forEach(btn => btn.classList.remove('selected'));
            } catch (error) {
                mostrarAlerta('Erro ao adicionar produto ao carrinho.', 'error');
            }
        });
    });

    // Comprar agora (adiciona e redireciona)
    comprarBtns.forEach((button) => {
        button.addEventListener('click', async function () {
            const produto = montarProduto(this);
            if (!produto) return;

            try {
                await adicionarAoCarrinho(produto);
                window.location.href = '/carrinho'; // redireciona para carrinho
            } catch (error) {
                mostrarAlerta('Erro ao processar compra.', 'error');
            }
        });
    });

    // Adiciona evento de clique aos botões de tamanho
    sizeButtons.forEach(button => {
        button.addEventListener('click', function () {
            sizeButtons.forEach(btn => btn.classList.remove('selected'));
            this.classList.add('selected');
        });
    });

    // Adiciona evento de clique ao ícone do carrinho
    if (cartIcon) {
        const cartParent = cartIcon.parentElement;
        const clone = cartParent.cloneNode(true);
        cartParent.replaceWith(clone);

        clone.addEventListener('click', function (event) {
            event.preventDefault();
            window.location.href = '/carrinho';
        });
    } else {
        console.warn('Elemento cartIcon não encontrado na página.');
    }

    // Atualiza o contador ao carregar a página
    atualizarContador();
});