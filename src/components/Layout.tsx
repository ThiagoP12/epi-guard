import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  ClipboardCheck,
  Shield,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Construction,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const menuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', phase: 1 },
  { label: 'Estoque', icon: Package, path: '/estoque', phase: 1 },
  { label: 'Colaboradores', icon: Users, path: '/colaboradores', phase: 1 },
  { label: 'Entrega de EPI', icon: ClipboardCheck, path: '/entrega-epi', phase: 1 },
  { label: 'Controle de EPC', icon: Shield, path: '/controle-epc', phase: 2 },
  { label: 'Relatórios', icon: BarChart3, path: '/relatorios', phase: 2 },
  { label: 'Configurações', icon: Settings, path: '/configuracoes', phase: 1 },
];

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, role, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="h-14 bg-primary flex items-center justify-between px-4 shrink-0 z-30 relative">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-primary-foreground">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <Shield size={22} className="text-primary-foreground" />
            <span className="text-primary-foreground font-semibold text-sm sm:text-base">Gestão de EPI & EPC</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-primary-foreground/90 text-sm">{profile?.nome || 'Usuário'}</p>
            <p className="text-primary-foreground/60 text-[10px] capitalize">{role || ''}</p>
          </div>
          <button onClick={signOut} className="text-primary-foreground/70 hover:text-primary-foreground transition-colors flex items-center gap-1 text-sm">
            <LogOut size={16} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-foreground/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <aside className={cn(
          'fixed lg:static inset-y-0 left-0 top-14 z-20 w-56 bg-sidebar flex flex-col transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}>
          <nav className="flex-1 py-3 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              const isDisabled = item.phase > 1;
              return (
                <Link
                  key={item.path}
                  to={isDisabled ? '#' : item.path}
                  onClick={() => { if (!isDisabled) setSidebarOpen(false); }}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors mx-2 rounded-md',
                    isDisabled
                      ? 'text-sidebar-muted cursor-not-allowed opacity-50'
                      : isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {isDisabled && <Construction size={12} className="ml-auto" />}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-sidebar-border">
            <p className="text-[11px] text-sidebar-muted">Fase 1 • MVP</p>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-muted/30">
          <div className="p-4 sm:p-6 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
