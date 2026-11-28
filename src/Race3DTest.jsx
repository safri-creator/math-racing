import React, { useState } from "react";
import Race3D from "./Race3D.jsx";

export default function Race3DTest() {
  const [boost, setBoost] = useState(false);

  return (
    <main style={{
      minHeight: "100vh",
      boxSizing: "border-box",
      padding: 16,
      background: "#071426",
      color: "#f8fafc",
      fontFamily: "Inter, system-ui, sans-serif"
    }}>
      <header style={{ marginBottom: 14 }}>
        <div style={{
          color: "#fbbf24",
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: 3
        }}>PROTOTIPE ARENA</div>
        <h1 style={{
          margin: "6px 0",
          fontFamily: "Orbitron, Inter, sans-serif",
          fontSize: "clamp(22px, 4vw, 34px)"
        }}>MATH RACING 3D</h1>
        <p style={{ color: "#a9bad2", margin: 0 }}>
          Uji arena, motor, kamera belakang, dan efek boost.
        </p>
      </header>

      <Race3D height="70vh" boost={boost} />

      <button
        type="button"
        onClick={() => setBoost((value) => !value)}
        style={{
          marginTop: 14,
          padding: "12px 18px",
          border: 0,
          borderRadius: 10,
          background: boost ? "#38bdf8" : "#f97316",
          color: "#071426",
          fontWeight: 900,
          cursor: "pointer"
        }}
      >
        {boost ? "MATIKAN BOOST" : "AKTIFKAN BOOST"}
      </button>
      <p style={{ color: "#94a3b8", fontSize: 13 }}>
        Catatan: ini halaman uji terpisah. Data balapan dan aplikasi utama belum diubah.
      </p>
    </main>
  );
}
