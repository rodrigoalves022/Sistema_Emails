function StatCard({ icon, label, value, color, background, gradient }) {
  return (
    <div className="stat-card glass-panel">
      <div className="stat-icon" style={color ? { color, background } : undefined}>
        {icon}
      </div>
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${gradient ? 'text-gradient' : ''}`}>{value}</span>
    </div>
  );
}

export default StatCard;
