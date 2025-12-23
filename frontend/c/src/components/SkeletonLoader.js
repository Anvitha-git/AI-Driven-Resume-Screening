import React from 'react';

const SkeletonCard = () => (
  <div className="candidate-card" style={{ opacity: 0.8 }}>
    <div className="candidate-card-content">
      <div style={{ width: '60%', height: '18px', background: '#e5e7eb', borderRadius: 4, marginBottom: 10 }} />
      <div style={{ width: '40%', height: '12px', background: '#e5e7eb', borderRadius: 4 }} />
    </div>
    <div className="candidate-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ width: 80, height: 30, background: '#e5e7eb', borderRadius: 6 }} />
      <div style={{ width: 60, height: 30, background: '#e5e7eb', borderRadius: 6 }} />
    </div>
  </div>
);

export default function SkeletonLoader({ count = 4 }) {
  const items = Array.from({ length: count });
  return (
    <div className="candidates-cards-container">
      {items.map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
