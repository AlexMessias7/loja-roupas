const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Modelo de Produto
const Product = mongoose.model('Product', new mongoose.Schema({
  name: String,
  image: String,
  extraImages: [String]
}));

// Conexão com MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ Conectado ao MongoDB Atlas");

    // Upload da imagem padrão para Cloudinary (uma vez só)
    const defaultUpload = await cloudinary.uploader.upload(
      'public/images/default.jpg', // caminho local da imagem padrão
      {
        folder: 'loja-roupas',
        format: 'jpg' // força o formato JPG
      }
    );
    const defaultUrl = defaultUpload.secure_url;
    console.log("✅ Imagem padrão enviada para Cloudinary:", defaultUrl);

    // Busca produtos com imagem principal quebrada
    const produtos = await Product.find({ image: { $regex: '^/images/' } });

    for (const produto of produtos) {
      // Substitui imagem principal quebrada
      if (produto.image && produto.image.startsWith('/images/')) {
        produto.image = defaultUrl;
      }

      // Substitui imagens extras quebradas
      produto.extraImages = await Promise.all(produto.extraImages.map(async img => {
        if (img.startsWith('/images/')) {
          return defaultUrl;
        }
        return img;
      }));

      await produto.save();
      console.log(`🔧 Produto atualizado: ${produto.name}`);
    }

    console.log("✅ Correção concluída");
    mongoose.disconnect();
  })
  .catch(err => console.error("❌ Erro de conexão:", err));