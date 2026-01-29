const mongoose = require('mongoose');
require('dotenv').config();

// Modelo de Produto
const Product = mongoose.model('Product', new mongoose.Schema({
  name: String,
  image: String,
  extraImages: [String]
}));

// Conexão
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ Conectado ao MongoDB Atlas");

    // Busca produtos com imagens locais quebradas
    const produtos = await Product.find({ image: { $regex: '^/images/' } });

    for (const produto of produtos) {
      // Substitui por uma imagem padrão do Cloudinary
      produto.image = 'https://res.cloudinary.com/SEU_CLOUD_NAME/image/upload/v1234567890/loja-roupas/default.jpg';

      // Se tiver extras locais, também substitui
      produto.extraImages = produto.extraImages.map(img =>
        img.startsWith('/images/')
          ? 'https://res.cloudinary.com/dr5e0uyno/image/upload/v1234567890/loja-roupas/default.jpg'
          : img
      );

      await produto.save();
      console.log(`🔧 Produto atualizado: ${produto.name}`);
    }

    console.log("✅ Correção concluída");
    mongoose.disconnect();
  })
  .catch(err => console.error("❌ Erro de conexão:", err));