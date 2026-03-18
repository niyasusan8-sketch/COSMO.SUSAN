import React, { useState, useEffect, useRef } from "react";
import { 
  Phone, MapPin, Search, ChevronLeft, ChevronRight,
  Trash2, Camera, Edit3, MessageCircle, ArrowRight, Settings, Lock, X, Loader2, Share2, GripHorizontal, Facebook, Link as LinkIcon, Image as ImageIcon, ShoppingBag, Plus, Minus
} from "lucide-react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { Helmet } from "react-helmet-async";
import imageCompression from 'browser-image-compression';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy,
  storage, ref, uploadBytes, getDownloadURL
} from "./firebase";

const PHONE_NUMBER = "919447478429"; 
const DISPLAY_PHONE = "+91 9447478429";
const MAP_LINK_PUTHIYARA = "https://www.google.com/maps/dir/11.3112413,75.75112/Cosmo+Fibres,+Pathoor+Tower+Room+no.1246+A1+Puthiyara+Rd+Nr.+Sabha+school+Kozhikode+4,+Kozhikode,+Kerala+673004/@11.2827178,75.7487465,14z/data=!3m1!4b1!4m9!4m8!1m1!4e1!1m5!1m1!1s0x3ba6598c23c00a7d:0xf2dfb76b77264f49!2m2!1d75.7877233!2d11.2553017";
const MAP_LINK_PAVANGADU = "https://www.google.com/maps?sca_esv=c7b63db539d9a6f3&sxsrf=ANbL-n4y8P1GsL3AGlAgqxJr-moJx04WLw:1773596159084&fbs=ADc_l-bYsCM_rR9GIcCz9AqkWo3Y2-uKCABnux-pWMGbqTcOHROBNAfTBZTUHA5QsajZB5ybY22DNdsTHGgZMMupLINWEbx0DvNvgv4fdfSXSdkWO5Q7rUVQ6YHhyD9fSeBMoOY3tFNRJDMrKT9_VuKgIG_zsKM_r3PdyujNscgdsCaCZbjMRX7D4iWDdSxGBo7xhST1jnXinRGy3ABqXu_tK7T2IsCSeD1_SwqRB7ICi5eUn_k73dU&biw=1536&bih=826&dpr=1.25&um=1&ie=UTF-8&fb=1&gl=in&sa=X&geocode=KZmdjB8AX6Y7MWNg5eUzCN5Q&daddr=8Q84%2BFV7+davasanu+complex,+Kandamkulangara,+Kozhikode,+Kerala+673021";

const CATEGORIES = ["Ladies", "Gents", "Kids", "Hangers", "Others"];

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
  const [lookbookUrl, setLookbookUrl] = useState("");
  const [imageRatio, setImageRatio] = useState("aspect-[3/4]");

  // New UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isLookbookModalOpen, setIsLookbookModalOpen] = useState(false);
  const [modalIframeUrl, setModalIframeUrl] = useState("");
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [draggedImgIdx, setDraggedImgIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });
  
  const [quickViewProduct, setQuickViewProduct] = useState<any>(null);
  const [quickViewIndex, setQuickViewIndex] = useState(0);
  
  // Quote Cart State
  const [quoteCart, setQuoteCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
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
    name: "", category: "Ladies", desc: "", images: [] as string[], externalLink: ""
  });

  // --- FETCH DATA ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });

    const q = query(collection(db, "products"));
    const unsubscribeProducts = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side so older products without createdAt don't disappear
      data.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      setProducts(data);
      setIsLoading(false);
      
      // Handle direct links to products
      const params = new URLSearchParams(window.location.search);
      let pid = params.get('p') || window.location.hash.replace('#product-', '');
      let imgIdx = parseInt(params.get('img') || '0', 10);
      if (pid) {
        pid = pid.replace(/\/$/, '').trim();
        const p = data.find(x => x.id === pid);
        if (p) {
          setSelectedProduct(p);
          setCurrentImageIndex(isNaN(imgIdx) ? 0 : imgIdx);
          setView("detail");
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "products");
      setIsLoading(false);
    });

    const unsubscribeSettings = onSnapshot(doc(db, "settings", "general"), (docSnap) => {
      if (docSnap.exists()) {
        setLookbookUrl(docSnap.data().lookbookUrl || "");
      }
    }, (error) => {
      console.error("Error fetching settings:", error);
    });

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      let pid = params.get('p');
      let imgIdx = parseInt(params.get('img') || '0', 10);
      if (pid) {
        pid = pid.replace(/\/$/, '').trim();
        // We need to find the product from the current products state
        // Since this is inside a useEffect, we might not have the latest products
        // But we can just set a flag or rely on the next render
        setView("detail");
        setCurrentImageIndex(isNaN(imgIdx) ? 0 : imgIdx);
        // We can't easily access the latest products here without adding it to dependencies,
        // so we use a state to force the other useEffect to run
        setForceUpdate(prev => prev + 1);
      } else {
        setView("home");
        setSelectedProduct(null);
      }
    };
    
    window.addEventListener('popstate', handlePopState);

    return () => {
      unsubscribeAuth();
      unsubscribeProducts();
      unsubscribeSettings();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Effect to update selected product when products load or popstate happens
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let pid = params.get('p') || window.location.hash.replace('#product-', '');
    let imgIdx = parseInt(params.get('img') || '0', 10);
    if (pid && products.length > 0) {
      pid = pid.replace(/\/$/, '').trim();
      if (!selectedProduct || selectedProduct.id !== pid) {
        const p = products.find(x => x.id === pid);
        if (p) {
          setSelectedProduct(p);
          setCurrentImageIndex(isNaN(imgIdx) ? 0 : imgIdx);
          setView("detail");
        }
      } else if (selectedProduct && selectedProduct.id === pid) {
        // If the product is already selected, just update the image index if it changed
        const newImgIdx = isNaN(imgIdx) ? 0 : imgIdx;
        if (currentImageIndex !== newImgIdx) {
          setCurrentImageIndex(newImgIdx);
        }
      }
    }
  }, [products, selectedProduct, forceUpdate, currentImageIndex]);

  const navigateTo = (newView: string, product?: any, imageIndex: number = 0) => {
    setView(newView);
    if (newView === 'detail' && product) {
      setSelectedProduct(product);
      setCurrentImageIndex(imageIndex);
      window.history.pushState({}, '', `?p=${product.id}&img=${imageIndex}`);
    } else {
      window.history.pushState({}, '', window.location.pathname);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];
    
    showToast("Processing images...", "success");
    
    for (const file of files) {
      try {
        // BALANCED COMPRESSION: Higher quality but still safe for Firestore's 1MB document limit.
        // Base64 adds 33% size, so a 300KB image becomes ~400KB of text.
        // This allows ~2 high-quality images per product without crashing.
        const options = {
          maxSizeMB: 0.3, // 300KB max per image
          maxWidthOrHeight: 1200, // Good resolution for phones/web
          useWebWorker: true,
          initialQuality: 0.85,
        };
        
        const compressedFile = await imageCompression(file, options);
        
        // Reverting to Base64 (Text) storage temporarily
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          setForm(f => ({ ...f, images: [...f.images, dataUrl] }));
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error("Error compressing image:", error);
        showToast("Error processing image", "error");
      }
    }
  };

  const saveSettings = async (newUrl: string) => {
    try {
      await setDoc(doc(db, "settings", "general"), { lookbookUrl: newUrl }, { merge: true });
      showToast("Settings updated successfully.", "success");
      setIsSettingsModalOpen(false);
    } catch (err) {
      showToast("Error saving settings.", "error");
      handleFirestoreError(err, OperationType.WRITE, "settings/general");
    }
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
          desc: form.desc,
          images: form.images,
          externalLink: form.externalLink || "",
          // Keep original immutable fields
          createdAt: originalProduct?.createdAt || Date.now(),
          authorUID: originalProduct?.authorUID || auth.currentUser.uid
        });
        setIsEditing(null);
      } else {
        await addDoc(collection(db, "products"), {
          name: form.name,
          category: form.category,
          desc: form.desc,
          images: form.images,
          externalLink: form.externalLink || "",
          createdAt: Date.now(),
          authorUID: auth.currentUser.uid
        });
      }
      
      setForm({ name: "", category: "Ladies", desc: "", images: [], externalLink: "" });
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
    setForm({ ...product, externalLink: product.externalLink || "" });
    setIsEditing(product.id);
    window.scrollTo(0, 0);
  };

  const getWhatsAppLink = (pName: string, imageUrl: string) => {
    const msg = encodeURIComponent(`Hi Cosmo Fibres, I am interested in ${pName}. Reference Image: ${imageUrl}`);
    return `https://wa.me/${PHONE_NUMBER}?text=${msg}`;
  };

  const addToQuote = (product: any, image: string, subHeadingName: string) => {
    setQuoteCart(prev => {
      const existing = prev.find(item => item.product.id === product.id && item.image === image);
      if (existing) {
        return prev.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, image, subHeadingName, quantity: 1 }];
    });
    setToast({ message: "Added to Quote List", type: "success" });
  };

  const updateQuoteQuantity = (index: number, delta: number) => {
    setQuoteCart(prev => {
      const newCart = [...prev];
      newCart[index].quantity += delta;
      if (newCart[index].quantity <= 0) newCart.splice(index, 1);
      return newCart;
    });
  };

  const getBulkWhatsAppLink = () => {
    let msg = "Hi Cosmo Fibres, I would like a bulk quote for the following items:\n\n";
    quoteCart.forEach((item, idx) => {
      msg += `${idx + 1}. ${item.subHeadingName || item.product.name} (Qty: ${item.quantity})\nRef: ${item.image}\n\n`;
    });
    return `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(msg)}`;
  };

  const handleShare = async () => {
    if (!selectedProduct) return;
    
    const shareText = `Hi Cosmo Fibres, I have an enquiry about this item:
Product: ${selectedProduct.name}

I would like to know more about:
[ ] Price
[ ] Color Variations
[ ] Availability
[ ] Shipping Details
[ ] Other: 

(Please tick what you need to know and reply to this message)`;
    
    if (navigator.share) {
      try {
        let fileToShare: File | null = null;
        if (selectedProduct.images && selectedProduct.images.length > 0) {
          try {
            const currentImage = selectedProduct.images[currentImageIndex] || selectedProduct.images[0];
            const response = await fetch(currentImage);
            const blob = await response.blob();
            fileToShare = new File([blob], 'product.jpg', { type: blob.type });
          } catch (e) {
            console.error("Could not fetch image for sharing", e);
          }
        }

        const shareData: any = {
          title: selectedProduct.name,
          text: shareText,
        };

        if (fileToShare && navigator.canShare && navigator.canShare({ files: [fileToShare], text: shareText })) {
          shareData.files = [fileToShare];
        }

        if (navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      } catch (err) {
        console.error("Error sharing", err);
        return;
      }
    }
    
    setShowShareMenu(!showShareMenu);
  };

  const customerGallery = products
    .filter(p => 
      (categoryFilter === "All" || p.category === categoryFilter) &&
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .flatMap(p => 
      p.images.map((img: string, idx: number) => ({ 
        ...p, 
        displayImage: img, 
        imageIndex: idx, 
        uniqueId: `${p.id}-${idx}`,
        subHeadingName: p.images.length > 1 ? `${p.name} (View ${idx + 1})` : p.name
      }))
    );

  return (
    <div className="min-h-screen bg-royal-bg text-royal-text font-sans selection:bg-royal-gold selection:text-royal-bg">
      <Helmet>
        <title>{selectedProduct ? `${selectedProduct.name} | Cosmo Fibres` : 'Cosmo Fibres | Premium Textiles'}</title>
        <meta name="description" content={selectedProduct?.desc || 'Discover premium textiles and fabrics at Cosmo Fibres.'} />
        <meta property="og:title" content={selectedProduct ? `${selectedProduct.name} | Cosmo Fibres` : 'Cosmo Fibres | Premium Textiles'} />
        <meta property="og:description" content={selectedProduct?.desc || 'Discover premium textiles and fabrics at Cosmo Fibres.'} />
        {selectedProduct?.images?.[0] && <meta property="og:image" content={selectedProduct.images[0]} />}
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="website" />
        <style>{`
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: #050505; }
          ::-webkit-scrollbar-thumb { background: #D4AF37; border-radius: 10px; }
          ::-webkit-scrollbar-thumb:hover { background: #F3E5AB; }
        `}</style>
      </Helmet>
      
      {/* --- SCROLL PROGRESS BAR --- */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-[2px] bg-royal-gold origin-left z-[100]" 
        style={{ scaleX }} 
      />

      {/* --- PREMIUM FLOATING WHATSAPP BUTTON --- */}
      <motion.div 
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 200, damping: 20 }}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[999] flex items-center justify-end group"
      >
        <a 
          href={`https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent("Hi Cosmo Fibres, I'm interested in your products.")}`} 
          target="_blank" 
          rel="noreferrer" 
          className="relative flex items-center justify-center"
          title="Chat with us on WhatsApp"
        >
          {/* Expandable Text */}
          <span className="absolute right-full mr-4 bg-royal-bg/90 backdrop-blur-md border border-royal-gold/30 text-royal-gold text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-lg">
            Chat With Us
          </span>
          
          {/* Pulsing rings */}
          <span className="absolute inset-0 rounded-full bg-royal-gold/40 animate-ping opacity-75 group-hover:bg-royal-gold/60 duration-1000"></span>
          <span className="absolute inset-[-8px] rounded-full border border-royal-gold/20 animate-[spin_4s_linear_infinite] group-hover:border-royal-gold/50 transition-colors"></span>
          
          {/* Main Button */}
          <div className="relative bg-gradient-to-tr from-yellow-600 to-royal-gold text-white p-4 rounded-full shadow-[0_0_30px_rgba(212,175,55,0.3)] group-hover:shadow-[0_0_40px_rgba(212,175,55,0.6)] group-hover:scale-110 transition-all duration-300">
            <MessageCircle size={28} className="drop-shadow-md group-hover:rotate-12 transition-transform duration-300" />
          </div>
        </a>
      </motion.div>

      {/* --- QUOTE CART SIDEBAR --- */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm"
              onClick={() => setIsCartOpen(false)}
            />
            <motion.div 
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-royal-surface z-[200] border-l border-royal-border shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-royal-border flex justify-between items-center bg-royal-bg">
                <h2 className="font-serif text-2xl text-royal-gold flex items-center gap-3">
                  <ShoppingBag /> Quote List
                </h2>
                <button onClick={() => setIsCartOpen(false)} className="text-royal-muted hover:text-royal-text transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {quoteCart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-royal-muted space-y-4">
                    <ShoppingBag size={48} className="opacity-20" />
                    <p className="font-serif italic text-lg">Your quote list is empty</p>
                    <button 
                      onClick={() => { setIsCartOpen(false); navigateTo("collection"); }}
                      className="px-6 py-2 border border-royal-gold text-royal-gold rounded-sm text-xs tracking-widest hover:bg-royal-gold hover:text-royal-bg transition-colors mt-4"
                    >
                      BROWSE COLLECTION
                    </button>
                  </div>
                ) : (
                  quoteCart.map((item, idx) => (
                    <div key={idx} className="flex gap-4 bg-royal-bg p-4 rounded-lg border border-royal-border relative group">
                      <button 
                        onClick={() => setQuoteCart(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X size={14} />
                      </button>
                      <div className="w-20 h-24 rounded-md overflow-hidden bg-black/20 flex-shrink-0">
                        <img src={item.image} alt={item.subHeadingName || item.product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-serif text-royal-text line-clamp-2">{item.subHeadingName || item.product.name}</h4>
                          <p className="text-xs text-royal-muted mt-1">{item.product.category}</p>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <button 
                            onClick={() => updateQuoteQuantity(idx, -1)}
                            className="w-6 h-6 rounded-full border border-royal-border flex items-center justify-center text-royal-muted hover:text-royal-gold hover:border-royal-gold transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuoteQuantity(idx, 1)}
                            className="w-6 h-6 rounded-full border border-royal-border flex items-center justify-center text-royal-muted hover:text-royal-gold hover:border-royal-gold transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {quoteCart.length > 0 && (
                <div className="p-6 border-t border-royal-border bg-royal-bg">
                  <a 
                    href={getBulkWhatsAppLink()}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-4 bg-royal-gold text-royal-bg font-bold tracking-widest text-sm rounded-sm flex items-center justify-center gap-2 hover:bg-white transition-colors shadow-lg"
                  >
                    <MessageCircle size={18} /> SEND ENQUIRY ON WHATSAPP
                  </a>
                  <p className="text-center text-xs text-royal-muted mt-4">
                    Our team will review your requirements and get back to you with the best bulk pricing.
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
      
      {/* --- QUICK VIEW MODAL --- */}
      <AnimatePresence>
        {quickViewProduct && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
            onClick={() => setQuickViewProduct(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-royal-surface w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl border border-royal-border flex flex-col md:flex-row"
              onClick={e => e.stopPropagation()}
            >
              {/* Left: Image Carousel */}
              <div className="w-full md:w-3/5 relative bg-royal-bg flex items-center justify-center min-h-[400px] overflow-hidden group">
                <button 
                  onClick={() => setQuickViewProduct(null)}
                  className="absolute top-4 left-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-royal-gold md:hidden"
                >
                  <X size={20} />
                </button>
                
                <img 
                  src={quickViewProduct.images[quickViewIndex]} 
                  className="max-w-full max-h-[60vh] md:max-h-[90vh] object-contain transition-transform duration-700 ease-out group-hover:scale-125 cursor-zoom-in"
                  alt={quickViewProduct.name}
                />
                
                {quickViewProduct.images.length > 1 && (
                  <>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setQuickViewIndex(prev => prev === 0 ? quickViewProduct.images.length - 1 : prev - 1); }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-royal-gold transition-colors"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setQuickViewIndex(prev => prev === quickViewProduct.images.length - 1 ? 0 : prev + 1); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-royal-gold transition-colors"
                    >
                      <ChevronRight size={24} />
                    </button>
                    
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto">
                      {quickViewProduct.images.map((img: string, idx: number) => (
                        <button 
                          key={idx}
                          onClick={(e) => { e.stopPropagation(); setQuickViewIndex(idx); }}
                          className={`w-16 h-16 flex-shrink-0 border-2 rounded-sm overflow-hidden ${quickViewIndex === idx ? 'border-royal-gold' : 'border-transparent opacity-50 hover:opacity-100'}`}
                        >
                          <img src={img} className="w-full h-full object-cover" alt="" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              
              {/* Right: Details */}
              <div className="w-full md:w-2/5 p-8 flex flex-col relative">
                <button 
                  onClick={() => setQuickViewProduct(null)}
                  className="absolute top-4 right-4 text-royal-muted hover:text-royal-text hidden md:block"
                >
                  <X size={24} />
                </button>
                
                <span className="text-xs font-bold tracking-[0.2em] text-royal-gold uppercase mb-2">{quickViewProduct.category}</span>
                <h2 className="font-serif text-3xl text-royal-text mb-4">{quickViewProduct.subHeadingName || quickViewProduct.name}</h2>
                
                <div className="w-12 h-px bg-royal-gold mb-6" />
                
                <p className="text-royal-muted text-sm leading-relaxed mb-8 flex-grow whitespace-pre-line">
                  {quickViewProduct.desc}
                </p>
                
                <div className="flex flex-col gap-3 mt-auto">
                  <div className="flex gap-3">
                    <a 
                      href={getWhatsAppLink(quickViewProduct.subHeadingName || quickViewProduct.name, quickViewProduct.images[quickViewIndex])} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="flex-1 bg-royal-gold text-royal-bg py-4 rounded-sm font-bold text-[10px] md:text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-white transition-colors"
                    >
                      <MessageCircle size={16}/> ENQUIRE
                    </a>
                    <button 
                      onClick={() => addToQuote(quickViewProduct, quickViewProduct.images[quickViewIndex], quickViewProduct.subHeadingName || quickViewProduct.name)}
                      className="flex-1 border border-royal-gold text-royal-gold py-4 rounded-sm font-bold text-[10px] md:text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-royal-gold hover:text-royal-bg transition-colors"
                    >
                      <ShoppingBag size={16}/> ADD TO QUOTE
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      setQuickViewProduct(null);
                      navigateTo("detail", quickViewProduct, quickViewIndex);
                    }}
                    className="w-full border border-royal-border text-royal-text py-4 rounded-sm font-bold text-xs tracking-widest hover:border-royal-gold hover:text-royal-gold transition-colors"
                  >
                    VIEW FULL DETAILS
                  </button>
                </div>
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
          <button className="text-xs font-bold tracking-[0.2em] hover:text-royal-gold hover:scale-105 transition-all" onClick={() => navigateTo("home")}>HOME</button>
          <button className="text-xs font-bold tracking-[0.2em] hover:text-royal-gold hover:scale-105 transition-all" onClick={() => navigateTo("collection")}>COLLECTION</button>
          <button 
            className="relative text-xs font-bold tracking-[0.2em] hover:text-royal-gold hover:scale-105 transition-all flex items-center gap-2" 
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingBag size={16} />
            <span className="hidden md:inline">QUOTE</span>
            {quoteCart.length > 0 && (
              <span className="absolute -top-2 -right-3 bg-royal-gold text-royal-bg text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {quoteCart.length}
              </span>
            )}
          </button>
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
                      Since 1998, Cosmo Fibres has been Kerala's premier manufacturer of high-quality fiberglass mannequins. 
                    </p>
                    <p>
                      We deliver durable, visually striking display solutions for modern retailers, backed by guaranteed quality and reliable service.
                    </p>
                  </div>
                  <button 
                    className="bg-royal-gold text-royal-bg px-8 py-4 rounded-sm font-bold tracking-widest text-xs hover:bg-white hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
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

              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
                <div className="flex flex-wrap gap-3">
                  {["All", ...CATEGORIES].map(cat => (
                    <button 
                      key={cat} 
                      onClick={() => setCategoryFilter(cat)} 
                      className={`px-6 py-2.5 rounded-full text-xs font-bold tracking-wider transition-all hover:scale-105 active:scale-95 ${
                        categoryFilter === cat 
                          ? 'bg-royal-gold text-royal-bg shadow-md shadow-royal-gold/20' 
                          : 'border border-royal-border text-royal-muted hover:border-royal-gold hover:text-royal-gold'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center gap-3 bg-royal-surface border border-royal-border p-1.5 rounded-full shadow-sm">
                  <span className="text-[10px] font-bold tracking-widest text-royal-muted uppercase pl-3">Photo Size:</span>
                  <select 
                    className="bg-royal-bg border border-royal-border text-royal-gold text-xs font-bold tracking-wider focus:outline-none focus:border-royal-gold cursor-pointer rounded-full px-4 py-1.5"
                    value={imageRatio}
                    onChange={(e) => setImageRatio(e.target.value)}
                  >
                    <option value="aspect-[3/4]">Portrait (3:4)</option>
                    <option value="aspect-square">Square (1:1)</option>
                    <option value="aspect-[4/3]">Landscape (4:3)</option>
                    <option value="aspect-video">Cinematic (16:9)</option>
                    <option value="aspect-auto">Original Fit</option>
                  </select>
                </div>
              </div>

              {lookbookUrl && (
                <div className="mb-12">
                  <button 
                    onClick={() => {
                      setModalIframeUrl(lookbookUrl);
                      setIsLookbookModalOpen(true);
                    }}
                    className="inline-flex items-center gap-3 px-6 py-3 bg-royal-surface border border-royal-border text-royal-gold rounded-sm font-bold text-xs tracking-widest hover:border-royal-gold hover:bg-royal-gold/5 transition-all shadow-sm"
                  >
                    <ImageIcon size={16} /> EXPLORE EXCLUSIVE LOOKBOOK
                  </button>
                </div>
              )}

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
                      key={p.uniqueId} 
                      className="bg-royal-surface group cursor-pointer border border-royal-border shadow-sm hover:shadow-xl hover:shadow-black/50 hover:border-royal-gold/50 transition-all duration-300"
                      onClick={() => {
                        setQuickViewProduct(p);
                        setQuickViewIndex(p.imageIndex);
                      }}
                    >
                      <div className={`overflow-hidden bg-royal-bg relative flex items-center justify-center ${imageRatio}`}>
                        {p.displayImage ? (
                          <img 
                            src={p.displayImage} 
                            loading="lazy" 
                            className={`w-full h-full ${imageRatio === 'aspect-auto' ? 'object-contain' : 'object-cover'} group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100`} 
                            alt={p.name} 
                          />
                        ) : (
                          <div className="w-full h-full min-h-[200px] flex items-center justify-center text-royal-border"><Camera size={48} /></div>
                        )}
                        <div className="absolute top-4 left-4 bg-royal-bg/90 backdrop-blur-sm px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-royal-gold border border-royal-gold/20">
                          {p.category}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToQuote(p, p.displayImage, p.subHeadingName || p.name);
                          }}
                          className="absolute bottom-4 right-4 bg-royal-gold text-royal-bg p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 shadow-lg translate-y-4 group-hover:translate-y-0"
                          title="Add to Quote"
                        >
                          <ShoppingBag size={18} />
                        </button>
                      </div>
                      <div className="p-6 text-center">
                        <h3 className="font-serif text-xl text-royal-text">{p.name}</h3>
                        {p.images.length > 1 && (
                          <p className="text-xs text-royal-muted mt-2 font-medium tracking-wider uppercase">View {p.imageIndex + 1}</p>
                        )}
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
                className="flex items-center gap-2 text-xs font-bold tracking-widest text-royal-gold hover:text-white hover:-translate-x-1 transition-all mb-8"
              >
                <ChevronLeft size={16}/> BACK TO GALLERY
              </button>
              
              <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
                <div>
                  <div className="relative bg-royal-surface rounded-sm overflow-hidden mb-4 border border-royal-border group flex items-center justify-center">
                    {selectedProduct.images[currentImageIndex] ? (
                      <img src={selectedProduct.images[currentImageIndex]} loading="lazy" className="w-full h-auto object-contain transition-opacity duration-300" alt={selectedProduct.name} />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center text-royal-border"><Camera size={64} /></div>
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
                        loading="lazy"
                        onClick={() => setCurrentImageIndex(i)}
                        className={`h-24 w-auto object-contain cursor-pointer border transition-colors bg-royal-surface ${currentImageIndex === i ? 'border-royal-gold opacity-100' : 'border-royal-border opacity-50 hover:opacity-100'}`} 
                        alt={`Thumbnail ${i}`} 
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-bold tracking-[0.2em] text-royal-gold uppercase">{selectedProduct.category}</span>
                    <div className="relative" ref={shareMenuRef}>
                      <button 
                        onClick={handleShare}
                        className="flex items-center gap-2 text-xs font-bold tracking-widest text-royal-muted hover:text-royal-gold hover:scale-105 transition-all"
                      >
                        {copied ? <span className="text-emerald-400">COPIED!</span> : <><Share2 size={16}/> SHARE</>}
                      </button>
                      
                      <AnimatePresence>
                        {showShareMenu && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute right-0 mt-2 w-48 bg-royal-bg border border-royal-gold/20 rounded-sm shadow-xl z-50 overflow-hidden"
                          >
                            <a 
                              href={`https://wa.me/?text=${encodeURIComponent(`Hi Cosmo Fibres, I have an enquiry about this item:\nProduct: ${selectedProduct.name}\n\nI would like to know more about:\n[ ] Price\n[ ] Color Variations\n[ ] Availability\n[ ] Shipping Details\n[ ] Other: \n\n(Please tick what you need to know and reply to this message)`)}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex items-center gap-3 px-4 py-3 text-sm text-royal-text hover:bg-royal-gold/10 hover:pl-5 transition-all"
                            >
                              <MessageCircle size={16} /> WhatsApp
                            </a>
                            <a 
                              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(selectedProduct.images[currentImageIndex] || selectedProduct.images[0])}&quote=${encodeURIComponent(`Hi Cosmo Fibres, I have an enquiry about this item: ${selectedProduct.name}`)}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex items-center gap-3 px-4 py-3 text-sm text-royal-text hover:bg-royal-gold/10 hover:pl-5 transition-all"
                            >
                              <Facebook size={16} /> Facebook
                            </a>
                            <button 
                              onClick={() => { 
                                navigator.clipboard.writeText(`Hi Cosmo Fibres, I have an enquiry about this item:\nProduct: ${selectedProduct.name}\n\nI would like to know more about:\n[ ] Price\n[ ] Color Variations\n[ ] Availability\n[ ] Shipping Details\n[ ] Other: \n\n(Please tick what you need to know and reply to this message)`); 
                                setCopied(true); 
                                setTimeout(() => setCopied(false), 2000); 
                                setShowShareMenu(false); 
                              }} 
                              className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm text-royal-text hover:bg-royal-gold/10 hover:pl-5 transition-all"
                            >
                              <LinkIcon size={16} /> Copy Message
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <h1 className="font-serif text-4xl md:text-5xl text-royal-text mb-6 leading-tight">{selectedProduct.name}</h1>
                  
                  <div className="w-12 h-px bg-royal-gold mb-8" />
                  
                  {selectedProduct.desc && (
                    <p className="text-royal-muted leading-relaxed mb-12 whitespace-pre-line">
                      {selectedProduct.desc}
                    </p>
                  )}
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <a 
                      href={getWhatsAppLink(selectedProduct.name, selectedProduct.images[currentImageIndex])} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="flex-1 bg-royal-gold text-royal-bg py-4 px-6 rounded-sm font-bold text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-white transition-colors"
                    >
                      <MessageCircle size={18}/> WHATSAPP INQUIRY
                    </a>
                    {selectedProduct.externalLink && (
                      <button 
                        onClick={() => {
                          setModalIframeUrl(selectedProduct.externalLink);
                          setIsLookbookModalOpen(true);
                        }}
                        className="flex-1 border-2 border-royal-gold text-royal-gold py-4 px-6 rounded-sm font-bold text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-royal-gold hover:text-royal-bg transition-colors"
                      >
                        <LinkIcon size={18}/> MORE PHOTOS
                      </button>
                    )}
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
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={() => setIsSettingsModalOpen(true)}
                      className="text-xs font-bold tracking-widest text-royal-muted hover:text-royal-gold transition-colors flex items-center gap-2"
                    >
                      <Settings size={14} /> SETTINGS
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="text-xs font-bold tracking-widest text-royal-muted hover:text-red-400 transition-colors flex items-center gap-2"
                    >
                      <Lock size={14} /> LOGOUT
                    </button>
                  </div>
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
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold tracking-wider text-royal-muted uppercase">External Link (Google Drive, Dropbox, etc. for more photos)</label>
                    <input 
                      className="w-full p-4 bg-royal-bg border border-royal-border text-royal-text rounded-sm focus:outline-none focus:border-royal-gold transition-colors placeholder:text-royal-muted/50" 
                      placeholder="https://drive.google.com/..." 
                      value={form.externalLink} 
                      onChange={e => setForm({...form, externalLink: e.target.value})} 
                    />
                  </div>

                  <div className="md:col-span-2 p-8 border-2 border-dashed border-royal-border rounded-lg bg-royal-bg text-center">
                    <div className="flex flex-col items-center gap-6">
                      <div className="flex flex-col items-center gap-3 w-full">
                        <input type="file" multiple hidden id="up" onChange={handleImageUpload} accept="image/*" />
                        <label htmlFor="up" className="cursor-pointer flex flex-col items-center gap-3 text-royal-muted hover:text-royal-gold transition-colors">
                          <Camera size={40} className="text-royal-gold/70" />
                          <span className="text-xs font-bold tracking-widest uppercase">Click to Upload Photos</span>
                        </label>
                        <p className="text-[10px] text-royal-muted/70 max-w-sm text-center mt-1">
                          Photos are automatically optimized for HD clarity while staying under the database size limit.
                        </p>
                      </div>

                      <div className="w-full max-w-md flex items-center gap-4">
                        <div className="h-px bg-royal-border flex-1"></div>
                        <span className="text-xs font-bold text-royal-muted uppercase">OR</span>
                        <div className="h-px bg-royal-border flex-1"></div>
                      </div>

                      <div className="flex flex-col items-center gap-3 w-full">
                        <span className="text-xs font-bold tracking-widest uppercase text-royal-muted">Add Image URLs (e.g., GitHub, Imgur)</span>
                        <p className="text-[10px] text-royal-muted/70 max-w-sm text-center mb-1">
                          For 100% uncompressed original clarity, paste direct links here.
                        </p>
                        <div className="flex w-full max-w-md gap-2">
                          <input 
                            type="url"
                            id="imageUrlInput"
                            placeholder="https://raw.githubusercontent.com/..."
                            className="flex-1 p-3 bg-royal-surface border border-royal-border text-royal-text rounded-sm focus:outline-none focus:border-royal-gold transition-colors text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const input = e.currentTarget;
                                if (input.value) {
                                  setForm(f => ({ ...f, images: [...f.images, input.value] }));
                                  input.value = '';
                                }
                              }
                            }}
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              const input = document.getElementById('imageUrlInput') as HTMLInputElement;
                              if (input && input.value) {
                                setForm(f => ({ ...f, images: [...f.images, input.value] }));
                                input.value = '';
                              }
                            }}
                            className="px-4 bg-royal-gold text-royal-bg font-bold text-xs tracking-widest rounded-sm hover:bg-white transition-colors"
                          >
                            ADD
                          </button>
                        </div>
                      </div>
                    </div>
                    
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
                            <img src={img} className="h-24 w-auto object-contain rounded-sm border border-royal-border shadow-sm bg-royal-surface" alt="Upload preview" />
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
                        setForm({ name: "", category: "Ladies", desc: "", images: [], externalLink: "" });
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
                            {p.images[0] && <img src={p.images[0]} className="w-12 h-12 object-contain bg-royal-surface rounded-sm border border-royal-border" alt={p.name} /> }
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

        {/* --- LOOKBOOK MODAL --- */}
        <AnimatePresence>
          {isLookbookModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            >
              <div className="bg-royal-surface w-full max-w-6xl h-[80vh] md:h-[90vh] rounded-xl shadow-2xl border border-royal-border flex flex-col overflow-hidden relative">
                <div className="flex justify-between items-center p-4 border-b border-royal-border bg-royal-bg">
                  <h3 className="font-serif text-xl text-royal-text flex items-center gap-2">
                    <ImageIcon size={20} className="text-royal-gold" /> Exclusive Lookbook
                  </h3>
                  <button 
                    onClick={() => setIsLookbookModalOpen(false)}
                    className="p-2 bg-royal-surface rounded-full text-royal-muted hover:text-white hover:bg-red-500/20 transition-colors border border-royal-border"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 w-full bg-black relative">
                  {modalIframeUrl ? (
                    <iframe 
                      src={modalIframeUrl} 
                      className="w-full h-full border-0" 
                      title="Exclusive Lookbook"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-royal-muted">
                      No lookbook URL configured.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- SETTINGS MODAL --- */}
        <AnimatePresence>
          {isSettingsModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div className="bg-royal-surface p-8 rounded-xl shadow-2xl max-w-md w-full border border-royal-border">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-serif text-2xl text-royal-text">Global Settings</h3>
                  <button 
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="p-2 hover:bg-royal-bg rounded-full text-royal-muted transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="text-xs font-bold tracking-wider text-royal-muted uppercase mb-2 block">Lookbook URL (Google Drive, Pinterest, etc.)</label>
                    <input 
                      type="url"
                      className="w-full p-4 bg-royal-bg border border-royal-border text-royal-text rounded-sm focus:outline-none focus:border-royal-gold transition-colors placeholder:text-royal-muted/50" 
                      placeholder="https://drive.google.com/..." 
                      defaultValue={lookbookUrl}
                      id="lookbookUrlInput"
                    />
                    <p className="text-[10px] text-royal-muted mt-2">
                      This link will be embedded in the "Explore Exclusive Lookbook" popup. Use a public Google Drive folder embed link or Pinterest board link for free storage.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const el = document.getElementById('lookbookUrlInput') as HTMLInputElement;
                    if (el) saveSettings(el.value);
                  }}
                  className="w-full py-4 bg-royal-gold text-royal-bg font-bold tracking-widest text-xs rounded-sm hover:bg-white transition-colors"
                >
                  SAVE SETTINGS
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* --- PREMIUM FOOTER --- */}
      <footer className="bg-[#050505] border-t border-royal-border pt-16 pb-8 px-6 md:px-12 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          <div>
            <h3 className="font-serif text-2xl font-bold tracking-wide text-royal-text mb-4">
              COSMO <span className="text-royal-gold italic font-normal">Fibres</span>
            </h3>
            <p className="text-royal-muted text-sm leading-relaxed max-w-xs">
              Kerala's premier manufacturer of high-quality fiberglass mannequins and display solutions since 1998.
            </p>
          </div>
          <div>
            <h4 className="text-royal-gold text-xs font-bold tracking-[0.2em] uppercase mb-4">Contact</h4>
            <ul className="text-royal-muted text-sm space-y-3">
              <li className="flex items-center gap-2"><Phone size={14} className="text-royal-gold"/> {DISPLAY_PHONE}</li>
              <li className="flex items-center gap-2"><MapPin size={14} className="text-royal-gold"/> Puthiyara & Pavangadu</li>
              <li className="flex items-center gap-2 text-transparent select-none"><MapPin size={14}/> Kozhikode, Kerala 673004</li>
            </ul>
          </div>
          <div>
            <h4 className="text-royal-gold text-xs font-bold tracking-[0.2em] uppercase mb-4">Quick Links</h4>
            <ul className="text-royal-muted text-sm space-y-3">
              <li><button onClick={() => { window.scrollTo(0,0); navigateTo("collection"); }} className="hover:text-royal-gold transition-colors">View Collection</button></li>
              <li><button onClick={() => { window.scrollTo(0,0); setShowPasscodeModal(true); }} className="hover:text-royal-gold transition-colors">Staff Portal</button></li>
              <li><a href={getWhatsAppLink("General Enquiry", "")} target="_blank" rel="noreferrer" className="hover:text-royal-gold transition-colors">WhatsApp Support</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-royal-border/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-royal-muted/50 tracking-widest">
          <p>&copy; {new Date().getFullYear()} Cosmo Fibres. All rights reserved.</p>
          <p>DESIGNED FOR EXCELLENCE.</p>
        </div>
      </footer>
    </div>
  );
}
