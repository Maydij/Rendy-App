'use client';

import { useState, createContext, useContext, useEffect } from 'react';
import {
  LayoutDashboard,
  Wallet,
  ClipboardCheck,
  RotateCcw,
  Receipt,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  LogOut,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const SidebarContext = createContext({ collapsed: false });
export const useSidebar = () => useContext(SidebarContext);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingViaticos, setPendingViaticos] = useState<number>(0);
  const [pendingReembolsos, setPendingReembolsos] = useState<number>(0);
  const pathname = usePathname();

  useEffect(() => {
    async function fetchCounts() {
      // Contar viáticos pendientes
      const { count: vCount } = await supabase
        .from('solicitudes_viaticos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'PENDIENTE');

      // Contar reembolsos pendientes
      const { count: rCount } = await supabase
        .from('gastos')
        .select('*', { count: 'exact', head: true })
        .is('metodo_pago_id', null)
        .eq('estado', 'PENDIENTE');

      setPendingViaticos(vCount || 0);
      setPendingReembolsos(rCount || 0);
    }

    fetchCounts();
  }, [pathname]);

  const NAV_ITEMS = [
    {
      label: 'Principal',
      items: [
        { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', badge: null },
      ],
    },
    {
      label: 'Operaciones',
      items: [
        { href: '/dashboard/solicitudes', icon: Wallet, label: 'Solicitudes de Viáticos', badge: pendingViaticos > 0 ? String(pendingViaticos) : null },
        { href: '/dashboard/justificacion', icon: ClipboardCheck, label: 'Progreso Justificación', badge: null },
        { href: '/dashboard/gastos', icon: Receipt, label: 'Gastos de Empresa', badge: null },
        { href: '/dashboard/reembolsos', icon: RotateCcw, label: 'Reembolsos', badge: pendingReembolsos > 0 ? String(pendingReembolsos) : null },
      ],
    },
    {
      label: 'Administración',
      items: [
        { href: '/dashboard/configuracion', icon: Settings, label: 'Organización', badge: null },
      ],
    },
  ];

  const PAGE_LABELS: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/dashboard/solicitudes': 'Solicitudes de Viáticos',
    '/dashboard/justificacion': 'Progreso de Justificación',
    '/dashboard/gastos': 'Gastos de Empresa',
    '/dashboard/reembolsos': 'Reembolsos',
    '/dashboard/configuracion': 'Organización',
  };

  const pageLabel = PAGE_LABELS[pathname] ?? 'Dashboard';

  return (
    <SidebarContext.Provider value={{ collapsed }}>
      <div className="dashboard-shell">
        <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
          <div
            className="sidebar-brand"
            onClick={() => collapsed && setCollapsed(false)}
            style={{ cursor: collapsed ? 'pointer' : 'default' }}
            title={collapsed ? 'Expandir menú lateral' : undefined}
          >
            <div className="sidebar-brand-logo">R</div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">Rendy</span>
              <span className="sidebar-brand-tagline">by Swork · B2B SaaS</span>
            </div>
            {!collapsed ? (
              <button className="sidebar-toggle" onClick={(e) => { e.stopPropagation(); setCollapsed(true); }} title="Colapsar">
                <ChevronLeft size={16} />
              </button>
            ) : (
              <button className="sidebar-toggle" onClick={(e) => { e.stopPropagation(); setCollapsed(false); }} title="Expandir">
                <ChevronRight size={16} />
              </button>
            )}
          </div>

          <div className="sidebar-nav">
            {NAV_ITEMS.map((section) => (
              <div key={section.label}>
                <div className="nav-section-label">{section.label}</div>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  return (
                    <Link key={item.href} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`}>
                      <span className="nav-item-icon">
                        <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                      </span>
                      <span className="nav-item-label">{item.label}</span>
                      {item.badge && <span className="nav-badge">{item.badge}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-org-pill">
              <div className="sidebar-org-avatar">SD</div>
              <div className="sidebar-org-info">
                <div className="sidebar-org-name">Swork Demo</div>
                <div className="sidebar-org-role">Admin · SaaS</div>
              </div>
            </div>
          </div>
        </nav>

        <div className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
          <header className="topbar">
            <div className="topbar-breadcrumb">
              <span className="topbar-breadcrumb-root">Rendy</span>
              <ChevronRight size={12} className="topbar-breadcrumb-sep" />
              <span className="topbar-breadcrumb-page">{pageLabel}</span>
            </div>
            <div className="topbar-actions">
              <button className="topbar-btn" id="topbar-search-btn"><Search size={16} /></button>
              <button className="topbar-btn" id="topbar-notifications-btn">
                <Bell size={16} />
                <span className="topbar-btn-dot" />
              </button>
              <button className="topbar-btn" id="topbar-logout-btn"><LogOut size={16} /></button>
              <div className="topbar-avatar">A</div>
            </div>
          </header>

          <main className="page-area" id="main-content">
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}