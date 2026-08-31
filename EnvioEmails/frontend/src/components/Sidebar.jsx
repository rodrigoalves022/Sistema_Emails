import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Calendar,
  FileCode2,
  Mail,
  Send,
  BarChart3,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api';

export default function Sidebar() {
  const [stats, setStats] = useState({ falhas: 0, agendados: 0 });

  useEffect(() => {
    const fetchCounters = async () => {
      try {
        const data = await api.getDashboardStats();
        if (data && data.indicadores) {
          setStats({
            falhas: data.indicadores.clientes_em_falha || 0,
            agendados: data.indicadores.emails_agendados || 0,
          });
        }
      } catch (err) {
        // silent
      }
    };
    fetchCounters();
    const interval = setInterval(fetchCounters, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="stat-icon-wrapper" style={{ borderColor: '#00B39B' }}>
          <ShieldCheck size={24} color="#00B39B" />
        </div>
        <div className="brand-logo-text">
          <div className="brand-title">
            Core <span className="lime">TI</span> <span className="cyan">Expert</span>
          </div>
          <div className="brand-subtitle">Backup Operations</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-title">Monitoramento</div>

        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <div className="nav-link-content">
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </div>
        </NavLink>

        <NavLink
          to="/falhas"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <div className="nav-link-content">
            <AlertTriangle size={18} />
            <span>Falhas</span>
          </div>
          {stats.falhas > 0 && (
            <span className="nav-badge danger">{stats.falhas}</span>
          )}
        </NavLink>

        <div className="sidebar-section-title" style={{ marginTop: '10px' }}>
          Operações
        </div>

        <NavLink
          to="/disparo"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <div className="nav-link-content">
            <Send size={18} />
            <span>Disparo Direto</span>
          </div>
        </NavLink>

        <NavLink
          to="/clientes"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <div className="nav-link-content">
            <Users size={18} />
            <span>Clientes</span>
          </div>
        </NavLink>

        <NavLink
          to="/agendamentos"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <div className="nav-link-content">
            <Calendar size={18} />
            <span>Agendamentos</span>
          </div>
          {stats.agendados > 0 && (
            <span className="nav-badge warning">{stats.agendados}</span>
          )}
        </NavLink>

        <NavLink
          to="/templates"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <div className="nav-link-content">
            <FileCode2 size={18} />
            <span>Templates</span>
          </div>
        </NavLink>

        <NavLink
          to="/emails"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <div className="nav-link-content">
            <Mail size={18} />
            <span>E-mails Enviados</span>
          </div>
        </NavLink>

        <div className="sidebar-section-title" style={{ marginTop: '10px' }}>
          Gestão
        </div>

        <NavLink
          to="/estatisticas"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <div className="nav-link-content">
            <BarChart3 size={18} />
            <span>Estatísticas</span>
          </div>
        </NavLink>

        <NavLink
          to="/configuracoes"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <div className="nav-link-content">
            <Settings size={18} />
            <span>Configurações</span>
          </div>
        </NavLink>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 16px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Ambiente</span>
            <span style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-primary)' }}>
              v2.0 • SMTP Ativo
            </span>
          </div>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              boxShadow: '0 0 6px #10B981',
            }}
          />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div>© {new Date().getFullYear()} <strong style={{ color: 'var(--text-primary)' }}>Rodrigo Alves</strong></div>
          <div style={{ fontSize: '10.5px', color: 'var(--brand-teal)' }}>Core TI Expert Operations</div>
        </div>
      </div>
    </aside>
  );
}
