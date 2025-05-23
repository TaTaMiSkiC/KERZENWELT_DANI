import multer from 'multer';
import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

// Stvaranje direktorija za upload ako ne postoji
const uploadDir = path.join(process.cwd(), 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfiguracija za pohranu uploadanih datoteka
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generiramo jedinstveno ime datoteke
    const uniqueSuffix = randomBytes(8).toString('hex');
    const extension = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${extension}`);
  }
});

// Filtriranje datoteka - samo slike su dozvoljene
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Dozvoljene su samo slike'));
  }
};

// Stvaranje middleware-a za upload
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  }
});

// Middleware za naprednu obradu slike nakon uploada
export const resizeImage = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return next();
  }

  try {
    const filePath = req.file.path;
    const fileExt = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath, fileExt);
    const outputDir = path.dirname(filePath);
    
    // Generiraj verzije različitih veličina i formatima
    const sizes = [
      { width: 800, height: 800, suffix: 'large' },
      { width: 400, height: 400, suffix: 'medium' },
      { width: 200, height: 200, suffix: 'thumbnail' }
    ];
    
    // Osnovni sharp objekt
    const sharpInstance = sharp(filePath).rotate(); // Automatska rotacija prema EXIF
    
    // Dohvati metapodatke slike
    const metadata = await sharpInstance.metadata();
    const aspectRatio = metadata.width && metadata.height ? metadata.width / metadata.height : 1;
    
    // Kreiraj WebP verziju u svim veličinama za moderne preglednike
    for (const size of sizes) {
      // Izračunaj dimenzije uz očuvanje omjera
      let resizeOptions = {
        width: size.width,
        height: size.height,
        fit: sharp.fit.inside,
        withoutEnlargement: true
      };
      
      // Generiraj optimiziranu WebP verziju (moderni preglednici)
      const webpFilePath = path.join(
        outputDir,
        `${fileName}-${size.suffix}.webp`
      );
      
      await sharpInstance
        .clone()
        .resize(resizeOptions)
        .webp({ quality: 80, effort: 6 }) // Visoka kvaliteta uz dobru kompresiju
        .toFile(webpFilePath);
      
      // Generiraj optimiziranu verziju u originalnom formatu (fallback)
      const optimizedFilePath = path.join(
        outputDir,
        `${fileName}-${size.suffix}${fileExt}`
      );
      
      await sharpInstance
        .clone()
        .resize(resizeOptions)
        .jpeg({ quality: 85, progressive: true }) // Ako je JPEG, koristimo progresivni JPEG
        .png({ compressionLevel: 9, palette: true }) // Ako je PNG, maksimalna kompresija
        .toFile(optimizedFilePath);
    }
    
    // Obriši originalnu datoteku nakon što smo napravili optimizirane verzije
    fs.unlinkSync(filePath);
    
    // Koristimo najveću verziju kao glavni URL
    const mainWebpUrl = `/uploads/${fileName}-large.webp`;
    const mainImageUrl = `/uploads/${fileName}-large${fileExt}`;
    
    // Spremamo putanje u request body za daljnju obradu
    req.body.imageUrl = mainImageUrl; // Originalni format
    req.body.webpUrl = mainWebpUrl; // WebP format
    req.body.thumbnailUrl = `/uploads/${fileName}-thumbnail${fileExt}`;
    req.body.thumbnailWebpUrl = `/uploads/${fileName}-thumbnail.webp`;
    req.body.responsiveUrls = {
      large: { original: `/uploads/${fileName}-large${fileExt}`, webp: `/uploads/${fileName}-large.webp` },
      medium: { original: `/uploads/${fileName}-medium${fileExt}`, webp: `/uploads/${fileName}-medium.webp` },
      thumbnail: { original: `/uploads/${fileName}-thumbnail${fileExt}`, webp: `/uploads/${fileName}-thumbnail.webp` }
    };
    
    console.log(`Slika uspješno procesirana u više formata i veličina. Glavna slika dostupna na: ${mainImageUrl}`);
    
    next();
  } catch (error) {
    next(error);
  }
};