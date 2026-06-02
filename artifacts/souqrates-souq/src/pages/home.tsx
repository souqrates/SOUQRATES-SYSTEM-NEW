import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListSouqProducts } from "@workspace/api-client-react";
import { SouqProduct, SouqProductCategory } from "@workspace/api-client-react";
import { Search, Book, FileCode2, GraduationCap, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function CategoryIcon({ category, className }: { category: string, className?: string }) {
  switch(category) {
    case "book": return <Book className={className} />;
    case "template": return <FileCode2 className={className} />;
    case "course": return <GraduationCap className={className} />;
    default: return <Sparkles className={className} />;
  }
}

function ProductPlaceholder({ category }: { category: string }) {
  const gradients = {
    book: "from-blue-900/40 to-blue-600/20",
    template: "from-purple-900/40 to-primary/20",
    course: "from-emerald-900/40 to-emerald-600/20",
  };
  
  const gradient = gradients[category as keyof typeof gradients] || gradients.book;
  
  return (
    <div className={`w-full aspect-[4/3] bg-gradient-to-br ${gradient} flex items-center justify-center`}>
      <CategoryIcon category={category} className="w-16 h-16 opacity-30" />
    </div>
  );
}

function ProductCard({ product }: { product: SouqProduct }) {
  return (
    <Link href={`/product/${product.id}`}>
      <Card className="h-full overflow-hidden flex flex-col border-border bg-card hover:border-primary/50 transition-colors cursor-pointer group">
        <div className="relative w-full aspect-[4/3] overflow-hidden bg-muted">
          {product.coverImageUrl ? (
            <img 
              src={product.coverImageUrl} 
              alt={product.name}
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <ProductPlaceholder category={product.category} />
          )}
          {product.isFeatured && (
            <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground border-none font-orbitron uppercase text-[10px] px-2 py-0.5">
              Featured
            </Badge>
          )}
        </div>
        
        <CardHeader className="p-4 pb-2 flex-grow">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
            <CategoryIcon category={product.category} className="w-3 h-3" />
            <span>{product.category}</span>
          </div>
          <h3 className="font-orbitron font-semibold text-lg leading-tight line-clamp-2 mb-1">{product.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
        </CardHeader>
        
        <CardFooter className="p-4 pt-0 flex items-end justify-between">
          <div className="text-xs text-muted-foreground">
            By <span className="text-foreground">{product.author}</span>
          </div>
          <div className="font-mono font-bold text-accent text-lg">
            {product.price} SKZ
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}

export default function Home() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  
  const { data: products, isLoading } = useListSouqProducts(
    { 
      isActive: true, 
      ...(search ? { search } : {}),
      ...(category !== "all" ? { category } : {})
    },
    { query: { queryKey: ['listSouqProducts', search, category, true] } }
  );

  return (
    <Layout>
      <div className="mb-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Digital Marketplace</h1>
            <p className="text-muted-foreground">Discover premium tools, knowledge, and assets.</p>
          </div>
          
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search assets..." 
              className="pl-9 bg-secondary border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <Tabs value={category} onValueChange={setCategory} className="w-full">
          <TabsList className="bg-secondary/50 border border-border p-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-orbitron uppercase text-xs tracking-wider">All Assets</TabsTrigger>
            <TabsTrigger value="book" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-orbitron uppercase text-xs tracking-wider">Books</TabsTrigger>
            <TabsTrigger value="template" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-orbitron uppercase text-xs tracking-wider">Templates</TabsTrigger>
            <TabsTrigger value="course" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-orbitron uppercase text-xs tracking-wider">Courses</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="flex flex-col space-y-3">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-secondary/30 rounded-xl border border-border border-dashed">
          <Sparkles className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="font-orbitron text-xl mb-2 text-muted-foreground">No assets found</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Try adjusting your search or filtering by a different category.
          </p>
        </div>
      )}
    </Layout>
  );
}
