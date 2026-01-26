document.addEventListener('DOMContentLoaded', () => {
    // Função para remover item do carrinho
    document.querySelectorAll('.remover-item').forEach(button => {
        button.addEventListener('click', function () {
            const productId = this.getAttribute('data-id');
            const sizeElement = this.closest('.item-carrinho')?.querySelector('p');
            const size = sizeElement ? sizeElement.innerText.split(':')[1]?.trim() : null;

            if (!productId || !size) {
                console.error('ID ou Tamanho não encontrado ao tentar remover o item.');
                return;
            }

            fetch('/remover-carrinho', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId, size })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'Produto removido do carrinho!') {
                        const itemElement = this.closest('.item-carrinho');
                        if (itemElement) itemElement.remove();
                        atualizarResumo();

                        const itensCarrinho = document.querySelectorAll('.item-carrinho');
                        if (itensCarrinho.length === 0) {
                            verificarCarrinhoVazio();
                        }
                    }
                })
                .catch(err => console.error('Erro ao remover item do carrinho:', err));
        });
    });

    // Função para verificar carrinho vazio
    function verificarCarrinhoVazio() {
        const carrinhoContainer = document.querySelector('.carrinho-resumo-container');
        const carrinhoVazioHTML = `
            <section class="carrinho-vazio">
                <i class="fa fa-shopping-cart icone-carrinho-vazio"></i>
                <h2>Seu carrinho está vazio 😕</h2>
                <p>Que tal explorar nossos produtos incríveis?</p>
                <a href="/produtos" class="btn explorar-produtos">Explorar Produtos</a>
            </section>
        `;
        if (carrinhoContainer) {
            carrinhoContainer.innerHTML = carrinhoVazioHTML;
        }
    }

    // Função para atualizar quantidade
    document.querySelectorAll('.btn-quantidade').forEach(button => {
        button.addEventListener('click', function () {
            const action = this.getAttribute('data-action');
            const productId = this.getAttribute('data-id');
            const quantitySpan = document.querySelector(`#quantidade-${productId}`);
            const priceElement = document.querySelector(`[data-id='${productId}'][data-price]`);

            if (!priceElement || !quantitySpan) {
                console.error(`Elemento não encontrado para o produto com ID: ${productId}`);
                return;
            }

            let currentQuantity = parseInt(quantitySpan.innerText);
            if (action === 'increase') {
                currentQuantity++;
            } else if (action === 'decrease' && currentQuantity > 1) {
                currentQuantity--;
            }

            quantitySpan.innerText = currentQuantity;
            atualizarResumo();
        });
    });

    // Função para recalcular resumo
    function atualizarResumo() {
        const allItems = document.querySelectorAll('[data-price]');
        let subtotal = 0;

        allItems.forEach(item => {
            const quantityElement = document.querySelector(`#quantidade-${item.dataset.id}`);
            if (!quantityElement) return;
            const quantity = parseInt(quantityElement.innerText);
            const unitPrice = parseFloat(item.dataset.price);
            subtotal += unitPrice * quantity;
        });

        const frete = 10.00;
        let desconto = 0;

        const cupomInput = document.querySelector('#cupom');
        const cupomStatus = document.querySelector('#cupom-status');
        const economiaElement = document.querySelector('#economia');

        if (cupomInput && cupomInput.value.trim().toUpperCase() === "DESCONTO10") {
            desconto = subtotal * 0.10;
            if (cupomStatus) {
                cupomStatus.style.display = "block";
                cupomStatus.style.color = "green";
                cupomStatus.innerText = "Cupom aplicado: 10% de desconto!";
            }
            if (economiaElement) {
                economiaElement.style.display = "block";
                economiaElement.innerText = `Você economizou R$ ${desconto.toFixed(2)} com o cupom!`;
            }
        } else if (cupomInput && cupomInput.value.trim() !== "") {
            if (cupomStatus) {
                cupomStatus.style.display = "block";
                cupomStatus.style.color = "red";
                cupomStatus.innerText = "Cupom inválido ou expirado";
            }
            if (economiaElement) {
                economiaElement.style.display = "none";
            }
        } else {
            if (cupomStatus) cupomStatus.style.display = "none";
            if (economiaElement) economiaElement.style.display = "none";
        }

        const total = subtotal + frete - desconto;

        const subtotalElement = document.querySelector('#subtotal');
        const freteElement = document.querySelector('#frete');
        const totalElement = document.querySelector('#total');
        const resumoCompra = document.querySelector('.resumo-pedido');

        if (subtotalElement) subtotalElement.innerText = `Subtotal: R$ ${subtotal.toFixed(2)}`;
        if (freteElement) freteElement.innerText = `Frete: R$ ${frete.toFixed(2)}`;
        if (totalElement) totalElement.innerText = `Total: R$ ${total.toFixed(2)}`;

        if (resumoCompra) resumoCompra.style.display = allItems.length > 0 ? 'block' : 'none';
    }

    // 🚀 Finalizar compra via WhatsApp + salvar no backend
    function finalizarCompraWhatsApp() {
    fetch("/dados-cliente-logado")
        .then(res => {
        if (res.status === 401) {
            const modalLogin = document.getElementById("loginModal");
            if (modalLogin) modalLogin.style.display = "block";
            throw new Error("Cliente não logado");
        }
        return res.json();
        })
        .then(cliente => {
        const numeroVendedor = "5511916656500";
        const allItems = document.querySelectorAll('.item-carrinho');
        let mensagem = "🛒 *Resumo do Pedido - CREED GODS*\n\n";

        const ano = new Date().getFullYear();
        const numeroPedido = `CG-${ano}-${Math.floor(Math.random() * 10000)}`;
        mensagem += `📌 *Número do Pedido:* ${numeroPedido}\n`;
        mensagem += `👤 *Cliente:* ${cliente.nome}\n`;
        mensagem += `📍 *Endereço:* ${cliente.endereco || "Não informado"}\n\n📦 *Itens:*\n`;

        let subtotal = 0;

        allItems.forEach(item => {
            const nome = item.querySelector('h3')?.innerText || "";
            const tamanho = item.querySelector('p')?.innerText.split(':')[1]?.trim() || "";
            const quantidade = item.querySelector('.quantidade span')?.innerText || "1";
            const precoElement = item.querySelector('[data-price]');
            const precoUnitario = precoElement ? parseFloat(precoElement.dataset.price) : 0;

            const totalItem = precoUnitario * parseInt(quantidade);
            subtotal += totalItem;

            mensagem += `• ${nome}\n  Tamanho: ${tamanho}\n  Quantidade: ${quantidade}\n  Valor Unitário: R$ ${precoUnitario.toFixed(2)}\n  Total: R$ ${totalItem.toFixed(2)}\n\n`;
        });

        const frete = 10.00;
        let desconto = 0;
        const cupomInput = document.querySelector('#cupom');
        if (cupomInput && cupomInput.value.trim().toUpperCase() === "DESCONTO10") {
            desconto = subtotal * 0.10;
        }
        const total = subtotal + frete - desconto;

        const tipoPagamento = document.querySelector('#tipo-pagamento')?.value;
        if (!tipoPagamento) {
            alert("Por favor, selecione uma forma de pagamento antes de finalizar.");
            return;
        }

        mensagem += `📄 *Subtotal:* R$ ${subtotal.toFixed(2)}\n`;
        mensagem += `🚚 *Frete:* R$ ${frete.toFixed(2)}\n`;
        if (desconto > 0) mensagem += `🎁 *Desconto:* -R$ ${desconto.toFixed(2)}\n`;
        mensagem += `💰 *Total:* R$ ${total.toFixed(2)}\n`;
        mensagem += `💳 *Forma de Pagamento:* ${tipoPagamento}\n\n`;
        mensagem += `📲 Por favor, me confirme os dados para finalizar 🙏`;

        const url = `https://wa.me/${numeroVendedor}?text=${encodeURIComponent(mensagem)}`;
        window.open(url, "_blank");

        // salvar pedido no backend
        fetch('/finalizar-compra', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            orderNumber: numeroPedido,
            items: Array.from(allItems).map(item => ({
                produto: item.querySelector('.remover-item').dataset.id,
                quantidade: parseInt(item.querySelector('.quantidade span').innerText),
                precoUnitario: parseFloat(item.querySelector('[data-price]').dataset.price)
            })),
            total,
            pagamento: tipoPagamento
            })
        })
        .then(async res => {
            if (res.status === 401) {
            const modalLogin = document.getElementById("loginModal");
            if (modalLogin) modalLogin.style.display = "block";
            return;
            }
            const data = await res.json();
            if (data.success) {
            verificarCarrinhoVazio();
            window.location.href = `/pedido-confirmado?numero=${data.orderNumber}`;
            } else {
            console.error("Erro ao salvar pedido no sistema:", data.message);
            alert("Erro ao salvar pedido: " + data.message);
            }
        })
        .catch(err => console.error("Erro na requisição de salvar pedido:", err));
        })
        .catch(err => console.error("Erro ao buscar dados do cliente:", err));
    }

    // Inicializar resumo
    atualizarResumo();

    // Evento para botão de finalizar compra
    const finalizarBtn = document.querySelector('.finalizar-compra');
    if (finalizarBtn) {
        finalizarBtn.addEventListener('click', function (e) {
            e.preventDefault();
            finalizarCompraWhatsApp();
        });
    }

    // Evento para aplicar cupom
    const aplicarCupomBtn = document.querySelector('.aplicar-cupom');
    if (aplicarCupomBtn) {
        aplicarCupomBtn.addEventListener('click', atualizarResumo);
    }
});