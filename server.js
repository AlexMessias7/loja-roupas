//git add .
//git commit -m "ajustes de responsividade no CSS"
//git push origin main

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const methodOverride = require('method-override');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');
const bcrypt = require('bcrypt');
const crypto = require("crypto");
const nodemailer = require('nodemailer');
const helmet = require('helmet');

const app = express();

// ---- Conexão ao MongoDB ----
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Conectado ao MongoDB Atlas"))
.catch(err => console.error("❌ Erro de conexão:", err));

// ---- Configuração de Middleware ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
app.use((err, req, res, next) => {
  console.error('Erro global:', err.message);
  console.error('Stack:', err.stack);
  res.status(500).send('Erro interno: ' + err.message);
});

// ---- Configuração da Política de Segurança (CSP) ----
// Resolve bloqueios de recursos externos no navegador
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        'https://fonts.googleapis.com',
        'https://cdnjs.cloudflare.com',
        "'unsafe-inline'"
      ],
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdnjs.cloudflare.com'
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdnjs.cloudflare.com'
      ],
      imgSrc: [
        "'self'",
        'data:',
        'https://res.cloudinary.com'
      ]
    }
  }
}));

// ---- Configuração de Sessões ----
// Sessão precisa ser configurada antes de qualquer uso de `req.session`
app.use(session({
  secret: "segredo_unico_global", // use um único segredo forte
  resave: false,
  saveUninitialized: false, // melhor não salvar sessões vazias
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
  }),
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // true em produção com HTTPS
    maxAge: 1000 * 60 * 60 * 24 // 1 dia
  }
}));

// ---- Middleware para Inicializar o Carrinho ----
// Certifique-se de que o carrinho está inicializado antes de cada requisição
app.use((req, res, next) => {
    if (!req.session) {
        console.error('A sessão não foi inicializada corretamente.');
        return next(new Error('Sessão não disponível. Verifique a configuração.'));
    }

    if (!req.session.cart) {
        req.session.cart = { items: [], subtotal: 0, shipping: 0, total: 0 };
    }

    console.log('Sessão do Carrinho:', req.session.cart); // Log para depuração
    next();
});

// ---- Logs Adicionais para Depuração ----
app.use((req, res, next) => {
    console.log('Sessão Atual:', req.session);
    next();
});

app.use((req, res, next) => {
  res.locals.clienteLogado = !!req.session.clienteId;
  next();
});

const favoritoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Cliente", required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }
});

const Favorito = mongoose.model("Favorito", favoritoSchema);

// Rota para salvar informações dos clientes
const clienteSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true }, // será armazenada com hash
  telefone: String,
  endereco: String,
  criadoEm: { type: Date, default: Date.now }
});

// ---- Esquema do Carrinho ----
const cartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    items: [{ id: String, name: String, price: Number, image: String, size: String }],
    subtotal: Number,
    shipping: Number,
    total: Number,
});

const Cart = mongoose.model('Cart', cartSchema);

// ---- Configuração do Multer + Cloudinary ----
const cloudinary = require('cloudinary').v2;

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer salva temporário em /uploads
const upload = multer({ dest: 'uploads/' });

// modelo de pedido
const pedidoSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true }, // número do pedido
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: "Cliente", required: true },
  items: [
    {
      produto: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // ref deve bater com o nome do modelo de Produto
      quantidade: Number,
      precoUnitario: Number
    }
  ],
  total: Number,
  status: {
    type: String,
    enum: ['Aguardando pagamento', 'Finalizado', 'Cancelado', 'Estornado'],
    default: 'Aguardando pagamento'
  },
  data: { type: Date, default: Date.now }
});

const Pedido = mongoose.model('Pedido', pedidoSchema);

// ---- Esquema do Produto ---
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  originalPrice: { type: Number, required: true },
  discountedPrice: { type: Number, default: 0 },
  description: { type: String, default: '' },

  // Imagem principal (URL do Cloudinary)
  image: { type: String, default: null },

  // Categoria opcional
  category: { type: String, default: '' },

  // Estoque
  stock: { type: Number, default: 0 }, // estoque atual
  stockMax: { type: Number, required: true }, // capacidade máxima
  stockMin: { type: Number, required: true }, // mínimo aceitável

  // Parcelamento
  maxInstallments: { type: Number, required: true },
  installmentValue: { type: Number, default: 0 },

  // Gênero
  gender: { type: String, enum: ['Masculino', 'Feminino', 'Unissex'], required: true },

  // Flags
  isFeatured: { type: Boolean, default: false },
  isOnSale: { type: Boolean, default: false },

  // Tamanhos
  sizes: {
    type: [String],
    enum: ['P', 'M', 'G', 'GG'],
    default: [],
  },

  // Imagens adicionais (URLs do Cloudinary)
  extraImages: { type: [String], default: [] },

  // Campos de avaliação
  comments: [
    {
      user: { type: String },
      text: { type: String },
      rating: { type: Number },
    },
  ],
  ratingAverage: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  recommendationPercentage: { type: Number, default: 0 },

  // Campo calculado de desconto (opcional)
  discountPercentage: { type: Number, default: 0 },
});

const Product = mongoose.model('Product', productSchema);

// ---- Esquema de Entrada ----
const entradaSchema = new mongoose.Schema({
  codigo: { type: String }, // ex: ENTRADA-20260120-001
  pedidoNumero: { type: String },
  data: { type: Date, default: Date.now },
  itens: [
    {
      produto: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantidade: { type: Number },
      preco: { type: Number },
      desconto: { type: Number },
      total: { type: Number },
    },
  ],
});

const Entrada = mongoose.model('Entrada', entradaSchema);

module.exports = { Product, Entrada, upload};

// rota de cadastro
app.post('/cadastro', async (req, res) => {
  try {
    const { nome, email, senha, telefone, endereco } = req.body;

    // verifica se já existe
    const existente = await Cliente.findOne({ email });
    if (existente) {
      return res.render('cadastro-cliente', { mensagem: "E-mail já cadastrado. Tente outro." });
    }

    // gera hash da senha
    const hash = await bcrypt.hash(senha, 10);

    const cliente = new Cliente({
      nome,
      email,
      senha: hash,
      telefone,
      endereco
    });

    await cliente.save();

    // Renderiza a página de cadastro com mensagem de sucesso
    res.render('cadastro-cliente', { mensagem: "Cadastro realizado com sucesso!" });

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao cadastrar cliente");
  }
});

app.get('/area-cliente', async (req, res) => {
  if (!req.session.clienteId) {
    return res.redirect('/login-cliente');
  }

  const cliente = await Cliente.findById(req.session.clienteId);
  res.render('area-cliente', { cliente });
});

app.get('/logout-cliente', (req, res) => {
  // destrói apenas a sessão do cliente
  req.session.clienteId = null;
  req.session.destroy(err => {
    if (err) {
      console.error("Erro ao encerrar sessão do cliente:", err);
    }
    res.redirect('/login-cliente'); // volta para a tela de login do cliente
  });
});

// rota GET para exibir página de login do cliente
app.get('/login-cliente', (req, res) => {
  res.render('login-cliente'); // renderiza login-cliente.ejs
});

// rota POST para autenticar cliente
app.post('/login-cliente', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const cliente = await Cliente.findOne({ email });

    if (!cliente) {
      return res.status(400).send("Cliente não encontrado");
    }

    const senhaValida = await bcrypt.compare(senha, cliente.senha);
    if (!senhaValida) {
      return res.status(400).send("Senha incorreta");
    }

    // cria sessão exclusiva para cliente
    req.session.clienteId = cliente._id;
    res.redirect('/area-cliente');
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao fazer login do cliente");
  }
});

// GET para mostrar a página
app.get("/esqueceu-senha", (req, res) => {
  res.render("esqueceu-senha"); // esse é o seu EJS
});

app.post("/esqueceu-senha", async (req, res) => {
  const { email } = req.body;
  const cliente = await Cliente.findOne({ email });
  if (!cliente) {
    return res.send("Email não encontrado");
  }

  // guarda o cliente na sessão
  req.session.resetClienteId = cliente._id;
  res.redirect("/redefinir-senha");
});

// Página para redefinir senha
app.get("/redefinir-senha", (req, res) => {
  if (!req.session.resetClienteId) {
    return res.redirect("/esqueceu-senha");
  }
  res.render("redefinir-senha"); // sem token
});

app.post("/redefinir-senha", async (req, res) => {
  const { novaSenha, confirmarSenha } = req.body;
  if (novaSenha !== confirmarSenha) {
    return res.send("As senhas não conferem");
  }

  const cliente = await Cliente.findById(req.session.resetClienteId);
  if (!cliente) return res.send("Cliente não encontrado");

  const bcrypt = require("bcrypt");
  const salt = bcrypt.genSaltSync(10);
  cliente.senha = bcrypt.hashSync(novaSenha, salt);

  await cliente.save();

  req.session.resetClienteId = null; // limpa sessão

  res.redirect("/login-cliente?msg=senhaRedefinida");
});

app.get("/cadastro", (req, res) => {
  res.render("cadastro-cliente", { mensagem: null });
});

// GET: mostra o formulário de edição
app.get("/editar-cadastro", async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.session.clienteId);
    if (!cliente) return res.redirect("/login-cliente");

    res.render("editar-cadastro", { cliente });
  } catch (err) {
    console.error("Erro ao carregar edição:", err);
    res.status(500).send("Erro ao carregar edição de cadastro");
  }
});

// POST: salva alterações
app.post("/editar-cadastro", async (req, res) => {
  try {
    const { nome, telefone, endereco } = req.body;
    const cliente = await Cliente.findById(req.session.clienteId);
    if (!cliente) return res.redirect("/login-cliente");

    cliente.nome = nome;
    cliente.telefone = telefone;
    cliente.endereco = endereco;
    await cliente.save();

    res.redirect("/area-cliente");
  } catch (err) {
    console.error("Erro ao editar cadastro:", err);
    res.status(500).send("Erro ao editar cadastro");
  }
});

// rota GET para listar pedidos do cliente logado
app.get("/meus-pedidos", async (req, res) => {
  if (!req.session.clienteId) {
    return res.redirect("/login-cliente");
  }

  try {
    const pedidos = await Pedido.find({ cliente: req.session.clienteId }).populate("items.produto");
    res.render("meus-pedidos", { pedidos });
  } catch (err) {
    console.error("Erro ao buscar pedidos:", err);
    res.status(500).send("Erro interno ao carregar pedidos");
  }
});

// Página de login
app.get('/login', (req, res) => {
  res.render('login'); // Certifique-se de que o arquivo login.ejs existe
});

// Rota de login
app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  // Login único (vendedor fixo)
  const vendedorEmail = "Adolfo@creedgods.com";
  const vendedorSenhaHash = "$2b$10$9klPRy4VQ0.38fH61.m1jOej0nbqC8L2GbF9/TCAV03fef09gbL0a"; // senha criptografada

  if (email === vendedorEmail && await bcrypt.compare(password, vendedorSenhaHash)) {
    // Marca como autenticado
    req.session.autenticado = true;
    res.redirect('/inicio');
  } else {
    res.send('Login inválido');
  }
});

// Rota de início (boas-vindas)
app.get('/inicio', (req, res) => {
  // Verifica se está autenticado
  if (!req.session.autenticado) {
    return res.redirect('/login');
  }
  res.render('inicio'); // Certifique-se que existe o arquivo inicio.ejs
});

// Rota de logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.send('Erro ao encerrar sessão');
    }
    res.redirect('/login'); // volta para a página de login
  });
});

app.post('/admin/pedidos/:id/cancelar', async (req, res) => {
  try {
    await Pedido.findByIdAndUpdate(req.params.id, { status: "Cancelado" });
    res.redirect('/admin/pedidos');
  } catch (err) {
    console.error("Erro ao cancelar pedido:", err);
    res.status(500).send("Erro ao cancelar pedido");
  }
});

app.get("/dados-cliente-logado", async (req, res) => {
  if (!req.session.clienteId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const cliente = await Cliente.findById(req.session.clienteId);
    if (!cliente) return res.status(404).json({ error: "Cliente não encontrado" });

    res.json({
      nome: cliente.nome,
      telefone: cliente.telefone,
      email: cliente.email,
      endereco: cliente.endereco // certifique-se que esse campo existe no schema
    });
  } catch (err) {
    console.error("Erro ao buscar cliente:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Listar pedidos
app.get('/admin/pedidos', async (req, res) => {
  if (!req.session.autenticado) {
    return res.redirect('/login');
  }

  try {
    const pedidos = await Pedido
      .find()
      .populate('cliente')
      .populate('items.produto');

    res.render('pedidos', { pedidos });
  } catch (err) {
    console.error("Erro ao carregar pedidos:", err);
    res.status(500).send("Erro interno ao carregar pedidos");
  }
});

// Finalizar pedido
app.post('/admin/pedidos/:id/finalizar', async (req, res) => {
  const pedido = await Pedido.findById(req.params.id).populate('items.produto');
  if (!pedido) return res.send('Pedido não encontrado');

  // Atualiza estoque
  for (const item of pedido.items) {
  item.produto.stock -= item.quantidade;
  await item.produto.save();
}

  pedido.status = 'Finalizado';
  await pedido.save();

  res.redirect('/admin/pedidos');
});

// Página de entrada de produtos (filtro inicial)
app.get('/admin/entrada', (req, res) => {
  if (!req.session.autenticado) {
    return res.redirect('/login');
  }
  res.render('admin-filtro'); // abre a tela de filtro
});

// Página de inclusão de produtos
app.get('/admin/entrada/incluir', async (req, res) => {
  if (!req.session.autenticado) {
    return res.redirect('/login');
  }
  const products = await Product.find();
  res.render('admin-entrada', { products }); // abre a tela de inclusão
});

// Processar entrada de estoque
app.post('/admin/entrada', async (req, res) => {
  const { pedidoNumero, itens } = req.body; // itens vem como array

  try {
    // gera código único da entrada
    const codigo = "ENTRADA-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + Math.floor(Math.random()*1000);

    // atualiza estoque de cada produto
    for (const item of itens) {
      const produto = await Product.findById(item.productId);
      if (produto) {
        produto.stock += parseInt(item.quantidade);
        await produto.save();
      }
    }

    // mapeia itens para o formato do schema
    const itensFormatados = itens.map(i => ({
      produto: i.productId, // ObjectId do Product
      quantidade: parseInt(i.quantidade),
      preco: Number(i.preco),
      desconto: Number(i.desconto),
      total: Number(i.total)
    }));

    // salva registro da entrada
    const entrada = new Entrada({
      codigo,
      pedidoNumero,
      itens: itensFormatados
    });
    await entrada.save();

    res.redirect('/admin/entrada');
  } catch (err) {
    console.error("Erro ao dar entrada:", err);
    res.status(500).send("Erro ao dar entrada no produto");
  }
});

// Página de relatórios com filtro
app.get('/admin/relatorios', async (req, res) => {
  if (!req.session.autenticado) {
    return res.redirect('/login');
  }

  let { inicio, fim } = req.query;
  let filtro = { status: 'Finalizado' };

  if (inicio && fim) {
    filtro.data = { $gte: new Date(inicio), $lte: new Date(fim) };
  }

  const pedidos = await Pedido.find(filtro).populate('items.produto');

  let totalVendido = 0;
  let totalItens = 0;
  pedidos.forEach(p => {
    totalVendido += p.total;
    p.items.forEach(i => totalItens += i.quantidade);
  });

  res.render('admin-relatorios', { pedidos, totalVendido, totalItens, inicio, fim });
});

const XLSX = require('xlsx');

app.get('/admin/relatorios/exportar', async (req, res) => {
  let { inicio, fim } = req.query;
  let filtro = { status: 'Finalizado' };

  if (inicio && fim) {
    filtro.data = { $gte: new Date(inicio), $lte: new Date(fim) };
  }

  const pedidos = await Pedido.find(filtro).populate('items.produto');

  // monta dados para Excel
  const dados = pedidos.map(p => ({
    Numero: p.orderNumber,
    Data: p.data.toLocaleDateString(),
    Total: p.total,
    Itens: p.items.map(i => `${i.produto.name} (Qtd: ${i.quantidade})`).join(', ')
  }));

  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="relatorio.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// ---- Rotas do Carrinho ----
// Adicionar ao carrinho
app.post('/adicionar-carrinho', (req, res) => {
    const { id, name, price, image, size } = req.body;

    // Validação do preço
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice)) {
        return res.status(400).json({ message: 'Preço inválido.' });
    }

    // Inicializa o carrinho na sessão, se necessário
    if (!req.session.cart) {
        req.session.cart = { items: [], subtotal: 0 };
    }

    // Verifica se o item já existe no carrinho
    const itemExists = req.session.cart.items.some(item => item.id === id && item.size === size);

    if (!itemExists) {
        req.session.cart.items.push({ id, name, price: numericPrice, image, size });
        req.session.cart.subtotal += numericPrice;

        console.log('Carrinho Atualizado:', req.session.cart); // Log para monitorar o carrinho
    }

    res.json({ message: 'Produto adicionado ao carrinho!', cart: req.session.cart });
});

// Remover do carrinho
app.post('/remover-carrinho', (req, res) => {
    const { id, size } = req.body;

    if (req.session.cart) {
        req.session.cart.items = req.session.cart.items.filter(
            item => !(item.id === id && item.size === size)
        );
        req.session.cart.subtotal = req.session.cart.items.reduce((sum, item) => sum + item.price, 0);

        console.log('Carrinho após remoção:', req.session.cart); // Log para depuração

        res.json({ message: 'Produto removido do carrinho!', cart: req.session.cart });
    } else {
        res.status(400).json({ message: 'Carrinho não encontrado.' });
    }
});

// Página do carrinho
app.get('/carrinho', async (req, res) => {
    const cart = req.session.cart || { items: [], subtotal: 0, shipping: 0, total: 0 };

    // Calcula o frete
    cart.shipping = cart.items.length > 0 ? 15 : 0; // Frete fixo de exemplo
    cart.total = cart.subtotal + cart.shipping;

    console.log('Estado do Carrinho:', cart); // Log para verificar o carrinho

    try {
        const saleProducts = await Product.find({ isOnSale: true });

        res.render('carrinho', { cart, saleProducts });
    } catch (err) {
        console.error('Erro ao carregar produtos em promoção:', err);
        res.status(500).send('Erro ao carregar a página do carrinho.');
    }
});

app.post('/atualizar-quantidade', (req, res) => {
    const { id, quantity } = req.body;

    // Validação de entrada
    if (!id || quantity === undefined) {
        return res.status(400).json({ message: 'ID ou quantidade não fornecidos.' });
    }

    if (!req.session.cart || !req.session.cart.items) {
        return res.status(400).json({ message: 'Carrinho não encontrado.' });
    }

    // Encontrar o produto no carrinho
    const item = req.session.cart.items.find(item => item.id === id);

    if (!item) {
        return res.status(404).json({ message: 'Produto não encontrado no carrinho.' });
    }

    // Atualizar quantidade e recalcular subtotal
    item.quantity = quantity;
    req.session.cart.subtotal = req.session.cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Atualizar total (subtotal + frete)
    req.session.cart.shipping = req.session.cart.items.length > 0 ? 15 : 0; // Frete fixo
    req.session.cart.total = req.session.cart.subtotal + req.session.cart.shipping;

    res.status(200).json({
        message: 'Quantidade atualizada com sucesso.',
        cart: req.session.cart
    });
});

module.exports = app;

// Finalizar compra (criar pedido)
app.post('/finalizar-compra', async (req, res) => {
  try {
    // Verifica se o cliente está logado
    if (!req.session.clienteId) {
      return res.status(401).json({ success: false, message: "É necessário fazer login para finalizar a compra" });
    }

    const cart = req.session.cart;
    const itemsBody = req.body.items || [];

    if ((!cart || cart.items.length === 0) && itemsBody.length === 0) {
      return res.json({ success: false, message: "Carrinho vazio" });
    }

    // Busca os dados do cliente logado
    const cliente = await Cliente.findById(req.session.clienteId);
    if (!cliente) {
      return res.status(400).json({ success: false, message: "Cliente não encontrado" });
    }

    const orderNumber = req.body.orderNumber || "PED-" + Date.now();
    const total = req.body.total || cart.total;

    // monta itens com validação
    const itemsRaw = itemsBody.length > 0 ? itemsBody : cart.items;
    const items = itemsRaw.map(i => {
      const produtoId = i.produto || i.id;
      if (!produtoId) throw new Error("Produto inválido no item do pedido");

      return {
        produto: produtoId,
        quantidade: i.quantidade || i.quantity || 1,
        precoUnitario: i.precoUnitario || i.price
      };
    });

    const pedido = new Pedido({
      orderNumber,
      cliente: req.session.clienteId, // salva o ID do cliente
      items,
      total,
      status: "Aguardando pagamento"
    });

    await pedido.save();

    // Limpa carrinho da sessão
    req.session.cart = { items: [], subtotal: 0, shipping: 0, total: 0 };

    res.json({ success: true, orderNumber });
  } catch (err) {
    console.error("Erro ao salvar pedido:", err);
    res.status(500).json({ success: false, message: "Erro ao salvar pedido" });
  }
});

app.post('/admin/pedidos/:id/estornar', async (req, res) => {
  try {
    await Pedido.findByIdAndUpdate(req.params.id, { status: "Estornado" });
    res.redirect('/admin/pedidos');
  } catch (err) {
    console.error("Erro ao estornar pedido:", err);
    res.status(500).send("Erro ao estornar pedido");
  }
});

// ---- Rotas do Produto ----
app.get('/produto/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product.sizes) {
            product.sizes = [];
        }
        res.render('product-details', { product });
    } catch (err) {
        console.error(err);
        res.send('Erro ao carregar produto');
    }
});

app.post('/produto/:id/comentar', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        const comment = {
            user: req.body.user,
            text: req.body.text,
            rating: req.body.rating
        };
        product.comments.push(comment);
        await product.save();
        res.redirect(`/produto/${req.params.id}`);
    } catch (err) {
        console.error(err);
        res.send('Erro ao adicionar comentário');
    }
});

// ---- Rotas de Administração ----
app.get('/admin', (req, res) => {
    res.render('admin');
});

app.get('/admin/produtos', async (req, res) => {
    try {
        const products = await Product.find();
        res.render('admin-products', { products });
    } catch (err) {
        console.error(err);
        res.send('Erro ao carregar a página de administração');
    }
});

// Criar novo produto
app.post('/admin/produtos', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'extraImages', maxCount: 3 }
]), async (req, res) => {
  try {
    console.log('--- INÍCIO DA CRIAÇÃO DO PRODUTO ---');
    console.log('Arquivos recebidos:', req.files);
    console.log('Dados recebidos:', req.body);
    console.log('Imagem principal recebida:', req.files?.image?.[0]);

    // --- Upload da imagem principal ---
    let imageUrl = null;
    if (req.files?.image?.[0]) {
      const file = req.files.image[0];
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'loja-roupas'
        });
        imageUrl = result.secure_url;
        console.log('Imagem principal enviada com sucesso:', imageUrl);
        fs.unlinkSync(file.path); // apaga temporário
      } catch (uploadErr) {
        console.error('Erro ao enviar imagem principal:', uploadErr.message);
        throw new Error('Falha no upload da imagem principal');
      }
    }

    // --- Upload das imagens extras ---
    let extraImagesUrls = [];
    if (Array.isArray(req.files?.extraImages)) {
      for (const file of req.files.extraImages) {
        console.log('Imagem extra recebida:', file);
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'loja-roupas'
          });
          extraImagesUrls.push(result.secure_url);
          console.log('Imagem extra enviada com sucesso:', result.secure_url);
          fs.unlinkSync(file.path); // apaga temporário
        } catch (uploadErr) {
          console.error('Erro ao enviar imagem extra:', uploadErr.message);
          throw new Error('Falha no upload de imagem extra');
        }
      }
    }

    // --- Preço original ---
    const originalPrice = parseFloat(req.body.originalPrice);
    if (isNaN(originalPrice)) {
      throw new Error('Preço original inválido');
    }

    // --- Preço com desconto ---
    const discountedPrice = req.body.discountedPrice
      ? parseFloat(req.body.discountedPrice)
      : originalPrice;

    // --- Parcelas ---
    const maxInstallments = parseInt(req.body.maxInstallments) || 1;
    const installmentValue = (discountedPrice / maxInstallments).toFixed(2);

    // --- Tamanhos ---
    const sizes = Array.isArray(req.body.sizes)
      ? req.body.sizes
      : req.body.sizes
        ? [req.body.sizes]
        : [];

    // --- Criar produto ---
    const product = new Product({
      name: req.body.name,
      originalPrice,
      discountedPrice,
      description: req.body.description || '',
      image: imageUrl,              // URL definitiva do Cloudinary
      extraImages: extraImagesUrls, // lista de URLs do Cloudinary
      category: req.body.category || '',
      stockMax: req.body.stockMax ? parseInt(req.body.stockMax) : 0,
      stockMin: req.body.stockMin ? parseInt(req.body.stockMin) : 0,
      isFeatured: !!req.body.isFeatured,
      isOnSale: !!req.body.isOnSale,
      maxInstallments,
      installmentValue,
      sizes,
      gender: req.body.gender,
      discountPercentage: ((originalPrice - discountedPrice) / originalPrice) * 100
    });

    // --- Validação de campos obrigatórios ---
    if (!product.name || !product.originalPrice || !product.gender) {
      throw new Error('Campos obrigatórios ausentes');
    }

    // --- Salvar no banco ---
    await product.save();

    console.log('--- PRODUTO CRIADO COM SUCESSO ---');
    res.redirect('/admin/produtos');
  } catch (err) {
    console.error('--- ERRO AO SALVAR PRODUTO ---');
    console.error('Mensagem:', err.message);
    console.error('Stack:', err.stack);
    console.error('Files:', req.files);
    console.error('Body:', req.body);
    res.status(500).send('Erro ao salvar produto: ' + (err.message || 'Erro desconhecido'));
  }
});

// Ajustar estoque manualmente
app.post('/admin/produtos/:id/ajustar-estoque', async (req, res) => {
  try {
    const { quantidade } = req.body; // valor positivo ou negativo
    const produto = await Product.findById(req.params.id);

    if (!produto) {
      return res.status(404).send('Produto não encontrado');
    }

    produto.stock += parseInt(quantidade); // pode somar ou subtrair
    await produto.save();

    res.redirect('/admin/produtos');
  } catch (err) {
    console.error('Erro ao ajustar estoque:', err);
    res.status(500).send('Erro ao ajustar estoque');
  }
});

// Buscar entradas por número e/ou intervalo de datas
app.post('/admin/entrada/buscar', async (req, res) => {
  try {
    const { pedidoNumero, inicio, fim } = req.body;

    const filtro = {};

    // filtro por número do pedido (entrada)
    if (pedidoNumero && pedidoNumero.trim() !== '') {
      filtro.pedidoNumero = { $regex: new RegExp(pedidoNumero.trim(), 'i') };
    }

    // filtro por intervalo de datas
    if (inicio || fim) {
      filtro.data = {};
      if (inicio) {
        // início do dia
        filtro.data.$gte = new Date(inicio + 'T00:00:00.000Z');
      }
      if (fim) {
        // fim do dia
        filtro.data.$lte = new Date(fim + 'T23:59:59.999Z');
      }
    }

    const entradas = await Entrada.find(filtro).sort({ data: -1 });

    // retorna no formato esperado pelo front
    const resposta = entradas.map(e => ({
      _id: e._id,
      pedidoNumero: e.pedidoNumero,
      codigo: e.codigo,
      data: e.data
    }));

    res.json(resposta);
  } catch (err) {
    console.error('Erro ao buscar entradas:', err);
    res.status(500).json([]);
  }
});

app.get('/admin/entrada/pedido/:id', async (req, res) => {
  if (!req.session.autenticado) {
    return res.redirect('/login');
  }
  try {
    const entrada = await Entrada.findById(req.params.id).populate('itens.produto');
    if (!entrada) {
      return res.status(404).send('Entrada não encontrada');
    }
    res.render('admin-entrada-detalhes', { entrada });
  } catch (err) {
    console.error('Erro ao carregar detalhes da entrada:', err);
    res.status(500).send('Erro ao carregar detalhes da entrada');
  }
});

app.get('/pedido-confirmado', (req, res) => {
  const numero = req.query.numero;
  res.render('pedido-confirmado', { numero });
});

const fs = require('fs'); // no topo do arquivo, se ainda não tiver

app.put('/admin/produtos/:id', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'extraImages', maxCount: 5 }
]), async (req, res) => {
  try {
    console.log('--- INÍCIO DA ATUALIZAÇÃO DO PRODUTO ---');
    console.log('ID do produto:', req.params.id);
    console.log('Dados recebidos:', req.body);
    console.log('Arquivos recebidos:', req.files);

    const product = await Product.findById(req.params.id);
    if (!product) {
      throw new Error('Produto não encontrado para atualização');
    }

    // --- Imagem principal ---
    let imageUrl = product.image;
    if (req.body.deleteMainImage === 'on') {
      imageUrl = null;
    } else if (req.files?.image?.[0]) {
      const file = req.files.image[0];
      console.log('Imagem principal recebida:', file);
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'loja-roupas'
        });
        imageUrl = result.secure_url;
        console.log('Imagem principal enviada com sucesso:', imageUrl);
        fs.unlinkSync(file.path); // apaga temporário
      } catch (uploadErr) {
        console.error('Erro ao enviar imagem principal:', uploadErr.message);
        throw new Error('Falha no upload da imagem principal');
      }
    }

    // --- Imagens extras ---
    let extraImagesUrls = product.extraImages || [];
    if (req.body.deleteExtraImages) {
      const toDelete = Array.isArray(req.body.deleteExtraImages)
        ? req.body.deleteExtraImages
        : [req.body.deleteExtraImages];
      extraImagesUrls = extraImagesUrls.filter(img => !toDelete.includes(img));
    }
    if (Array.isArray(req.files?.extraImages)) {
      for (const file of req.files.extraImages) {
        console.log('Imagem extra recebida:', file);
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'loja-roupas'
          });
          extraImagesUrls.push(result.secure_url);
          console.log('Imagem extra enviada com sucesso:', result.secure_url);
          fs.unlinkSync(file.path); // apaga temporário
        } catch (uploadErr) {
          console.error('Erro ao enviar imagem extra:', uploadErr.message);
          throw new Error('Falha no upload de imagem extra');
        }
      }
    }

    // --- Preço e parcelas ---
    const originalPrice = parseFloat(req.body.originalPrice);
    if (isNaN(originalPrice)) {
      throw new Error('Preço original inválido');
    }
    const discountedPrice = req.body.discountedPrice
      ? parseFloat(req.body.discountedPrice)
      : originalPrice;
    const maxInstallments = parseInt(req.body.maxInstallments) || 1;
    const installmentValue = (discountedPrice / maxInstallments).toFixed(2);

    // --- Tamanhos ---
    const sizes = Array.isArray(req.body.sizes)
      ? req.body.sizes
      : req.body.sizes
        ? [req.body.sizes]
        : [];

    // --- Atualizar produto ---
    product.name = req.body.name;
    product.originalPrice = originalPrice;
    product.discountedPrice = discountedPrice;
    product.description = req.body.description || '';
    product.category = req.body.category || '';
    product.stockMax = req.body.stockMax ? parseInt(req.body.stockMax) : 0;
    product.stockMin = req.body.stockMin ? parseInt(req.body.stockMin) : 0;
    product.isFeatured = !!req.body.isFeatured;
    product.isOnSale = !!req.body.isOnSale;
    product.maxInstallments = maxInstallments;
    product.installmentValue = installmentValue;
    product.sizes = sizes;
    product.gender = req.body.gender;
    product.image = imageUrl;
    product.extraImages = extraImagesUrls;

    await product.save();

    console.log('--- PRODUTO ATUALIZADO COM SUCESSO ---');
    res.redirect('/admin/produtos');
  } catch (err) {
    console.error('--- ERRO AO ATUALIZAR PRODUTO ---');
    console.error('Mensagem:', err.message);
    console.error('Stack:', err.stack);
    console.error('Files:', req.files);
    console.error('Body:', req.body);
    res.status(500).send('Erro ao atualizar produto: ' + (err.message || 'Erro desconhecido'));
  }
});

// Rota para abrir o formulário de edição
app.get('/admin/produtos/:id/editar', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).send('Produto não encontrado');
    }
    res.render('edit-product', { product });
  } catch (err) {
    console.error('Erro ao carregar produto para edição:', err.message, err.stack);
    res.status(500).send('Erro ao carregar produto: ' + err.message);
  }
});

// Redirecionamento para rota de edição
app.get('/admin/produtos/:id', (req, res) => {
  res.redirect(`/admin/produtos/${req.params.id}/editar`);
});

// Rota para excluir produto
app.delete('/admin/produtos/:id', async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).send('Produto não encontrado');
    }
    res.redirect('/admin/produtos');
  } catch (err) {
    console.error('Erro ao excluir produto:', err.message, err.stack);
    res.status(500).send('Erro ao excluir produto: ' + err.message);
  }
});

// Rota para a página inicial
app.get('/', async (req, res) => {
    try {
        const products = await Product.find({});
        
        const featuredProducts = products.filter(product => product.isFeatured) || [];
        const saleProducts = products.filter(product => product.isOnSale) || [];
        
        res.render('index', {
            featuredProducts,
            saleProducts,
            allProducts: products
        });
    } catch (err) {
        console.error('Erro ao buscar produtos para a página inicial:', err);
        res.status(500).send('Erro ao carregar a página inicial.');
    }
});

// Rota para exibir todos os produtos na aba de produtos
app.get('/produtos', async (req, res) => {
    try {
        const products = await Product.find({});
        res.render('produtos', { products });
    } catch (err) {
        console.error(err);
        res.send('Erro ao buscar produtos');
    }
});

app.get('/resultados', async (req, res) => {
    const query = req.query.q?.toLowerCase().trim();
    const ordenar = req.query.ordenar;

    try {
        let products = await Product.find({});
        let results = products.filter(product =>
            product.name.toLowerCase().includes(query)
        );

        // Ordenação
        if (ordenar === 'preco-asc') {
            results = results.sort((a, b) => (a.discountedPrice || a.price) - (b.discountedPrice || b.price));
        } else if (ordenar === 'preco-desc') {
            results = results.sort((a, b) => (b.discountedPrice || b.price) - (a.discountedPrice || a.price));
        }
        // "relevancia" mantém a ordem original

        res.render('resultados', { results, query });
    } catch (err) {
        console.error('Erro ao buscar produtos:', err);
        res.status(500).send('Erro ao buscar produtos');
    }
});

// Rota para renderizar a página de favoritos
app.get("/favoritos", async (req, res) => {
  if (!req.session.clienteId) {
    console.warn("Tentativa de acesso à favoritos sem login.");
    return res.redirect("/login-cliente");
  }

  try {
    const favoritos = await Favorito
      .find({ userId: req.session.clienteId })
      .populate("productId");

    const produtos = favoritos.map(f => f.productId);
    res.render("favoritos", { produtos });
  } catch (err) {
    console.error("Erro ao buscar favoritos:", err);
    res.status(500).send("Erro interno ao carregar favoritos");
  }
});

// Adicionar favorito
app.post("/api/favoritos/add", async (req, res) => {
  if (!req.session.clienteId) return res.status(401).json({ error: "Não logado" });

  const { productId } = req.body;
  try {
    await Favorito.create({ userId: req.session.clienteId, productId });
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao adicionar favorito:", err);
    res.status(500).json({ error: "Erro interno ao adicionar favorito" });
  }
});

// Remover favorito
app.post("/api/favoritos/remove", async (req, res) => {
  if (!req.session.clienteId) return res.status(401).json({ error: "Não logado" });

  const { productId } = req.body;
  try {
    await Favorito.deleteOne({ userId: req.session.clienteId, productId });
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao remover favorito:", err);
    res.status(500).json({ error: "Erro interno ao remover favorito" });
  }
});

// Verificar se produto está favoritado
app.get("/api/favoritos/check/:id", async (req, res) => {
  if (!req.session.clienteId) return res.json({ favoritado: false });

  try {
    const favorito = await Favorito.findOne({ userId: req.session.clienteId, productId: req.params.id });
    res.json({ favoritado: !!favorito });
  } catch (err) {
    console.error("Erro ao verificar favorito:", err);
    res.status(500).json({ error: "Erro interno ao verificar favorito" });
  }
});

app.get("/api/favoritos/list", async (req, res) => {
  if (!req.session.clienteId) {
    return res.status(401).json({ error: "Não logado" });
  }

  try {
    const favoritos = await Favorito
      .find({ userId: req.session.clienteId })
      .populate("productId");

    const produtos = favoritos.map(f => f.productId);
    res.json(produtos);
  } catch (err) {
    console.error("Erro ao listar favoritos:", err);
    res.status(500).json({ error: "Erro interno ao listar favoritos" });
  }
});

//rota de promooções
app.get('/promocoes', async (req, res) => {
    try {
        let saleProducts = await Product.find({ isOnSale: true });

        const ordenar = req.query.ordenar;

        if (ordenar === 'maior-desconto') {
            saleProducts = saleProducts.sort((a, b) => b.discountPercentage - a.discountPercentage);
        } else if (ordenar === 'menor-preco') {
            saleProducts = saleProducts.sort((a, b) => a.discountedPrice - b.discountedPrice);
        } else if (ordenar === 'maior-preco') {
            saleProducts = saleProducts.sort((a, b) => b.discountedPrice - a.discountedPrice);
        }

        res.render('promocoes', { saleProducts });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao carregar promoções");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});