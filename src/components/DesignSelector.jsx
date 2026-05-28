import React from "react";
import { translations } from "../utils/translations";

export default function DesignSelector({ lang = "en", onSelectDesign, onCancel }) {
  const t = translations[lang] || translations["en"];

  const designs = [
    {
      id: 1,
      name: "Standard GST (Design 1)",
      description: "A clean, compliant GST invoice template with clearly defined sections.",
      image: "https://placehold.co/400x500/eeeeee/999999?text=Design+1+Preview"
    },
    {
      id: 2,
      name: "Modern Minimal (Design 2)",
      description: "A sleek, modern aesthetic with vibrant accents and glassmorphism elements.",
      image: "https://placehold.co/400x500/f8fafc/3b82f6?text=Design+2+Preview"
    },
    {
      id: 3,
      name: "Proforma Invoice (Design 3)",
      description: "A formal proforma structure suitable for advance payments and international trade.",
      image: "https://placehold.co/400x500/fdfbf7/b45309?text=Design+3+Preview"
    }
  ];

  return (
    <div className="section-container" style={{ maxWidth: "900px", margin: "2rem auto" }}>
      <div className="section-header" style={{ borderBottom: "none", paddingBottom: 0 }}>
        <div className="section-title">
          <h2>Select Invoice Layout</h2>
          <p>Choose a design for your new invoice. You can always change this later.</p>
        </div>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "2rem", marginTop: "2rem" }}>
        {designs.map(design => (
          <div 
            key={design.id} 
            className="stat-card" 
            style={{ cursor: "pointer", transition: "transform 0.2s ease, box-shadow 0.2s ease", padding: "1rem" }}
            onClick={() => onSelectDesign(design.id)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
              e.currentTarget.style.boxShadow = "var(--shadow-lg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "var(--shadow-md)";
            }}
          >
            <div style={{ 
              width: "100%", 
              height: "250px", 
              backgroundColor: "#f1f5f9", 
              borderRadius: "var(--radius-md)",
              marginBottom: "1rem",
              backgroundImage: `url(${design.image})`,
              backgroundSize: "cover",
              backgroundPosition: "top"
            }} />
            <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>{design.name}</h3>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.4 }}>{design.description}</p>
            <button className="btn btn-primary" style={{ width: "100%", marginTop: "1rem" }}>
              Use This Design
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
