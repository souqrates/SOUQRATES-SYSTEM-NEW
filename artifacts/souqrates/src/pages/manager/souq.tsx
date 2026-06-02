import { useState } from "react";
import {
  useListSouqProducts,
  useCreateSouqProduct,
  useUpdateSouqProduct,
  useDeleteSouqProduct,
  useGetSouqStats,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, Plus, Edit3, Trash2, ToggleLeft, ToggleRight, Star, Save, X, BookOpen, Layers, GraduationCap, TrendingUp, Package, DollarSign } from "lucide-react";

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  book: BookOpen,
  template: Layers,
  course: GraduationCap,
};

const CATEGORY_COLORS: Record<string, string> = {
  book: "text-purple-400",
  template: "text-blue-400",
  course: "text-emerald-400",
};

type FormData = {
  name: string;
  slug: string;
  category: "book" | "template" | "course";
  description: string;
  longDescription: string;
  author: string;
  coverImageUrl: string;
  fileUrl: string;
  previewUrl: string;
  price: string;
  isActive: boolean;
  isFeatured: boolean;
  tags: string;
};

const EMPTY_FORM: FormData = {
  name: "",
  slug: "",
  category: "book",
  description: "",
  longDescription: "",
  author: "",
  coverImageUrl: "",
  fileUrl: "",
  previewUrl: "",
  price: "",
  isActive: true,
  isFeatured: false,
  tags: "",
};

export default function SouqAdmin() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: stats } = useGetSouqStats();
  const { data: products = [], isLoading } = useListSouqProducts({});

  const createProduct = useCreateSouqProduct();
  const updateProduct = useUpdateSouqProduct();
  const deleteProduct = useDeleteSouqProduct();

  const filtered = products.filter((p) => {
    const matchCat = catFilter === "all" || p.category === catFilter;
    const matchSearch =
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.author.toLowerCase().includes(filter.toLowerCase());
    return matchCat && matchSearch;
  });

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(p: typeof products[0]) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      slug: p.slug,
      category: p.category as "book" | "template" | "course",
      description: p.description,
      longDescription: p.longDescription ?? "",
      author: p.author,
      coverImageUrl: p.coverImageUrl ?? "",
      fileUrl: p.fileUrl ?? "",
      previewUrl: p.previewUrl ?? "",
      price: String(p.price),
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      tags: p.tags ?? "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    const data = {
      name: form.name,
      slug: form.slug,
      category: form.category,
      description: form.description,
      longDescription: form.longDescription,
      author: form.author,
      coverImageUrl: form.coverImageUrl,
      fileUrl: form.fileUrl,
      previewUrl: form.previewUrl,
      price: parseFloat(form.price) || 0,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      tags: form.tags,
    };

    if (editingId !== null) {
      await updateProduct.mutateAsync({ productId: editingId, data });
    } else {
      await createProduct.mutateAsync({ data });
    }
    qc.invalidateQueries({ queryKey: ["/api/souq/products"] });
    qc.invalidateQueries({ queryKey: ["/api/souq/stats"] });
    closeForm();
  }

  async function toggleActive(id: number, current: boolean) {
    await updateProduct.mutateAsync({ productId: id, data: { isActive: !current } });
    qc.invalidateQueries({ queryKey: ["/api/souq/products"] });
  }

  async function toggleFeatured(id: number, current: boolean) {
    await updateProduct.mutateAsync({ productId: id, data: { isFeatured: !current } });
    qc.invalidateQueries({ queryKey: ["/api/souq/products"] });
  }

  async function confirmDelete(id: number) {
    await deleteProduct.mutateAsync({ productId: id });
    qc.invalidateQueries({ queryKey: ["/api/souq/products"] });
    qc.invalidateQueries({ queryKey: ["/api/souq/stats"] });
    setDeleteId(null);
  }

  const f = (k: keyof FormData, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Products", value: stats.totalProducts, icon: Package, color: "text-purple-400" },
            { label: "Active Products", value: stats.activeProducts, icon: TrendingUp, color: "text-emerald-400" },
            { label: "Total Sales", value: stats.totalPurchases, icon: ShoppingBag, color: "text-blue-400" },
            { label: "Revenue (SKZ)", value: stats.totalRevenue.toFixed(0), icon: DollarSign, color: "text-yellow-400" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color} shrink-0`} />
              <div>
                <div className="text-xl font-orbitron font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground font-orbitron">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header + Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {["all", "book", "template", "course"].map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-md text-xs font-orbitron font-medium transition-colors ${
                catFilter === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-card-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search products..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 sm:w-48 px-3 py-1.5 bg-card border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-orbitron"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-orbitron font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Products Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground font-orbitron">Loading products...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground font-orbitron">No products found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const Icon = CATEGORY_ICONS[p.category] ?? BookOpen;
            const catColor = CATEGORY_COLORS[p.category] ?? "text-purple-400";
            return (
              <div key={p.id} className="bg-card border border-card-border rounded-xl p-4 flex items-start gap-4">
                {/* Cover */}
                <div className="w-12 h-16 rounded-md overflow-hidden shrink-0 bg-accent flex items-center justify-center">
                  {p.coverImageUrl ? (
                    <img src={p.coverImageUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Icon className={`h-6 w-6 ${catColor}`} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-sm font-orbitron font-semibold text-foreground truncate">{p.name}</span>
                    {p.isFeatured && (
                      <span className="text-[10px] font-orbitron bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded">
                        FEATURED
                      </span>
                    )}
                    <span className={`text-[10px] font-orbitron bg-card border border-card-border px-1.5 py-0.5 rounded uppercase ${catColor}`}>
                      {p.category}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-orbitron">{p.author}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</div>
                  <div className="flex items-center gap-4 mt-2 text-xs font-orbitron">
                    <span className="text-yellow-400 font-bold">{p.price} SKZ</span>
                    <span className="text-muted-foreground">{p.totalSales} sales</span>
                    <span className="text-muted-foreground">Rating: {p.rating}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleFeatured(p.id, p.isFeatured)}
                    title={p.isFeatured ? "Unfeature" : "Feature"}
                    className={`p-1.5 rounded-md transition-colors ${p.isFeatured ? "text-yellow-400 bg-yellow-500/10" : "text-muted-foreground hover:text-yellow-400"}`}
                  >
                    <Star className="h-4 w-4" fill={p.isFeatured ? "currentColor" : "none"} />
                  </button>
                  <button
                    onClick={() => toggleActive(p.id, p.isActive)}
                    title={p.isActive ? "Deactivate" : "Activate"}
                    className={`p-1.5 rounded-md transition-colors ${p.isActive ? "text-emerald-400" : "text-muted-foreground"}`}
                  >
                    {p.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(p.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-orbitron font-bold text-foreground">Confirm Delete</h3>
            <p className="text-sm text-muted-foreground">This will permanently delete the product. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 bg-accent border border-card-border rounded-md text-sm font-orbitron text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deleteId)}
                className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-orbitron hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-card-border rounded-xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between p-6 border-b border-card-border">
              <h3 className="font-orbitron font-bold text-foreground text-lg">
                {editingId !== null ? "Edit Product" : "Add Product"}
              </h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider">Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => f("name", e.target.value)}
                    className="w-full px-3 py-2 bg-accent border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Product name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider">Slug *</label>
                  <input
                    value={form.slug}
                    onChange={(e) => f("slug", e.target.value)}
                    className="w-full px-3 py-2 bg-accent border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="url-friendly-slug"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => f("category", e.target.value)}
                    className="w-full px-3 py-2 bg-accent border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="book">Book</option>
                    <option value="template">Template</option>
                    <option value="course">Course</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider">Author *</label>
                  <input
                    value={form.author}
                    onChange={(e) => f("author", e.target.value)}
                    className="w-full px-3 py-2 bg-accent border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Author name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider">Short Description *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => f("description", e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-accent border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  placeholder="Brief product description"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider">Full Description</label>
                <textarea
                  value={form.longDescription}
                  onChange={(e) => f("longDescription", e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-accent border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  placeholder="Detailed product description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider">Price (SKZ) *</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => f("price", e.target.value)}
                    className="w-full px-3 py-2 bg-accent border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider">Tags</label>
                  <input
                    value={form.tags}
                    onChange={(e) => f("tags", e.target.value)}
                    className="w-full px-3 py-2 bg-accent border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="tag1,tag2,tag3"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider">Cover Image URL</label>
                <input
                  value={form.coverImageUrl}
                  onChange={(e) => f("coverImageUrl", e.target.value)}
                  className="w-full px-3 py-2 bg-accent border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider">File URL</label>
                  <input
                    value={form.fileUrl}
                    onChange={(e) => f("fileUrl", e.target.value)}
                    className="w-full px-3 py-2 bg-accent border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider">Preview URL</label>
                  <input
                    value={form.previewUrl}
                    onChange={(e) => f("previewUrl", e.target.value)}
                    className="w-full px-3 py-2 bg-accent border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => f("isActive", e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-orbitron text-muted-foreground">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => f("isFeatured", e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-orbitron text-muted-foreground">Featured</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-card-border">
              <button
                onClick={closeForm}
                className="flex-1 px-4 py-2 bg-accent border border-card-border rounded-md text-sm font-orbitron text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={createProduct.isPending || updateProduct.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-orbitron hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {editingId !== null ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
