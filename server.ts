import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import { RandomForestClassifier } from "ml-random-forest";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Simple synthetic training data for the Random Forest
// Features: [Rainfall (mm), Altitude (m), Area Elevation (m), Road Elevation (m), Drainage System (1=Fair, 2=Good, 3=Very Good)]
// Labels: 0 = No Flood, 1 = Flood
const trainingData = [
  [50, 100, 50, 52, 3], [0, 0], // Very Good drainage system, high altitude -> No flood
  [200, 5, 2, 1, 1], [1, 1],    // Fair drainage system, low altitude, high rain -> Flood
  [150, 10, 5, 4, 1], [1, 1],   // Fair drainage system -> Flood
  [20, 200, 150, 152, 3], [0, 0],
  [300, 2, 1, 1, 1], [1, 1],
  [80, 50, 20, 22, 2], [0, 0],
  [120, 15, 8, 7, 2], [0, 1], 
  [180, 8, 4, 3, 1], [1, 1],
  [40, 120, 80, 82, 3], [0, 0],
  [250, 5, 3, 2, 1], [1, 1],
  [60, 40, 15, 16, 2], [0, 0],
  [220, 12, 6, 5, 1], [1, 1],
  [10, 300, 250, 252, 3], [0, 0],
  [100, 20, 10, 11, 2], [0, 0],
  [140, 18, 9, 8, 1], [0, 1],
];

const X = trainingData.filter((_, i) => i % 2 === 0);
const y = trainingData.filter((_, i) => i % 2 !== 0).map(l => l[0]);

const rf = new RandomForestClassifier({
  nEstimators: 50,
});

rf.train(X, y);

app.post("/api/predict", (req, res) => {
  try {
    const { rainfall, altitude, areaElevation, roadElevation, drainageSystem } = req.body;
    
    // Map drainage system string to numerical value
    const drainageSystemMap: Record<string, number> = {
      "Fair": 1,
      "Good": 2,
      "Very Good": 3
    };

    const drainageValue = drainageSystemMap[drainageSystem] || 2;

    // Convert to array format for prediction
    const input = [
      parseFloat(rainfall) || 0,
      parseFloat(altitude) || 0,
      parseFloat(areaElevation) || 0,
      parseFloat(roadElevation) || 0,
      drainageValue
    ];

    const prediction = rf.predict([input])[0];
    let floodProb = 0;
    try {
      // @ts-ignore
      const probabilities = rf.predictProbability([input])[0];
      floodProb = probabilities[1] || 0;
    } catch (e) {
      floodProb = prediction === 1 ? 0.85 : 0.15;
    }

    res.json({
      prediction: prediction === 1 ? "Flood Likely" : "No Flood Expected",
      probability: (floodProb * 100).toFixed(2),
      riskLevel: floodProb > 0.7 ? "High" : floodProb > 0.4 ? "Medium" : "Low"
    });
  } catch (error) {
    console.error("Prediction error:", error);
    res.status(500).json({ error: "Failed to process prediction" });
  }
});

app.get("/api/environmental-data", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: "Latitude and longitude are required" });
  }

  try {
    // 1. Fetch Rainfall from Open-Meteo
    let rainfall = 0;
    try {
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_sum&timezone=auto`);
      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        rainfall = weatherData.daily?.precipitation_sum?.[0] || 0;
      }
    } catch (e) {
      console.warn("Weather API failed, using fallback 0");
    }

    // 2. Fetch Elevation from Open-Elevation
    let altitude = 0;
    try {
      const elevationRes = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`);
      if (elevationRes.ok) {
        const elevationData = await elevationRes.json();
        altitude = elevationData.results?.[0]?.elevation || 0;
      }
    } catch (e) {
      console.warn("Elevation API failed, using fallback 0");
    }

    // GIS simulation
    const areaElevation = altitude + (Math.random() * 2 - 1);
    const roadElevation = altitude + (Math.random() * 0.5 - 0.25);

    res.json({
      rainfall: rainfall.toFixed(1),
      altitude: altitude.toFixed(1),
      areaElevation: areaElevation.toFixed(1),
      roadElevation: roadElevation.toFixed(1),
    });
  } catch (error) {
    console.error("Environmental data fetch error:", error);
    res.status(500).json({ error: "Failed to fetch environmental data" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
