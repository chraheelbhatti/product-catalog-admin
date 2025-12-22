"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";

// --- Types ---
type OrderItem = {
  product: ProductRow;
  qty: number;
  comment: string;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  price: string | null;
  currency: string | null;
  imageUrl: string | null;
  brand: string | null;
  stock: number | null;
  minQty: number | null;
};

type ProductsResponse = {
  items: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
};

// --- Utilities ---
function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

function formatPrice(price: string | null | number) {
  if (!price) return "—";
  const n = Number(price);
  if (!Number.isFinite(n)) return `₹${price}`;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- State ---
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [page, setPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("");
  const [pageSize] = useState(50);
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [brandsList, setBrandsList] = useState<string[]>([]);
  
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState("");

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [exporting, setExporting] = useState(false);

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // --- Data Fetching ---
  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (brand.trim()) p.set("brand", brand.trim());
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [q, brand, page, pageSize]);

  const refreshData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products?${queryString}`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { refreshData(); }, [queryString]);

  useEffect(() => {
    fetch("/api/brands").then(r => r.json()).then(d => {
      if(d.brands) setBrandsList(d.brands);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setJumpPage(String(page));
  }, [page]);

  // --- Logic ---

  function handleJump(e: React.FormEvent) {
    e.preventDefault();
    const p = parseInt(jumpPage);
    const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;
    if (p > 0 && p <= totalPages) {
      setPage(p);
    } else {
      setJumpPage(String(page));
    }
  }

  function updateQty(product: ProductRow, newQty: number) {
    if (newQty <= 0) {
      setOrderItems(curr => curr.filter(i => i.product.id !== product.id));
      return;
    }
    setOrderItems(curr => {
      const exists = curr.find(i => i.product.id === product.id);
      if (exists) {
        return curr.map(i => i.product.id === product.id ? { ...i, qty: newQty } : i);
      }
      return [...curr, { product, qty: newQty, comment: "" }];
    });
  }

  function updateComment(productId: string, comment: string) {
    setOrderItems(curr => 
      curr.map(i => i.product.id === productId ? { ...i, comment } : i)
    );
  }

  function getOrderInfo(productId: string) {
    return orderItems.find(i => i.product.id === productId);
  }

  async function onExportOrder() {
    if (orderItems.length === 0) return;
    setExporting(true);
    try {
      const itemsPayload = orderItems.map((item) => ({
        sku: item.product.sku,
        name: toTitleCase(item.product.name),
        brand: item.product.brand,
        imageUrl: item.product.imageUrl,
        unitPrice: Number(item.product.price) || 0,
        qty: item.qty,
        comment: item.comment,
        currency: "INR",
      }));

      const res = await fetch("/api/export/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderNumber, customerName, customerAddress, items: itemsPayload,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Export failed");
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `order-${orderNumber || "invoice"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) { 
        alert(`Failed to export PDF: ${e instanceof Error ? e.message : "Server Error"}`); 
    } 
    finally { setExporting(false); }
  }

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportProgress(10);
    setImportMessage("Reading file...");
    const fd = new FormData();
    fd.append("file", file);
    const timer = setInterval(() => setImportProgress(p => p < 90 ? p + 15 : p), 500);
    try {
      setImportMessage("Updating Catalog...");
      await fetch("/api/import/csv", { method: "POST", body: fd });
      setImportProgress(100);
      setImportMessage("Done!");
      setTimeout(() => { setImporting(false); refreshData(); window.location.reload(); }, 800);
    } catch (err) { alert("Import failed"); setImporting(false); } finally { clearInterval(timer); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, productId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(productId);
    setUploadProgress(0);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("productId", productId);
    const timer = setInterval(() => setUploadProgress(p => p < 90 ? p + 20 : p), 200);
    try {
      const res = await fetch("/api/upload/image", { method: "POST", body: fd });
      const json = await res.json();
      if (json.success) {
        setUploadProgress(100);
        setData(prev => {
          if (!prev) return null;
          return { ...prev, items: prev.items.map(i => i.id === productId ? { ...i, imageUrl: json.imageUrl } : i) };
        });
      }
    } catch (err) { console.error(err); } finally { clearInterval(timer); setTimeout(() => setUploadingId(null), 500); }
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;
  const orderTotal = orderItems.reduce((sum, item) => sum + ((Number(item.product.price)||0) * item.qty), 0);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 pb-20 lg:pb-0">
      
      {importing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 rounded-xl bg-white p-6 shadow-2xl text-center">
            <h3 className="mb-2 font-bold">Importing...</h3>
            <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden mb-2">
              <div className="h-full bg-green-600 transition-all duration-300" style={{ width: `${importProgress}%` }}/>
            </div>
            <p className="text-xs text-zinc-500">{importMessage}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between px-4 lg:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-bold">Z</div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Zee Ordering</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Admin Panel</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleCSV} />
            <button onClick={() => fileInputRef.current?.click()} className="rounded-lg bg-green-600 px-3 lg:px-4 py-2 text-xs font-bold text-white hover:bg-green-700 transition-colors">
              Import CSV
            </button>
            
            {/* LOGOUT: Removed 'hidden lg:block' so it's always visible */}
            <button 
              onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }} 
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium hover:bg-zinc-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1920px] flex-col lg:flex-row gap-6 p-4 lg:p-6 h-auto lg:h-[calc(100vh-65px)]">
        
        {/* Catalog */}
        <div className="flex flex-1 flex-col gap-4 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm h-[calc(100vh-160px)] lg:h-auto">
          
          {/* Toolbar: Stacked on Mobile so everything is visible */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b bg-white p-4">
            
            <div className="flex w-full sm:flex-1 gap-2 flex-col sm:flex-row">
              <input 
                className="w-full sm:max-w-sm rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                placeholder="Search..."
                value={q} onChange={e => { setQ(e.target.value); setPage(1); }}
              />
              
              {/* BRAND FILTER: Removed 'hidden' classes */}
              <select 
                className="w-full sm:w-auto rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none"
                value={brand} onChange={e => { setBrand(e.target.value); setPage(1); }}
              >
                <option value="">All Brands</option>
                {brandsList.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            
            <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-2 text-sm">
              <button disabled={page<=1} onClick={() => setPage(p=>p-1)} className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50 disabled:opacity-50 text-xs font-medium">Prev</button>
              
              <form onSubmit={handleJump} className="flex items-center gap-1">
                <input 
                  type="number" 
                  className="w-12 py-1.5 text-center rounded-lg border border-zinc-300 bg-white text-xs font-bold outline-none focus:border-zinc-900"
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                />
                <span className="text-xs text-zinc-400">/ {totalPages}</span>
              </form>

              <button disabled={page >= totalPages} onClick={() => setPage(p=>p+1)} className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50 disabled:opacity-50 text-xs font-medium">Next</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 auto-rows-min">
              {data?.items.map(p => {
                const orderInfo = getOrderInfo(p.id);
                const qty = orderInfo?.qty || 0;
                const comment = orderInfo?.comment || "";
                const isUploading = uploadingId === p.id;
                
                return (
                  <div key={p.id} className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:border-zinc-300 hover:shadow-md">
                    
                    <div className="relative aspect-square w-full bg-zinc-100 overflow-hidden">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-300 text-[10px] font-bold uppercase tracking-wider">No Image</div>
                      )}
                      
                      {isUploading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                          <svg className="h-10 w-10 -rotate-90 text-white" viewBox="0 0 36 36">
                            <path className="text-zinc-600" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                            <path className="text-white drop-shadow-md" strokeDasharray={`${uploadProgress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                          </svg>
                        </div>
                      ) : (
                        <label className="absolute top-2 right-2 cursor-pointer rounded-full bg-white/90 p-1.5 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white hover:scale-105 z-10">
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, p.id)} />
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        </label>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-3">
                      <div className="mb-1 flex items-start justify-between">
                        {p.brand ? (
                          <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600 border border-zinc-200">
                            {p.brand}
                          </span>
                        ) : <span />}
                        <span className="text-xs text-zinc-400 font-mono">{p.sku}</span>
                      </div>

                      <h3 className="mb-1 text-sm font-semibold leading-tight text-zinc-900 line-clamp-2" title={p.name}>
                        {toTitleCase(p.name)}
                      </h3>

                      {qty > 0 && (
                        <input 
                           className="mt-1 w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] outline-none focus:border-zinc-400 placeholder:text-zinc-400"
                           placeholder="Comment (e.g. Red Color)..."
                           value={comment}
                           onChange={(e) => updateComment(p.id, e.target.value)}
                           maxLength={30}
                        />
                      )}

                      <div className="mt-auto flex items-end justify-between pt-3">
                        <div className="text-base font-bold text-zinc-900">{formatPrice(p.price)}</div>

                        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 shadow-sm">
                          {qty > 0 ? (
                            <>
                              <button onClick={() => updateQty(p, qty - 1)} className="h-6 w-6 rounded bg-white text-zinc-600 hover:bg-zinc-100 hover:text-red-500 font-bold shadow-sm">-</button>
                              <span className="min-w-[20px] text-center text-xs font-bold">{qty}</span>
                              <button onClick={() => updateQty(p, qty + 1)} className="h-6 w-6 rounded bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm">+</button>
                            </>
                          ) : (
                            <button onClick={() => updateQty(p, 1)} className="h-6 px-3 rounded bg-white text-[10px] font-bold text-zinc-700 hover:bg-zinc-100 shadow-sm uppercase tracking-wide">
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {!loading && data?.items.length === 0 && (
               <div className="py-20 text-center text-zinc-400">No products found</div>
            )}
          </div>
        </div>

        {/* Order Summary (Desktop Only) */}
        <div className="hidden lg:flex w-[320px] xl:w-[360px] flex-col rounded-xl border border-zinc-200 bg-white shadow-sm h-[calc(100vh-160px)] lg:h-auto">
          <div className="border-b bg-zinc-50 px-4 py-3">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">Order Summary</h2>
            <p className="text-[10px] text-zinc-500">{orderItems.length} items selected</p>
          </div>

          <div className="space-y-3 p-4 border-b border-zinc-100">
             <input className="w-full rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-zinc-900" placeholder="Order #" value={orderNumber} onChange={e=>setOrderNumber(e.target.value)} />
             <input className="w-full rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-zinc-900" placeholder="Customer Name" value={customerName} onChange={e=>setCustomerName(e.target.value)} />
             <textarea className="w-full rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-zinc-900 resize-none" rows={2} placeholder="Address" value={customerAddress} onChange={e=>setCustomerAddress(e.target.value)} />
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {orderItems.length === 0 ? (
               <div className="mt-10 text-center text-xs text-zinc-400 px-6">
                  Catalog is empty.<br/>Use <span className="font-bold">+</span> buttons on products to add items.
               </div>
            ) : (
              <div className="space-y-2">
                {orderItems.map(item => (
                  <div key={item.product.id} className="flex gap-2 rounded-lg border border-zinc-100 bg-zinc-50/50 p-2">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-white border border-zinc-200">
                       {item.product.imageUrl && <img src={item.product.imageUrl} className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-xs font-bold text-zinc-800">{toTitleCase(item.product.name)}</div>
                      {item.comment && <div className="truncate text-[10px] text-zinc-500 italic">"{item.comment}"</div>}
                      <div className="flex justify-between items-center mt-1">
                        <div className="flex items-center gap-2 rounded border border-zinc-200 bg-white px-1">
                           <button onClick={()=>updateQty(item.product, item.qty-1)} className="text-xs px-1 hover:text-red-500">-</button>
                           <span className="text-[10px] font-bold w-4 text-center">{item.qty}</span>
                           <button onClick={()=>updateQty(item.product, item.qty+1)} className="text-xs px-1 hover:text-green-600">+</button>
                        </div>
                        <div className="text-xs font-bold text-zinc-900">{formatPrice((Number(item.product.price)||0)*item.qty)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t bg-zinc-50 p-4">
             <div className="flex justify-between items-end mb-3">
                <span className="text-xs font-bold text-zinc-500">TOTAL</span>
                <span className="text-2xl font-black text-zinc-900 tracking-tight">{formatPrice(orderTotal)}</span>
             </div>
             <button disabled={exporting || orderItems.length===0} onClick={onExportOrder} className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-bold text-white shadow hover:bg-zinc-800 disabled:opacity-50">
               {exporting ? "Generating..." : "Export PDF"}
             </button>
          </div>
        </div>

      </main>

      {/* MOBILE PROFESSIONAL BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t bg-white px-6 py-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] lg:hidden">
        <div>
          <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Total Amount</p>
          <p className="text-xl font-black text-zinc-900 leading-none">{formatPrice(orderTotal)}</p>
          <p className="text-[10px] text-zinc-400">{orderItems.length} items</p>
        </div>
        <button 
           onClick={onExportOrder} 
           disabled={orderItems.length === 0 || exporting}
           className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-zinc-800 disabled:opacity-50 disabled:shadow-none"
        >
          {exporting ? "Wait..." : "Export PDF"}
        </button>
      </div>

    </div>
  );
}