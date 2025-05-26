import { Category } from "@shared/schema";
import { useLanguage } from "@/hooks/use-language";
import { useLocation } from "wouter";

interface CategoryCardProps {
  category: Category;
}

export default function CategoryCard({ category }: CategoryCardProps) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { id, name, description, imageUrl = '' } = category;
  
  const handleCategoryClick = () => {
    // Use React Router navigation for better state management
    setLocation(`/products?category=${id}`);
  };
  
  return (
    <div className="relative rounded-lg overflow-hidden group h-80">
      <img 
        src={(imageUrl || '') as string} 
        alt={name} 
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20 flex items-end p-6">
        <div>
          <h3 className="heading text-white text-2xl font-semibold mb-2">{name}</h3>
          <button 
            className="inline-block text-white font-accent text-sm border-b border-white pb-1 hover:border-primary hover:text-primary transition-colors cursor-pointer"
            onClick={handleCategoryClick}
          >
            {t('home.exploreCollection')}
          </button>
        </div>
      </div>
    </div>
  );
}
