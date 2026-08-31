import logo from '../assets/branding/logo-light.png';

function TopNav({ activeTab, onChangeTab }) {
  const tabs = [
    { id: 'clientes', label: 'Clientes', icon: '👥' },
    { id: 'disparador', label: 'Disparador', icon: '🚀' },
    { id: 'templates', label: 'Templates', icon: '📑' },
    { id: 'historico', label: 'Histórico', icon: '📊' },
    { id: 'rotina', label: 'Rotina Diária', icon: '📁' },
    { id: 'configuracoes', label: 'Configurações', icon: '⚙️' },
  ];

  return (
    <div className="topnav">
      <div className="topnav-brand">
        <img src={logo} alt="Core TI Expert" className="topnav-logo" />
        <span className="topnav-title-badge">Backup System</span>
      </div>
      <nav className="topnav-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`topnav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onChangeTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default TopNav;
