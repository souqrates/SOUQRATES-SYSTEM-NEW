import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useGetSouqProduct, usePurchaseSouqProduct, useGetMySouqLibrary } from "@workspace/api-client-react";
import { getTelegramId } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Book, FileCode2, GraduationCap, ShoppingCart, CheckCircle2, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function CategoryIcon({ category, className }: { category: string, className?: string }) {
  switch(category) {
    case "book": return <Book className={className} />;
    case "template": return <FileCode2 className={className} />;
    case "course": return <GraduationCap className={className} />;
    default: return <Book className={className} />;
  }
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const telegramId = getTelegramId();
  
  const productId = parseInt(id || "0", 10);
  
  const { data: product, isLoading: isProductLoading } = useGetSouqProduct(
    productId,
    { query: { enabled: !!productId, queryKey: ['getSouqProduct', productId] } }
  );

  const { data: libraryItems, isLoading: isLibraryLoading } = useGetMySouqLibrary(
    { telegram_id: telegramId },
    { query: { enabled: !!telegramId, queryKey: ['getMySouqLibrary', telegramId] } }
  );
  
  const purchaseMutation = usePurchaseSouqProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['getMySouqLibrary', telegramId] });
        queryClient.invalidateQueries({ queryKey: ['walletBalance', telegramId] });
        toast({
          title: "Purchase successful",
          description: "Asset added to your library.",
        });
      },
      onError: (error: any) => {
        toast({
          title: "Purchase failed",
          description: error.message || "Insufficient balance or error occurred.",
          variant: "destructive"
        });
      }
    }
  });

  if (isProductLoading || !product) {
    return (
      <Layout>
        <div className="mb-6">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <Skeleton className="w-full aspect-[4/3] rounded-xl" />
          <div className="space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  const isPurchased = libraryItems?.some(item => item.product.id === product.id);
  const isPurchasing = purchaseMutation.isPending;

  const handlePurchase = () => {
    purchaseMutation.mutate({
      productId: product.id,
      data: { telegramId }
    });
  };

  const gradients = {
    book: "from-blue-900/40 to-blue-600/20",
    template: "from-purple-900/40 to-primary/20",
    course: "from-emerald-900/40 to-emerald-600/20",
  };
  const gradient = gradients[product.category as keyof typeof gradients] || gradients.book;

  return (
    <Layout>
      <Button 
        variant="ghost" 
        className="mb-8 text-muted-foreground hover:text-foreground"
        onClick={() => setLocation("/")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Marketplace
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left Col: Image */}
        <div className="relative rounded-xl overflow-hidden border border-border bg-card">
          {product.coverImageUrl ? (
            <img 
              src={product.coverImageUrl} 
              alt={product.name}
              className="w-full h-auto object-cover"
            />
          ) : (
            <div className={`w-full aspect-video bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <CategoryIcon category={product.category} className="w-32 h-32 opacity-20" />
            </div>
          )}
        </div>

        {/* Right Col: Details */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-4 text-primary text-sm uppercase tracking-wider font-semibold">
            <CategoryIcon category={product.category} className="w-4 h-4" />
            <span>{product.category}</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-bold mb-4">{product.name}</h1>
          
          <div className="flex items-center gap-4 mb-8 text-muted-foreground">
            <div>By <span className="text-foreground font-medium">{product.author}</span></div>
            <div className="h-1 w-1 rounded-full bg-border"></div>
            <div>{product.totalSales} Sales</div>
          </div>
          
          <div className="text-4xl font-mono font-bold text-accent mb-8">
            {product.price} SKZ
          </div>
          
          {isPurchased ? (
            <div className="p-6 bg-secondary/50 rounded-xl border border-primary/30 mb-8">
              <div className="flex items-center gap-3 mb-4 text-primary">
                <CheckCircle2 className="w-6 h-6" />
                <h3 className="font-orbitron font-semibold text-lg">You own this asset</h3>
              </div>
              <Button 
                className="w-full font-orbitron tracking-wide" 
                onClick={() => setLocation("/library")}
              >
                Go to Library
              </Button>
            </div>
          ) : (
            <Button 
              size="lg" 
              className="w-full py-6 text-lg font-orbitron tracking-wider mb-8 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handlePurchase}
              disabled={isPurchasing || isLibraryLoading}
            >
              {isPurchasing ? "Processing..." : (
                <>
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Purchase Access
                </>
              )}
            </Button>
          )}

          <div className="space-y-6 flex-grow">
            <div>
              <h3 className="text-xl font-orbitron mb-3 border-b border-border pb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {product.longDescription || product.description}
              </p>
            </div>
            
            {product.tags && (
              <div>
                <h3 className="text-sm font-orbitron text-muted-foreground mb-3 uppercase tracking-wider">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {product.tags.split(',').map(tag => (
                    <Badge key={tag.trim()} variant="secondary" className="bg-secondary text-secondary-foreground border-border">
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
