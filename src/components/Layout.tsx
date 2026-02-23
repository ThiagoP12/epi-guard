import { useState, useEffect } from 'react';
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
  Construction,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';

const menuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', phase: 1 },
  { label: 'Revendas', icon: Building2, path: '/revendas', phase: 1 },
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
  const { selectedEmpresa } = useEmpresa();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Get current page title for breadcrumb
  const currentPage = menuItems.find(m => m.path === location.pathname);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="h-14 bg-primary flex items-center justify-between px-4 shrink-0 z-30 relative shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-primary-foreground/80 hover:text-primary-foreground transition-colors p-1 rounded-md hover:bg-primary-foreground/10"
            aria-label="Toggle menu"
          >
            <div className="relative w-5 h-5">
              <Menu size={20} className={cn("absolute inset-0 transition-all duration-200", sidebarOpen ? "opacity-0 rotate-90" : "opacity-100 rotate-0")} />
              <X size={20} className={cn("absolute inset-0 transition-all duration-200", sidebarOpen ? "opacity-100 rotate-0" : "opacity-0 -rotate-90")} />
            </div>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-foreground/15 flex items-center justify-center">
              <Shield size={18} className="text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <span className="text-primary-foreground font-semibold text-sm leading-none">Gestão EPI & EPC</span>
            </div>
          </div>
        </div>

        {/* Breadcrumb + Empresa (desktop) */}
        <div className="hidden md:flex items-center gap-1.5 text-primary-foreground/50 text-xs absolute left-1/2 -translate-x-1/2">
          {selectedEmpresa && (
            <>
              <Building2 size={11} />
              <span className="text-primary-foreground/70 font-medium">{selectedEmpresa.nome}</span>
              <span className="text-primary-foreground/30 mx-0.5">|</span>
            </>
          )}
          <span>Início</span>
          {currentPage && currentPage.path !== '/' && (
            <>
              <ChevronRight size={12} />
              <span className="text-primary-foreground/90 font-medium">{currentPage.label}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block mr-1">
            <p className="text-primary-foreground/90 text-sm font-medium leading-none">{profile?.nome || 'Usuário'}</p>
            <p className="text-primary-foreground/50 text-[10px] capitalize mt-0.5">{role || ''}</p>
          </div>
          <div className="w-px h-6 bg-primary-foreground/15 hidden sm:block" />
          <button
            onClick={signOut}
            className="text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-all duration-150 flex items-center gap-1.5 text-sm px-2 py-1.5 rounded-md"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline text-xs">Sair</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Overlay */}
        <div
          className={cn(
            "fixed inset-0 bg-foreground/40 z-20 lg:hidden transition-opacity duration-200",
            sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar */}
        <aside className={cn(
          'fixed lg:static inset-y-0 left-0 top-14 z-20 w-56 bg-sidebar flex flex-col transition-transform duration-250 ease-out will-change-transform',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}>
          <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
            {menuItems.map((item, i) => {
              const isActive = location.pathname === item.path;
              const isDisabled = item.phase > 1;
              return (
                <Link
                  key={item.path}
                  to={isDisabled ? '#' : item.path}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-all duration-150 relative',
                    isDisabled
                      ? 'text-sidebar-muted cursor-not-allowed opacity-40'
                      : isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm'
                        : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
                  )}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-foreground rounded-r-full" />
                  )}
                  <item.icon size={17} className={cn(
                    "shrink-0 transition-transform duration-150",
                    !isDisabled && !isActive && "group-hover:scale-110"
                  )} />
                  <span className="truncate">{item.label}</span>
                  {isDisabled && <Construction size={11} className="ml-auto shrink-0" />}
                </Link>
              );
            })}
          </nav>

          <div className="px-4 py-3 border-t border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-status-ok animate-pulse-soft" />
              <p className="text-[11px] text-sidebar-muted">Fase 1 • MVP</p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-muted/30">
          <div className="p-4 sm:p-6 page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
