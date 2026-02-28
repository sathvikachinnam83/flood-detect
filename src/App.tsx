import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Droplets, 
  Mountain, 
  MapPin, 
  AlertTriangle, 
  Activity, 
  Navigation, 
  Waves, 
  Info,
  Thermometer,
  Wind,
  Search,
  LocateFixed,
  RefreshCw
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from "react-leaflet";
import L from "leaflet";

// Fix for default marker icon in Leaflet
// @ts-ignore
import markerIcon from "leaflet/dist/images/marker-icon.png";
// @ts-ignore
import markerShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface PredictionResult {
  prediction: string;
  probability: string;
  riskLevel: "High" | "Medium" | "Low";
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, 13);
  return null;
}

export default function App() {
  const [location, setLocation] = useState<{ lat: number; lng: number }>({ lat: 27.7172, lng: 85.3240 }); // Default Kathmandu
  const [searchQuery, setSearchQuery] = useState("");
  const [inputs, setInputs] = useState({
    rainfall: "0",
    altitude: "0",
    areaElevation: "0",
    roadElevation: "0",
    drainageSystem: "Good",
  });
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);

  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchAutoData = useCallback(async (lat: number, lng: number) => {
    setFetchingData(true);
    try {
      const response = await fetch(`/api/environmental-data?lat=${lat}&lng=${lng}`);
      if (!response.ok) throw new Error("Server failed to fetch environmental data");
      const data = await response.json();

      setInputs(prev => ({
        ...prev,
        rainfall: data.rainfall,
        altitude: data.altitude,
        areaElevation: data.areaElevation,
        roadElevation: data.roadElevation,
      }));
      setLastUpdated(new Date().toLocaleString());
      localStorage.setItem("raute_hudra_last_loc", JSON.stringify({ lat, lng, time: Date.now() }));
    } catch (error) {
      console.error("Failed to fetch auto data:", error);
      setInputs(prev => ({
        ...prev,
        rainfall: (Math.random() * 50).toFixed(1),
        altitude: (Math.random() * 100).toFixed(1),
        areaElevation: (Math.random() * 100).toFixed(1),
        roadElevation: (Math.random() * 100).toFixed(1),
      }));
    } finally {
      setFetchingData(false);
    }
  }, []);

  const handleEnableLocation = useCallback(() => {
    if ("geolocation" in navigator) {
      // Use fast positioning first, then high accuracy if needed
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(newLoc);
          fetchAutoData(newLoc.lat, newLoc.lng);
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert("Please enable location permissions in your browser settings.");
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, [fetchAutoData]);

  // Auto-enable on mount if we have stored data or if it's a new day
  useEffect(() => {
    const stored = localStorage.getItem("raute_hudra_last_loc");
    if (stored) {
      const { lat, lng, time } = JSON.parse(stored);
      setLocation({ lat, lng });
      
      // If it's been more than 1 hour, refresh
      if (Date.now() - time > 3600000) {
        handleEnableLocation();
      } else {
        fetchAutoData(lat, lng);
      }
    } else {
      // First time use: try to get location automatically
      handleEnableLocation();
    }
  }, []);
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const newLoc = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        setLocation(newLoc);
        fetchAutoData(newLoc.lat, newLoc.lng);
      }
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  const handlePredict = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Prediction failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E4E3E0] font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800 p-4 flex justify-between items-center bg-[#0A0A0A]/80 backdrop-blur-md sticky top-0 z-[1000]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Activity className="text-black w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight uppercase italic font-serif">Crowd Hydra</h1>
            <p className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-mono">Smart Urban Flood Prediction</p>
          </div>
        </div>
        
        <form onSubmit={handleSearch} className="hidden md:flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 focus-within:border-emerald-500/50 transition-all">
          <Search className="w-4 h-4 text-zinc-500 mr-2" />
          <input 
            type="text" 
            placeholder="Search location..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none focus:outline-none text-sm w-64"
          />
        </form>

        <button 
          onClick={handleEnableLocation}
          className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all"
        >
          <LocateFixed className="w-4 h-4 text-emerald-500" />
          Enable Location
        </button>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Sidebar Controls */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Environmental Data</h2>
              <button onClick={() => fetchAutoData(location.lat, location.lng)} className={`p-1 hover:bg-zinc-800 rounded transition-all ${fetchingData ? 'animate-spin' : ''}`}>
                <RefreshCw className="w-3 h-3 text-emerald-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                  <Droplets className="w-3 h-3" /> Rainfall (mm)
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={inputs.rainfall}
                    onChange={(e) => setInputs({...inputs, rainfall: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                  />
                  {fetchingData && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-wider text-zinc-500">Altitude (m)</label>
                  <input 
                    type="number" 
                    value={inputs.altitude}
                    onChange={(e) => setInputs({...inputs, altitude: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-wider text-zinc-500">Drainage System</label>
                  <select 
                    value={inputs.drainageSystem}
                    onChange={(e) => setInputs({...inputs, drainageSystem: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="Fair">Fair</option>
                    <option value="Good">Good</option>
                    <option value="Very Good">Very Good</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-wider text-zinc-500">Area Elev.</label>
                  <input 
                    type="number" 
                    value={inputs.areaElevation}
                    onChange={(e) => setInputs({...inputs, areaElevation: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-wider text-zinc-500">Road Elev.</label>
                  <input 
                    type="number" 
                    value={inputs.roadElevation}
                    onChange={(e) => setInputs({...inputs, roadElevation: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <button 
                onClick={handlePredict}
                disabled={loading || fetchingData}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-[10px]"
              >
                {loading ? "Processing..." : "Run Analysis"}
              </button>
            </div>
          </div>

          {/* Telemetry */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-4">GIS Telemetry</h3>
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-600">LAT</span>
                <span>{location.lat.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">LNG</span>
                <span>{location.lng.toFixed(6)}</span>
              </div>
              {lastUpdated && (
                <div className="pt-2 border-t border-zinc-800 mt-2 text-[8px] text-zinc-600 font-mono uppercase tracking-widest text-right">
                  Last Sync: {lastUpdated}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="lg:col-span-9 space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Map View Split */}
            <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 h-[500px]">
              {/* Location Pane */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden relative z-0">
                <div className="absolute top-3 left-3 z-[1000] bg-zinc-950/80 backdrop-blur border border-zinc-800 px-2 py-1 rounded text-[8px] font-mono uppercase tracking-widest text-emerald-500">
                  Location View
                </div>
                <MapContainer 
                  center={[location.lat, location.lng]} 
                  zoom={13} 
                  className="w-full h-full"
                  zoomControl={false}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  <ChangeView center={[location.lat, location.lng]} />
                  <Marker position={[location.lat, location.lng]}>
                    <Popup>Analysis Target Location</Popup>
                  </Marker>
                </MapContainer>
              </div>

              {/* Heatmap Pane */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden relative z-0">
                <div className="absolute top-3 left-3 z-[1000] bg-zinc-950/80 backdrop-blur border border-zinc-800 px-2 py-1 rounded text-[8px] font-mono uppercase tracking-widest text-orange-500">
                  Risk Heatmap
                </div>
                <MapContainer 
                  center={[location.lat, location.lng]} 
                  zoom={13} 
                  className="w-full h-full"
                  zoomControl={false}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  <ChangeView center={[location.lat, location.lng]} />
                  
                  {/* Heatmap Simulation */}
                  {result && (
                    <Circle 
                      center={[location.lat, location.lng]}
                      radius={1500}
                      pathOptions={{ 
                        fillColor: result.riskLevel === 'High' ? '#ef4444' : result.riskLevel === 'Medium' ? '#f97316' : '#10b981',
                        color: 'transparent',
                        fillOpacity: 0.6
                      }}
                    />
                  )}
                </MapContainer>
                
                {/* Map Overlay Controls */}
                <div className="absolute bottom-4 right-4 z-[1000]">
                  <div className="bg-zinc-900/90 backdrop-blur border border-zinc-800 p-2 rounded-lg shadow-xl">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[8px] uppercase">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full" /> High
                      </div>
                      <div className="flex items-center gap-2 text-[8px] uppercase">
                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" /> Med
                      </div>
                      <div className="flex items-center gap-2 text-[8px] uppercase">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Low
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis Result */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 flex flex-col justify-center items-center text-center relative overflow-hidden">
              <AnimatePresence mode="wait">
                {!result ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <Activity className="w-12 h-12 text-zinc-800 mx-auto animate-pulse" />
                    <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">Awaiting Analysis...</p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full space-y-6"
                  >
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-zinc-500">Prediction Outcome</span>
                      <h2 className={`text-4xl font-black uppercase italic font-serif ${result.riskLevel === 'High' ? 'text-red-500' : result.riskLevel === 'Medium' ? 'text-orange-500' : 'text-emerald-500'}`}>
                        {result.prediction}
                      </h2>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl">
                        <span className="text-[9px] text-zinc-500 block mb-1 uppercase tracking-widest">Probability</span>
                        <div className="text-3xl font-mono font-bold">{result.probability}%</div>
                      </div>
                      
                      <div className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl">
                        <span className="text-[9px] text-zinc-500 block mb-1 uppercase tracking-widest">Risk Classification</span>
                        <div className={`text-xl font-mono font-bold ${result.riskLevel === 'High' ? 'text-red-500' : result.riskLevel === 'Medium' ? 'text-orange-500' : 'text-emerald-500'}`}>
                          {result.riskLevel}
                        </div>
                      </div>
                    </div>

                    {result.riskLevel === "High" && (
                      <motion.div 
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl flex items-center gap-3"
                      >
                        <AlertTriangle className="w-6 h-6 shrink-0" />
                        <div className="text-left">
                          <h4 className="text-sm font-bold uppercase italic font-serif">EVACUATE</h4>
                          <p className="text-[8px] uppercase tracking-wider">Critical risk detected. Follow safety protocols.</p>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Background Grid Accent */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
                <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(#E4E3E0 1px, transparent 1px)', backgroundSize: '15px 15px' }} />
              </div>
            </div>
          </div>

          {/* Bottom Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-950 rounded-lg flex items-center justify-center border border-zinc-800">
                <Thermometer className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <span className="text-[8px] text-zinc-500 block uppercase tracking-widest">Ambient</span>
                <div className="text-sm font-mono">24.5°C</div>
              </div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-950 rounded-lg flex items-center justify-center border border-zinc-800">
                <Wind className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <span className="text-[8px] text-zinc-500 block uppercase tracking-widest">Wind</span>
                <div className="text-sm font-mono">12.4 km/h</div>
              </div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-950 rounded-lg flex items-center justify-center border border-zinc-800">
                <Waves className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <span className="text-[8px] text-zinc-500 block uppercase tracking-widest">Humidity</span>
                <div className="text-sm font-mono">68%</div>
              </div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-950 rounded-lg flex items-center justify-center border border-zinc-800">
                <Navigation className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <span className="text-[8px] text-zinc-500 block uppercase tracking-widest">Status</span>
                <div className="text-sm font-mono">Active</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="max-w-[1600px] mx-auto p-4 border-t border-zinc-800 mt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
        <div>© 2026 Crowd Hydra Systems • Urban Flood Defense Division</div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-emerald-500 transition-colors">GIS Protocols</a>
          <a href="#" className="hover:text-emerald-500 transition-colors">ML Engine v2.4</a>
          <a href="#" className="hover:text-emerald-500 transition-colors">Emergency Node</a>
        </div>
      </footer>
    </div>
  );
}
