import React, { useState, useEffect } from "react";
import { 
  Phone, MapPin, Search, ChevronLeft, ChevronRight,
  Trash2, Camera, Edit3, MessageCircle, ArrowRight, Settings, Lock, X, Loader2, Share2, GripHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy
} from "./firebase";

const PHONE_NUMBER = "919447478429"; 
const DISPLAY_PHONE = "+91 9447478429";
const MAP_LINK_PUTHIYARA = "https://www.google.com/maps/dir/11.3112413,75.75112/Cosmo+Fibres,+Pathoor+Tower+Room+no.1246+A1+Puthiyara+Rd+Nr.+Sabha+school+Kozhikode+4,+Kozhikode,+Kerala+673004/@11.2827178,75.7487465,14z/data=!3m1!4b1!4m9!4m8!1m1!4e1!1m5!1m1!1s0x3ba6598c23c00a7d:0xf2dfb76b77264f49!2m2!1d75.7877233!2d11.2553017";
const MAP_LINK_PAVANGADU = "https://www.google.com/maps?sca_esv=c7b63db539d9a6f3&sxsrf=ANbL-n4y8P1GsL3AGlAgqxJr-moJx04WLw:1773596159084&fbs=ADc_l-bYsCM_rR9GIcCz9AqkWo3Y2-uKCABnux-pWMGbqTcOHROBNAfTBZTUHA5QsajZB5ybY22DNdsTHGgZMMupLINWEbx0DvNvgv4fdfSXSdkWO5Q7rUVQ6YHhyD9fSeBMoOY3tFNRJDMrKT9_VuKgIG_zsKM_r3PdyujNscgdsCaCZbjMRX7D4iWDdSxGBo7xhST1jnXinRGy3ABqXu_tK7T2IsCSeD1_SwqRB7ICi5eUn_k73dU&biw=1536&bih=826&dpr=1.25&um=1&ie=UTF-8&fb=1&gl=in&sa=X&geocode=KZmdjB8AX6Y7MWNg5eUzCN5Q&daddr=8Q84%2BFV7+davasanu+complex,+Kandamkulangara,+Kozhikode,+Kerala+673021";

const CATEGORIES = ["Ladies", "Gents", "Kids", "Others"];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [view, setView] = useState("home"); 
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // New UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [draggedImgIdx, setDraggedImgIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Premium UI States
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, id: string | null}>({isOpen: false, id: null});

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Admin / Security States
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState("");

  // CRUD States
  const [isEditing, setIsEditing] = useState<string | null>(null); 
  const [form, setForm] = useState({
    name: "", category: "Ladies", price: "", desc: "", images: [] as string[]
  });

  // --- FETCH DATA ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });

    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubscribeProducts = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
      setIsLoading(false);
      
      // Handle direct links to products
      if (window.location.hash.startsWith('#product-')) {
        const pid = window.location.hash.replace('#product-', '');
        const p = data.find(x => x.id === pid);
        if (p) {
          setSelectedProduct(p);
          setView("detail");
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "products");
      setIsLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProducts();
    };
  }, []);

  const navigateTo = (newView: string, product?: any) => {
    setView(newView);
    if (newView === 'detail' && product) {
      setSelectedProduct(product);
      setCurrentImageIndex(0);
      window.location.hash = `#product-${product.id}`;
    } else {
      window.location.hash = '';
      setSelectedProduct(null);
    }
    window.scrollTo(0, 0);
  };

  // --- ACTIONS ---
  const handlePasscodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;
    
    const email = "admin@cosmofibers.com";
    try {
      await signInWithEmailAndPassword(auth, email, passcode);
      setShowPasscodeModal(false);
      setView("admin");
      setAuthError("");
      setPasscode("");
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        try {
          await createUserWithEmailAndPassword(auth, email, passcode);
          setShowPasscodeModal(false);
          setView("admin");
          setAuthError("");
          setPasscode("");
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-in-use') {
            setAuthError("Incorrect passcode.");
          } else {
            setAuthError("Please enable Email/Password in Firebase Console first.");
          }
        }
      } else {
        setAuthError(err.message);
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setShowPasscodeModal(false);
      setView("admin");
      setAuthError("");
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdmin(false);
    setView("home");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // Slightly higher quality limit to give better photos, but still under 1MB
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // 80% quality
          setForm(f => ({ ...f, images: [...f.images, dataUrl] }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const saveToInventory = async () => {
    if (!form.name || form.images.length === 0) {
      showToast("Missing required fields (Name and at least 1 image).", "error");
      return;
    }
    if (!auth.currentUser) {
      showToast("You must be logged in to save products.", "error");
      return;
    }
    
    setIsSaving(true);
    try {
      if (isEditing) {
        const productRef = doc(db, "products", isEditing);
        const originalProduct = products.find(p => p.id === isEditing);
        await updateDoc(productRef, {
          name: form.name,
          category: form.category,
          price: form.price,
          desc: form.desc,
          images: form.images,
          // Keep original immutable fields
          createdAt: originalProduct?.createdAt || Date.now(),
          authorUID: originalProduct?.authorUID || auth.currentUser.uid
        });
        setIsEditing(null);
      } else {
        await addDoc(collection(db, "products"), {
          name: form.name,
          category: form.category,
          price: form.price,
          desc: form.desc,
          images: form.images,
          createdAt: Date.now(),
          authorUID: auth.currentUser.uid
        });
      }
      
      setForm({ name: "", category: "Ladies", price: "", desc: "", images: [] });
      showToast("Catalog successfully updated.", "success");
    } catch (err) {
      showToast("Error saving product. Check console for details.", "error");
      handleFirestoreError(err, isEditing ? OperationType.UPDATE : OperationType.CREATE, "products");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setConfirmModal({ isOpen: true, id });
  };

  const executeDelete = async () => {
    if (!confirmModal.id) return;
    try {
      await deleteDoc(doc(db, "products", confirmModal.id));
      showToast("Product deleted successfully.", "success");
    } catch (err) {
      showToast("Error deleting product.", "error");
      handleFirestoreError(err, OperationType.DELETE, `products/${confirmModal.id}`);
    } finally {
      setConfirmModal({ isOpen: false, id: null });
    }
  };

  const startEdit = (product: any) => {
    setForm(product);
    setIsEditing(product.id);
    window.scrollTo(0, 0);
  };

  const getWhatsAppLink = (pName: string) => {
    const msg = encodeURIComponent(`Hi Cosmo Fibres, I am interested in ${pName}.`);
    return `https://wa.me/${PHONE_NUMBER}?text=${msg}`;
  };

  const customerGallery = products.filter(p => 
    (categoryFilter === "All" || p.category === categoryFilter) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-royal-bg text-royal-text font-sans selection:bg-royal-gold selection:text-royal-bg">
      
      {/* --- TOAST NOTIFICATION --- */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-24 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full shadow-2xl border flex items-center gap-3 text-sm font-bold tracking-wider ${
              toast.type === 'success' 
                ? 'bg-royal-surface border-royal-gold text-royal-gold' 
                : 'bg-red-950 border-red-500 text-red-400'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- CONFIRM DELETE MODAL --- */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-royal-surface p-8 rounded-xl shadow-2xl max-w-sm w-full border border-royal-border text-center"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <Trash2 size={32} />
              </div>
              <h3 className="font-serif text-2xl mb-2 text-royal-text">Delete Product?</h3>
              <p className="text-royal-muted text-sm mb-8">This action cannot be undone. The product will be permanently removed from your catalog.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal({ isOpen: false, id: null })}
                  className="flex-1 py-3 rounded-lg font-bold tracking-wide border border-royal-border text-royal-text hover:bg-royal-bg transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  onClick={executeDelete}
                  className="flex-1 py-3 rounded-lg font-bold tracking-wide bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  DELETE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* --- 1. TOP TOGGLE BAR --- */}
      <div className="bg-royal-surface text-royal-muted h-10 flex justify-center items-center gap-4 md:gap-8 text-[10px] md:text-xs font-medium tracking-widest fixed top-0 w-full z-50 border-b border-royal-border">
        <a href={`tel:${PHONE_NUMBER}`} className="flex items-center gap-2 hover:text-royal-gold transition-colors">
          <Phone size={14} /> CALL US
        </a>
        <div className="w-px h-4 bg-royal-border" />
        <a href={MAP_LINK_PUTHIYARA} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-royal-gold transition-colors">
          <MapPin size={14} /> PUTHIYARA
        </a>
        <div className="w-px h-4 bg-royal-border hidden sm:block" />
        <a href={MAP_LINK_PAVANGADU} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-royal-gold transition-colors">
          <MapPin size={14} /> PAVANGADU
        </a>
      </div>

      {/* --- 2. NAVIGATION --- */}
      <nav className="h-24 px-6 md:px-12 flex justify-between items-center fixed top-10 w-full bg-royal-bg/90 backdrop-blur-md z-40 border-b border-royal-border">
        <div 
          className="font-serif text-2xl md:text-3xl font-bold tracking-wide cursor-pointer text-royal-text" 
          onClick={() => navigateTo("home")}
        >
          COSMO <span className="text-royal-gold italic font-normal">Fibres</span>
        </div>
        <div className="flex items-center gap-6 md:gap-10">
          <button className="text-xs font-bold tracking-[0.2em] hover:text-royal-gold transition-colors" onClick={() => navigateTo("home")}>HOME</button>
          <button className="text-xs font-bold tracking-[0.2em] hover:text-royal-gold transition-colors" onClick={() => navigateTo("collection")}>COLLECTION</button>
        </div>
      </nav>

      {/* --- PASSCODE MODAL --- */}
      <AnimatePresence>
        {showPasscodeModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-royal-surface p-8 rounded-xl shadow-2xl max-w-sm w-full relative border border-royal-border"
            >
              <button 
                onClick={() => setShowPasscodeModal(false)}
                className="absolute top-4 right-4 text-royal-muted hover:text-royal-text"
              >
                <X size={20} />
              </button>
              <div className="flex justify-center mb-6">
                <div className="w-12 h-12 rounded-full bg-royal-gold/10 flex items-center justify-center text-royal-gold border border-royal-gold/20">
                  <Lock size={24} />
                </div>
              </div>
              <h3 className="font-serif text-2xl text-center mb-2 text-royal-text">Staff Access</h3>
              <p className="text-center text-royal-muted text-sm mb-6">Enter passcode or use Google to manage inventory.</p>
              
              <form onSubmit={handlePasscodeLogin} className="mb-4">
                <input 
                  type="password" 
                  autoFocus
                  value={passcode}
                  onChange={e => setPasscode(e.target.value)}
                  placeholder="Enter Passcode"
                  className="w-full px-4 py-3 bg-royal-bg border border-royal-border rounded-lg focus:outline-none focus:ring-1 focus:ring-royal-gold focus:border-royal-gold text-center tracking-widest mb-4 text-royal-text placeholder:text-royal-muted/50"
                />
                <button 
                  type="submit"
                  className="w-full bg-royal-gold text-royal-bg py-3 rounded-lg font-bold tracking-wide hover:bg-white transition-colors"
                >
                  ENTER PASSCODE
                </button>
              </form>

              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 h-px bg-royal-border"></div>
                <span className="text-xs text-royal-muted font-bold tracking-widest">OR</span>
                <div className="flex-1 h-px bg-royal-border"></div>
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={handleGoogleLogin}
                  className="w-full border border-royal-border text-royal-text py-3 rounded-lg font-bold tracking-wide hover:bg-royal-surface transition-colors flex items-center justify-center gap-2"
                >
                  SIGN IN WITH GOOGLE
                </button>
                {authError && <p className="text-red-400 text-xs text-center">{authError}</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pt-[136px] pb-24">
        <AnimatePresence mode="wait">
          
          {/* VIEW: HOME */}
          {view === "home" && (
            <motion.div key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-24 grid md:grid-cols-2 gap-12 md:gap-20 items-center">
                <div>
                  <h4 className="text-xs uppercase text-royal-gold mb-4 tracking-[0.3em] font-semibold">EST. 1998 • PUTHIYARA & PAVANGADU</h4>
                  <h1 className="font-serif text-5xl md:text-7xl leading-[1.1] mb-8 text-royal-text">
                    COSMO <br/>
                    <span className="text-royal-gold italic font-light">Fibres.</span>
                  </h1>
                  <div className="font-serif text-lg text-royal-muted leading-relaxed mb-10 max-w-xl space-y-4">
                    <p>
                      Cosmo Fibres is a trusted manufacturer of high-quality fibre glass mannequins in Kerala. Since 1998, we have been the sole manufacturers of fibre glass mannequins in Kerala, delivering durable and visually appealing display solutions for retailers and businesses.
                    </p>
                    <p>
                      We offer a wide range of female mannequins, male mannequins, and other display products, along with reliable services. All our products come with a guarantee, ensuring quality, durability, and timely delivery.
                    </p>
                  </div>
                  <button 
                    className="bg-royal-gold text-royal-bg px-8 py-4 rounded-sm font-bold tracking-widest text-xs hover:bg-white transition-all flex items-center gap-3"
                    onClick={() => navigateTo("collection")}
                  >
                    EXPLORE SHOWROOM <ArrowRight size={16}/>
                  </button>
                </div>
                <div className="relative h-[600px] md:h-[800px] rounded-t-full overflow-hidden shadow-2xl shadow-black/50 border-8 border-royal-surface">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/9/9f/Holt_Renfrew_Mannequins.jpg" 
                    className="w-full h-full object-cover" 
                    alt="Holt Renfrew Mannequins" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-royal-bg/80 via-transparent to-transparent" />
                </div>
              </section>
            </motion.div>
          )}

          {/* VIEW: COLLECTION */}
          {view === "collection" && (
            <motion.div key="c" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto px-6 md:px-12 py-12">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
                <div>
                  <h4 className="text-xs uppercase text-royal-gold mb-2 tracking-[0.2em] font-semibold">Our Inventory</h4>
                  <h2 className="font-serif text-4xl md:text-5xl text-royal-text">The Collection</h2>
                </div>
                <div className="flex items-center gap-3 border-b border-royal-border pb-2 w-full md:w-72">
                  <Search size={18} className="text-royal-muted" />
                  <input 
                    placeholder="Search models..." 
                    className="bg-transparent border-none outline-none w-full text-sm text-royal-text placeholder:text-royal-muted"
                    onChange={(e) => setSearchTerm(e.target.value)} 
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mb-12">
                {["All", ...CATEGORIES].map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setCategoryFilter(cat)} 
                    className={`px-6 py-2.5 rounded-full text-xs font-bold tracking-wider transition-all ${
                      categoryFilter === cat 
                        ? 'bg-royal-gold text-royal-bg shadow-md shadow-royal-gold/20' 
                        : 'border border-royal-border text-royal-muted hover:border-royal-gold hover:text-royal-gold'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32">
                  <Loader2 className="animate-spin text-royal-gold mb-4" size={48} />
                  <p className="text-royal-muted font-serif italic">Loading collection...</p>
                </div>
              ) : customerGallery.length === 0 ? (
                <div className="text-center py-24 text-royal-muted font-serif text-xl italic">
                  No products found in this category.
                </div>
              ) : (
                <motion.div 
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.1 }
                    }
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
                >
                  {customerGallery.map(p => (
                    <motion.div 
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0 }
                      }}
                      whileHover={{ y: -8 }}
                      key={p.id} 
                      className="bg-royal-surface group cursor-pointer border border-royal-border shadow-sm hover:shadow-xl hover:shadow-black/50 hover:border-royal-gold/50 transition-all duration-300"
                      onClick={() => navigateTo("detail", p)}
                    >
                      <div className="h-[400px] overflow-hidden bg-royal-bg relative">
                        {p.images[0] ? (
                          <img src={p.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100" alt={p.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-royal-border"><Camera size={48} /></div>
                        )}
                        <div className="absolute top-4 left-4 bg-royal-bg/90 backdrop-blur-sm px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-royal-gold border border-royal-gold/20">
                          {p.category}
                        </div>
                      </div>
                      <div className="p-6 text-center">
                        <h3 className="font-serif text-xl text-royal-text mb-2">{p.name}</h3>
                        <p className="text-royal-gold font-light">{p.price}</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* VIEW: PRODUCT DETAIL */}
          {view === "detail" && selectedProduct && (
            <motion.div key="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto px-6 md:px-12 py-8">
              <button 
                onClick={() => navigateTo("collection")} 
                className="flex items-center gap-2 text-xs font-bold tracking-widest text-royal-gold hover:text-white transition-colors mb-8"
              >
                <ChevronLeft size={16}/> BACK TO GALLERY
              </button>
              
              <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
                <div>
                  <div className="relative bg-royal-surface rounded-sm overflow-hidden h-[500px] md:h-[700px] mb-4 border border-royal-border group">
                    {selectedProduct.images[currentImageIndex] ? (
                      <img src={selectedProduct.images[currentImageIndex]} className="w-full h-full object-cover transition-opacity duration-300" alt={selectedProduct.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-royal-border"><Camera size={64} /></div>
                    )}
                    
                    {selectedProduct.images.length > 1 && (
                      <>
                        <button 
                          onClick={() => setCurrentImageIndex(prev => prev === 0 ? selectedProduct.images.length - 1 : prev - 1)}
                          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-royal-gold"
                        >
                          <ChevronLeft size={24} />
                        </button>
                        <button 
                          onClick={() => setCurrentImageIndex(prev => prev === selectedProduct.images.length - 1 ? 0 : prev + 1)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-royal-gold"
                        >
                          <ChevronRight size={24} />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {selectedProduct.images.map((img: string, i: number) => (
                      <img 
                        key={i} 
                        src={img} 
                        onClick={() => setCurrentImageIndex(i)}
                        className={`w-20 h-24 object-cover cursor-pointer border transition-colors ${currentImageIndex === i ? 'border-royal-gold opacity-100' : 'border-royal-border opacity-50 hover:opacity-100'}`} 
                        alt={`Thumbnail ${i}`} 
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-bold tracking-[0.2em] text-royal-gold uppercase">{selectedProduct.category}</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-2 text-xs font-bold tracking-widest text-royal-muted hover:text-royal-gold transition-colors"
                    >
                      {copied ? <span className="text-emerald-400">COPIED!</span> : <><Share2 size={16}/> SHARE</>}
                    </button>
                  </div>
                  <h1 className="font-serif text-4xl md:text-5xl text-royal-text mb-6 leading-tight">{selectedProduct.name}</h1>
                  
                  <div className="mb-8">
                    <h2 className="text-2xl font-light text-royal-muted mb-1">{selectedProduct.price}</h2>
                    <p className="text-[11px] text-royal-muted/60 tracking-wider uppercase font-medium">* GST 18% & Transportation charges extra</p>
                  </div>
                  
                  <div className="w-12 h-px bg-royal-gold mb-8" />
                  
                  <p className="text-royal-muted leading-relaxed mb-12 whitespace-pre-line">
                    {selectedProduct.desc || "No description provided."}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <a 
                      href={getWhatsAppLink(selectedProduct.name)} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="flex-1 bg-royal-gold text-royal-bg py-4 px-6 rounded-sm font-bold text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-white transition-colors"
                    >
                      <MessageCircle size={18}/> WHATSAPP INQUIRY
                    </a>
                    <a 
                      href={`tel:${PHONE_NUMBER}`} 
                      className="flex-1 border-2 border-royal-gold text-royal-gold py-4 px-6 rounded-sm font-bold text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-royal-gold hover:text-royal-bg transition-colors"
                    >
                      CALL NOW
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* VIEW: STAFF INVENTORY MANAGEMENT */}
          {view === "admin" && isAdmin && (
            <motion.div key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto px-6 py-12">
              <div className="bg-royal-surface p-8 md:p-12 rounded-xl shadow-2xl shadow-black/50 border border-royal-border">
                <div className="flex justify-between items-center mb-10 border-b border-royal-border pb-6">
                  <div>
                    <h4 className="text-xs uppercase text-royal-gold tracking-[0.2em] font-semibold mb-2">Staff Portal</h4>
                    <h2 className="font-serif text-3xl text-royal-text">{isEditing ? "Update Product" : "Manage Inventory"}</h2>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="text-xs font-bold tracking-widest text-royal-muted hover:text-red-400 transition-colors flex items-center gap-2"
                  >
                    <Lock size={14} /> LOGOUT
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-wider text-royal-muted uppercase">Product Name</label>
                    <input 
                      className="w-full p-4 bg-royal-bg border border-royal-border text-royal-text rounded-sm focus:outline-none focus:border-royal-gold transition-colors placeholder:text-royal-muted/50" 
                      placeholder="e.g. Premium Display Mannequin" 
                      value={form.name} 
                      onChange={e => setForm({...form, name: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-wider text-royal-muted uppercase">Price / Range</label>
                    <input 
                      className="w-full p-4 bg-royal-bg border border-royal-border text-royal-text rounded-sm focus:outline-none focus:border-royal-gold transition-colors placeholder:text-royal-muted/50" 
                      placeholder="e.g. ₹4,500 - ₹6,000" 
                      value={form.price} 
                      onChange={e => setForm({...form, price: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-wider text-royal-muted uppercase">Category</label>
                    <select 
                      className="w-full p-4 bg-royal-bg border border-royal-border text-royal-text rounded-sm focus:outline-none focus:border-royal-gold transition-colors appearance-none" 
                      value={form.category} 
                      onChange={e => setForm({...form, category: e.target.value})}
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold tracking-wider text-royal-muted uppercase">Description</label>
                    <textarea 
                      className="w-full p-4 bg-royal-bg border border-royal-border text-royal-text rounded-sm focus:outline-none focus:border-royal-gold transition-colors min-h-[120px] placeholder:text-royal-muted/50" 
                      placeholder="Product details, material, dimensions..." 
                      value={form.desc} 
                      onChange={e => setForm({...form, desc: e.target.value})} 
                    />
                  </div>

                  <div className="md:col-span-2 p-8 border-2 border-dashed border-royal-border rounded-lg bg-royal-bg text-center">
                    <input type="file" multiple hidden id="up" onChange={handleImageUpload} accept="image/*" />
                    <label htmlFor="up" className="cursor-pointer flex flex-col items-center gap-3 text-royal-muted hover:text-royal-gold transition-colors">
                      <Camera size={40} className="text-royal-gold/70" />
                      <span className="text-xs font-bold tracking-widest uppercase">Click to Upload Photos</span>
                    </label>
                    
                    {form.images.length > 0 && (
                      <div className="flex gap-4 mt-6 flex-wrap justify-center">
                        {form.images.map((img, i) => (
                          <div 
                            key={i} 
                            draggable
                            onDragStart={() => setDraggedImgIdx(i)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggedImgIdx === null || draggedImgIdx === i) return;
                              const newImages = [...form.images];
                              const draggedImg = newImages[draggedImgIdx];
                              newImages.splice(draggedImgIdx, 1);
                              newImages.splice(i, 0, draggedImg);
                              setForm({...form, images: newImages});
                              setDraggedImgIdx(null);
                            }}
                            className="relative group cursor-grab active:cursor-grabbing"
                          >
                            <img src={img} className="w-24 h-24 object-cover rounded-sm border border-royal-border shadow-sm" alt="Upload preview" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-sm">
                              <GripHorizontal className="text-white" size={20} />
                            </div>
                            <button 
                              className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                              onClick={() => setForm({...form, images: form.images.filter((_, idx) => idx !== i)})}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    disabled={isSaving}
                    className="flex-1 bg-royal-gold text-royal-bg py-4 rounded-sm font-bold text-xs tracking-widest hover:bg-white transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    onClick={saveToInventory}
                  >
                    {isSaving && <Loader2 className="animate-spin" size={16} />}
                    {isEditing ? "UPDATE ITEM" : "ADD TO CATALOG"}
                  </button>
                  {isEditing && (
                    <button 
                      className="px-8 border border-royal-border text-royal-text rounded-sm font-bold text-xs tracking-widest hover:bg-royal-bg transition-colors"
                      onClick={() => {
                        setIsEditing(null); 
                        setForm({ name: "", category: "Ladies", price: "", desc: "", images: [] });
                      }}
                    >
                      CANCEL
                    </button>
                  )}
                </div>

                <div className="mt-16">
                  <h3 className="font-serif text-2xl text-royal-text mb-6 border-b border-royal-border pb-4">Current Inventory</h3>
                  <div className="space-y-4">
                    {products.length === 0 ? (
                      <p className="text-royal-muted italic">No products in inventory.</p>
                    ) : (
                      products.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-4 bg-royal-bg border border-royal-border rounded-sm hover:border-royal-gold/50 transition-colors">
                          <div className="flex items-center gap-4">
                            {p.images[0] && <img src={p.images[0]} className="w-12 h-12 object-cover rounded-sm border border-royal-border" alt={p.name} /> }
                            <div>
                              <div className="font-serif text-lg text-royal-text">{p.name}</div>
                              <div className="text-xs font-bold tracking-wider text-royal-gold uppercase">{p.category}</div>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button 
                              className="p-2 text-royal-muted hover:text-royal-gold bg-royal-surface rounded-full shadow-sm border border-royal-border transition-colors"
                              onClick={() => startEdit(p)}
                              title="Edit"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              className="p-2 text-royal-muted hover:text-red-400 bg-royal-surface rounded-full shadow-sm border border-royal-border transition-colors"
                              onClick={() => confirmDelete(p.id)}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* --- 3. FOOTER --- */}
      <footer className="bg-royal-surface text-royal-muted py-16 px-6 md:px-12 border-t border-royal-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <h3 className="font-serif text-2xl text-royal-text mb-2">COSMO <span className="text-royal-gold italic">Fibres</span></h3>
            <p className="text-sm tracking-widest uppercase mb-1">Kerala, India • {DISPLAY_PHONE}</p>
            <p className="text-[10px] tracking-widest uppercase text-royal-muted/50">* All prices are exclusive of 18% GST and transportation charges.</p>
          </div>
          <div className="text-center md:text-right flex flex-col items-center md:items-end">
            <p className="text-xs tracking-widest uppercase opacity-50 mb-2">© 2026 Premium Showroom Excellence</p>
            <p className="text-xs opacity-30 mb-4">Designed for elegance and durability.</p>
            <button 
              onClick={() => isAdmin ? navigateTo("admin") : setShowPasscodeModal(true)}
              className="text-[10px] tracking-widest uppercase text-royal-muted hover:text-royal-gold flex items-center gap-2 transition-colors"
              title="Staff Access"
            >
              <Lock size={12} /> STAFF LOGIN
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
