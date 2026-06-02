import { Layout } from "@/components/layout";
import { useGetMySouqLibrary } from "@workspace/api-client-react";
import { getTelegramId } from "@/hooks/use-auth";
import { SouqLibraryItem } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Library, Book, FileCode2, GraduationCap } from "lucide-react";
import { format } from "date-fns";

function CategoryIcon({ category, className }: { category: string, className?: string }) {
  switch(category) {
    case "book": return <Book className={className} />;
    case "template": return <FileCode2 className={className} />;
    case "course": return <GraduationCap className={className} />;
    default: return <Library className={className} />;
  }
}

function LibraryCard({ item }: { item: SouqLibraryItem }) {
  const { product } = item;
  
  const gradients = {
    book: "from-blue-900/40 to-blue-600/20",
    template: "from-purple-900/40 to-primary/20",
    course: "from-emerald-900/40 to-emerald-600/20",
  };
  const gradient = gradients[product.category as keyof typeof gradients] || gradients.book;

  return (
    <Card className="flex flex-col border-border bg-card overflow-hidden">
      <div className="relative w-full aspect-video overflow-hidden bg-muted">
        {product.coverImageUrl ? (
          <img 
            src={product.coverImageUrl} 
            alt={product.name}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <CategoryIcon category={product.category} className="w-12 h-12 opacity-30" />
          </div>
        )}
      </div>
      
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-primary text-xs uppercase tracking-wider font-semibold">
            <CategoryIcon category={product.category} className="w-3 h-3" />
            <span>{product.category}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Purchased {format(new Date(item.purchasedAt), 'MMM d, yyyy')}
          </span>
        </div>
        <h3 className="font-orbitron font-semibold text-lg line-clamp-1">{product.name}</h3>
      </CardHeader>
      
      <CardContent className="p-4 pt-0 text-sm text-muted-foreground flex-grow">
        <p className="line-clamp-2">{product.description}</p>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex gap-2">
        {product.fileUrl && (
          <Button className="flex-1" variant="default" asChild>
            <a href={product.fileUrl} target="_blank" rel="noopener noreferrer">
              <Download className="w-4 h-4 mr-2" />
              Download
            </a>
          </Button>
        )}
        {product.previewUrl && (
          <Button className="flex-1 bg-secondary text-foreground hover:bg-secondary/80" variant="outline" asChild>
            <a href={product.previewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Access
            </a>
          </Button>
        )}
        {!product.fileUrl && !product.previewUrl && (
          <Button className="flex-1" variant="secondary" disabled>
            Processing...
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default function LibraryPage() {
  const telegramId = getTelegramId();
  
  const { data: libraryItems, isLoading } = useGetMySouqLibrary(
    { telegram_id: telegramId },
    { query: { enabled: !!telegramId, queryKey: ['getMySouqLibrary', telegramId] } }
  );

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">My Library</h1>
        <p className="text-muted-foreground">Access your purchased books, templates, and courses.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col space-y-3">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full mt-4" />
            </div>
          ))}
        </div>
      ) : libraryItems && libraryItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {libraryItems.map(item => (
            <LibraryCard key={item.purchaseId} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-secondary/30 rounded-xl border border-border border-dashed">
          <Library className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="font-orbitron text-xl mb-2 text-muted-foreground">Your library is empty</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
            You haven't purchased any assets yet. Explore the marketplace to find tools to accelerate your growth.
          </p>
          <Button asChild className="font-orbitron tracking-wide">
            <a href="/">Explore Marketplace</a>
          </Button>
        </div>
      )}
    </Layout>
  );
}
