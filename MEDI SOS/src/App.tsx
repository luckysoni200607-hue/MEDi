import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertCircle, 
  Phone, 
  Users, 
  MapPin, 
  Settings, 
  LogOut, 
  Plus, 
  Trash2, 
  ShieldAlert,
  Navigation,
  Activity,
  Hospital,
  Share2
} from 'lucide-react';
import { auth, signInWithGoogle, logout } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  userService, 
  contactService, 
  alertService, 
  EmergencyContact, 
  EmergencyAlert 
} from './services/dbService';

// --- Components ---

const Button = ({ children, onClick, className = '', variant = 'primary', disabled = false, icon: Icon }: any) => {
  const variants = {
    primary: 'bg-red-600 text-white hover:bg-red-700',
    secondary: 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50',
    ghost: 'bg-transparent text-gray-500 hover:text-red-600 hover:bg-red-50',
    danger: 'bg-red-100 text-red-600 hover:bg-red-200',
  };
  
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 ${variants[variant as keyof typeof variants]} ${className}`}
    >
      {Icon && <Icon size={20} />}
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }: any) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 ${className}`}>
    {children}
  </div>
);

// --- Pages ---

const LoginPage = () => (
  <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_#fff5f5_0%,_transparent_50%)]">
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="w-full max-w-sm text-center"
    >
      <div className="bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
        <ShieldAlert className="text-red-600" size={40} />
      </div>
      <h1 className="text-4xl font-bold text-gray-900 mb-2 font-sans tracking-tight">MedSOS India</h1>
      <p className="text-gray-500 mb-12">One tap to save a life. Anytime, anywhere.</p>
      
      <Button 
        variant="secondary"
        className="w-full h-14 text-lg border-2"
        onClick={signInWithGoogle}
      >
        <img src="https://www.google.com/favicon.ico" className="w-5 h-5 mr-2" alt="Google" />
        Continue with Google
      </Button>
      
      <p className="mt-8 text-xs text-gray-400">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </motion.div>
  </div>
);

const Dashboard = ({ user, onTabChange }: { user: User, onTabChange: (t: string) => void }) => {
  const [isAlerting, setIsAlerting] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const holdTimer = useRef<number | null>(null);
  const watchId = useRef<number | null>(null);
  const trackerId = useRef<number | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Subscribe to contacts for SOS notifications
    const unsub = contactService.getContacts(user.uid, (data) => setContacts(data));
    
    // Setup audio
    audioRef.current = new Audio('https://actions.google.com/sounds/v1/emergency/ambulance_siren.ogg');
    audioRef.current.loop = true;
    
    return () => {
      unsub();
      audioRef.current?.pause();
    };
  }, [user.uid]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (isTracking && !isAlerting) {
      trackerId.current = window.setInterval(() => {
        navigator.geolocation.getCurrentPosition((p) => {
          setLocation({ lat: p.coords.latitude, lng: p.coords.longitude });
          // In a full implementation, we'd update a 'lastSeen' field here
        });
      }, 30000); // Update every 30s in tracking mode
    } else {
      if (trackerId.current) clearInterval(trackerId.current);
    }
    return () => { if (trackerId.current) clearInterval(trackerId.current); };
  }, [isTracking, isAlerting]);

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent double firing on mobile
    if (e.type === 'touchstart') e.preventDefault();
    
    if (isAlerting) {
        stopSOS();
        return;
    }
    
    let elapsed = 0;
    const duration = 2000;
    const interval = 30;
    
    holdTimer.current = window.setInterval(() => {
        elapsed += interval;
        setHoldProgress(Math.min((elapsed / duration) * 100, 100));
        
        if (elapsed >= duration) {
            if (holdTimer.current) clearInterval(holdTimer.current);
            startSOS();
            setHoldProgress(0);
        }
    }, interval);
  };

  const handlePressEnd = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    setHoldProgress(0);
  };

  const getSMSMessage = (lat: number, lng: number) => {
    return `SOS! ${user.displayName} needs help. Live Location: https://www.google.com/maps?q=${lat},${lng}`;
  };

  const triggerSMS = (phoneNumber: string) => {
    if (!location) return;
    const body = encodeURIComponent(getSMSMessage(location.lat, location.lng));
    window.location.href = `sms:${phoneNumber}?body=${body}`;
  };

  const shareLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'MedSOS India Alert',
            text: `I need help! ${user.displayName}'s live location:`,
            url: mapsLink,
          });
        } catch (err) {
          console.error("Share failed", err);
        }
      } else {
        await navigator.clipboard.writeText(mapsLink);
        alert("Location link copied to clipboard!");
      }
    });
  };

  const startSOS = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsAlerting(true);
    if (!isMuted) {
        audioRef.current?.play().catch(e => console.log("Audio play failed, user interaction needed"));
    }
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setLocation({ lat, lng });

      const alertId = await alertService.triggerAlert({
        userId: user.uid,
        userName: user.displayName || 'Unknown User',
        status: 'active',
        latitude: lat,
        longitude: lng
      });
      
      if (alertId) setActiveAlertId(alertId);

      // Start continuous updates every 10s
      watchId.current = window.setInterval(() => {
        navigator.geolocation.getCurrentPosition((p) => {
          const nLat = p.coords.latitude;
          const nLng = p.coords.longitude;
          setLocation({ lat: nLat, lng: nLng });
          if (alertId) alertService.updateAlertLocation(alertId, nLat, nLng);
        });
      }, 10000);
    }, (err) => {
      console.error(err);
      setIsAlerting(false);
      audioRef.current?.pause();
    });
  };

  const stopSOS = async () => {
    setIsAlerting(false);
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (watchId.current) clearInterval(watchId.current);
    if (activeAlertId) {
      await alertService.resolveAlert(activeAlertId);
    }
    setActiveAlertId(null);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Hello, {user.displayName?.split(' ')[0]}</h2>
          <p className="text-sm text-gray-500">Stay safe today.</p>
        </div>
        <button onClick={() => onTabChange('profile')} className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border-2 border-white shadow-sm">
          <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Profile" />
        </button>
      </header>

      <Card className="bg-gradient-to-br from-red-600 to-red-700 text-white border-0 shadow-lg p-6 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4 opacity-90">
            <ShieldAlert size={20} />
            <span className="text-sm font-medium uppercase tracking-wider">Emergency Center</span>
          </div>
          
          <div className="flex flex-col items-center py-8">
            <div className="relative">
                {/* Progress Ring */}
                {!isAlerting && holdProgress > 0 && (
                    <svg className="absolute -inset-4 w-[calc(100%+32px)] h-[calc(100%+32px)] -rotate-90">
                        <circle
                            cx="50%"
                            cy="50%"
                            r="48%"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="8"
                        />
                        <circle
                            cx="50%"
                            cy="50%"
                            r="48%"
                            fill="none"
                            stroke="white"
                            strokeWidth="8"
                            strokeDasharray="100"
                            strokeDashoffset={100 - holdProgress}
                            pathLength="100"
                            strokeLinecap="round"
                            className="transition-all duration-75"
                        />
                    </svg>
                )}

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  animate={isAlerting ? { scale: [1, 1.1, 1], transition: { repeat: Infinity, duration: 1.5 } } : {}}
                  onMouseDown={handlePressStart}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={handlePressStart}
                  onTouchEnd={handlePressEnd}
                  className={`w-40 h-40 rounded-full border-[10px] flex flex-col items-center justify-center transition-colors shadow-2xl relative z-10 select-none ${
                    isAlerting ? 'bg-white text-red-600 border-red-400' : 'bg-red-500 text-white border-red-400'
                  }`}
                >
                  <AlertCircle size={48} className="mb-2" />
                  <span className="text-2xl font-black uppercase tracking-tighter">
                    {isAlerting ? 'STOP' : holdProgress > 0 ? `${Math.ceil(3 - (holdProgress/100)*3)}s` : 'SOS'}
                  </span>
                </motion.button>
            </div>
            
            {isAlerting && (
                <div className="flex flex-col items-center gap-4 mt-6">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/20">
                        <motion.div 
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="w-2 h-2 bg-red-400 rounded-full" 
                        />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-red-100">Live GPS Alert Active</span>
                    </div>

                    <button 
                        onClick={() => setIsMuted(!isMuted)}
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl transition-colors"
                    >
                        {isMuted ? <Phone size={18} className="rotate-45" /> : <Activity size={18} />}
                        <span className="text-xs font-bold uppercase tracking-wider">
                            {isMuted ? 'Unmute Siren' : 'Mute Siren'}
                        </span>
                    </button>

                    <button 
                        onClick={shareLocation}
                        className="flex items-center gap-2 bg-red-400 hover:bg-red-300 px-4 py-2 rounded-xl transition-colors"
                    >
                        <Share2 size={18} />
                        <span className="text-xs font-bold uppercase tracking-wider">
                            Manual Share Link
                        </span>
                    </button>

                    {contacts.length > 0 && (
                        <div className="w-full mt-4 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-200 text-center mb-2">Notify Emergency Contacts</p>
                            {contacts.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => triggerSMS(c.phoneNumber)}
                                    className="w-full flex items-center justify-between border border-white/20 bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                            <Phone size={14} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs font-bold">{c.name}</p>
                                            <p className="text-[10px] opacity-70">{c.phoneNumber}</p>
                                        </div>
                                    </div>
                                    <Share2 size={14} className="opacity-50" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {isAlerting && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0.5 }}
                        animate={{ scale: 2.5, opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-40 h-40 bg-white/20 rounded-full"
                    />
                </div>
            )}
          </div>

          <p className="text-center text-red-100 text-sm mt-4 font-medium">
            {isAlerting ? 'Updating location every 10s...' : 'Press for 3 seconds in emergency'}
          </p>
        </div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card onClick={() => onTabChange('contacts')} className="cursor-pointer hover:border-red-200 transition-colors group">
          <div className="bg-orange-50 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-orange-100 transition-colors">
            <Users className="text-orange-600" size={20} />
          </div>
          <h3 className="font-bold text-gray-900">Family</h3>
          <p className="text-xs text-gray-500">Emergency Contacts</p>
        </Card>
        <Card onClick={shareLocation} className="cursor-pointer hover:border-red-200 transition-colors group">
          <div className="bg-green-50 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-green-100 transition-colors">
            <Share2 className="text-green-600" size={20} />
          </div>
          <h3 className="font-bold text-gray-900">Quick Share</h3>
          <p className="text-xs text-gray-500">Send Location Link</p>
        </Card>
        <Card 
          onClick={() => setIsTracking(!isTracking)} 
          className={`cursor-pointer transition-colors group ${isTracking ? 'bg-blue-50 border-blue-200' : 'hover:border-blue-200'}`}
        >
          <div className={`${isTracking ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'} w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors`}>
            <Navigation size={20} />
          </div>
          <h3 className="font-bold text-gray-900">Location</h3>
          <p className="text-xs text-gray-500">{isTracking ? 'Tracking ON' : 'Turn ON Tracking'}</p>
        </Card>
        <Card onClick={() => onTabChange('map')} className="cursor-pointer hover:border-red-200 transition-colors group">
          <div className="bg-purple-50 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-purple-100 transition-colors">
            <Hospital className="text-purple-600" size={20} />
          </div>
          <h3 className="font-bold text-gray-900">Near Help</h3>
          <p className="text-xs text-gray-500">Hospitals & More</p>
        </Card>
      </div>

    </div>
  );
};

const ContactsScreen = ({ user }: { user: User }) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    const unsub = contactService.getContacts(user.uid, (data) => setContacts(data));
    return () => unsub();
  }, [user.uid]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) return;
    await contactService.addContact({
      name: newName,
      phoneNumber: newPhone,
      userId: user.uid
    });
    setNewName('');
    setNewPhone('');
    setShowAdd(false);
  };

  const handleDelete = async (contactId: string) => {
    if (confirm("Remove this emergency contact?")) {
      await contactService.deleteContact(user.uid, contactId);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Emergency Contacts</h2>
        <Button onClick={() => setShowAdd(true)} variant="secondary" className="px-3 py-2 rounded-lg text-sm">
          <Plus size={18} /> Add
        </Button>
      </div>

      <p className="text-sm text-gray-500 -mt-2">
        These people will receive an SMS and your live location link if you trigger an SOS.
      </p>

      <div className="space-y-4">
        {contacts.map((c) => (
          <Card key={c.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <Users className="text-red-500" size={24} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{c.name}</h4>
                <p className="text-sm text-gray-500">{c.phoneNumber}</p>
              </div>
            </div>
            <button onClick={() => handleDelete(c.id!)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 size={20} />
            </button>
          </Card>
        ))}
        
        {contacts.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Users className="mx-auto mb-2 opacity-50" size={40} />
            <p>No contacts added yet.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-6">New Emergency Contact</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Full Name</label>
                  <input 
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    type="text" 
                    placeholder="e.g. Papa" 
                    className="w-full h-12 px-4 rounded-xl border-2 border-gray-100 focus:border-red-500 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Phone Number</label>
                  <input 
                    required
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    type="tel" 
                    placeholder="+91 98XXX XXXXX" 
                    className="w-full h-12 px-4 rounded-xl border-2 border-gray-100 focus:border-red-500 outline-none transition-colors"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" onClick={() => setShowAdd(false)} variant="secondary" className="flex-1">Cancel</Button>
                  <Button type="submit" variant="primary" className="flex-1">Save Contact</Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MapScreen = () => {
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // In a real app with Maps API activated:
        // Use Google Places API to find hospitals near current location.
        // Here we simulate finding nearby facilities in Indian cities for demo.
        navigator.geolocation.getCurrentPosition((pos) => {
            // For demo purposes, we usually just open Google Maps link directly
            // or show a list of nearby hospitals using a public API.
            setLoading(false);
        }, () => setLoading(false));
    }, []);

    const openInMaps = (query: string) => {
        window.open(`https://www.google.com/maps/search/${query}`, '_blank');
    };

    return (
        <div className="flex flex-col h-full gap-6">
            <h2 className="text-2xl font-bold text-gray-900">Nearby Help</h2>
            
            <div className="grid grid-cols-1 gap-4">
                <Card className="flex items-center gap-4 p-4 border-2 border-blue-50 bg-blue-50/20">
                    <div className="bg-blue-600 p-3 rounded-xl text-white">
                        <Hospital size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-900">Hospitals</h4>
                        <p className="text-xs text-blue-600 font-medium">Find emergency medical care</p>
                    </div>
                    <Button variant="secondary" className="px-4 py-2 text-xs" onClick={() => openInMaps('Hospitals near me')}>
                        Explore
                    </Button>
                </Card>

                <Card className="flex items-center gap-4 p-4 border-2 border-red-50 bg-red-50/20">
                    <div className="bg-red-600 p-3 rounded-xl text-white">
                        <Phone size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-900">Emergency Numbers</h4>
                        <p className="text-xs text-red-600 font-medium">Ambulance (102), Police (100)</p>
                    </div>
                    <Button variant="secondary" className="px-4 py-2 text-xs" onClick={() => window.location.href = 'tel:112'}>
                        Call 112
                    </Button>
                </Card>

                <Card className="flex items-center gap-4 p-4 border-2 border-orange-50 bg-orange-50/20">
                    <div className="bg-orange-600 p-3 rounded-xl text-white">
                        <Navigation size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-900">Ambulance Services</h4>
                        <p className="text-xs text-orange-600 font-medium">Nearby emergency vehicles</p>
                    </div>
                    <Button variant="secondary" className="px-4 py-2 text-xs" onClick={() => openInMaps('Ambulance services near me')}>
                        Search
                    </Button>
                </Card>
            </div>

            <div className="mt-4 flex-1 bg-gray-100 rounded-3xl flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200">
                <MapPin className="text-gray-400 mb-4" size={48} />
                <h3 className="font-bold text-gray-600">Map View Integrated</h3>
                <p className="text-sm text-gray-400">In this browser preview, you can browse nearby facilities by clicking the buttons above.</p>
            </div>
        </div>
    );
};

const ProfileScreen = ({ user }: { user: User }) => (
    <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        
        <Card className="flex flex-col items-center py-8">
            <div className="w-24 h-24 rounded-full bg-red-50 border-4 border-white shadow-md overflow-hidden mb-4">
                <img src={user.photoURL || ''} className="w-full h-full object-cover" />
            </div>
            <h3 className="font-bold text-xl">{user.displayName}</h3>
            <p className="text-gray-500 text-sm mb-6">{user.email}</p>
            
            <div className="w-full space-y-2">
                <Button variant="secondary" className="w-full justify-start border-0 bg-transparent text-gray-600" icon={Activity}>Health Stats</Button>
                <Button variant="secondary" className="w-full justify-start border-0 bg-transparent text-gray-600" icon={ShieldAlert}>Privacy Rules</Button>
                <div className="h-px bg-gray-100 my-2" />
                <Button 
                    onClick={logout}
                    variant="ghost" 
                    className="w-full justify-start text-red-600" 
                    icon={LogOut}
                >
                    Sign Out
                </Button>
            </div>
        </Card>
    </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        userService.saveProfile({
          uid: u.uid,
          email: u.email!,
          displayName: u.displayName!,
          photoURL: u.photoURL || undefined
        });
      }
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        <ShieldAlert className="text-red-600" size={48} />
      </motion.div>
    </div>
  );

  if (!user) return <LoginPage />;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-red-100 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl bg-white border-x border-gray-100">
      <main className="flex-1 overflow-y-auto p-6 pb-24 scroll-smooth">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === 'home' && <Dashboard user={user} onTabChange={setActiveTab} />}
            {activeTab === 'contacts' && <ContactsScreen user={user} />}
            {activeTab === 'map' && <MapScreen />}
            {activeTab === 'profile' && <ProfileScreen user={user} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-xl border-t border-gray-100 px-8 py-4 flex justify-between items-center z-40">
        {[
          { id: 'home', icon: ShieldAlert, label: 'SOS' },
          { id: 'map', icon: MapPin, label: 'Help' },
          { id: 'contacts', icon: Users, label: 'Family' },
          { id: 'profile', icon: Settings, label: 'User' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === tab.id ? 'text-red-600 scale-110' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div layoutId="tab" className="w-1.5 h-1.5 bg-red-600 rounded-full mt-0.5" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
