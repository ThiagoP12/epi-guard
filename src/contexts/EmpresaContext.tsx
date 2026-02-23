import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  matriz_id: string | null;
  ativo: boolean;
}

interface EmpresaContextType {
  empresas: Empresa[];
  selectedEmpresa: Empresa | null;
  setSelectedEmpresa: (empresa: Empresa | null) => void;
  loading: boolean;
}

const EmpresaContext = createContext<EmpresaContextType | null>(null);

export function useEmpresa() {
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error('useEmpresa must be used within EmpresaProvider');
  return ctx;
}

const EMPRESA_ORDER = [
  'Revalle Juazeiro',
  'Revalle Bonfim',
  'Revalle Petrolina',
  'Revalle Ribeira do Pombal',
  'Revalle Paulo Afonso',
  'Revalle Alagoinhas',
  'Revalle Serrinha',
];

function sortEmpresas(list: Empresa[]): Empresa[] {
  return [...list].sort((a, b) => {
    const ia = EMPRESA_ORDER.indexOf(a.nome);
    const ib = EMPRESA_ORDER.indexOf(b.nome);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.nome.localeCompare(b.nome);
  });
}

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEmpresas([]);
      setSelectedEmpresa(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);

      if (role === 'admin') {
        // Admin sees all empresas
        const { data } = await supabase
          .from('empresas')
          .select('*')
          .eq('ativo', true)
          .order('nome');
        if (data) setEmpresas(sortEmpresas(data as Empresa[]));
      } else {
        // Other roles: only linked empresas
        const { data: links } = await supabase
          .from('user_empresas')
          .select('empresa_id')
          .eq('user_id', user.id);

        if (links && links.length > 0) {
          const ids = links.map(l => l.empresa_id);
          const { data } = await supabase
            .from('empresas')
            .select('*')
            .in('id', ids)
            .eq('ativo', true)
            .order('nome');
          if (data) setEmpresas(sortEmpresas(data as Empresa[]));
        }
      }

      setLoading(false);
    };

    load();
  }, [user, role]);

  // Auto-select from localStorage (null = Todas)
  useEffect(() => {
    if (empresas.length > 0 && selectedEmpresa === null) {
      const saved = localStorage.getItem('selected_empresa_id');
      if (saved && saved !== 'todas') {
        const found = empresas.find(e => e.id === saved);
        if (found) setSelectedEmpresa(found);
      }
      // If saved is 'todas' or not found, keep null (Todas)
    }
  }, [empresas]);

  // Persist selection
  useEffect(() => {
    localStorage.setItem('selected_empresa_id', selectedEmpresa ? selectedEmpresa.id : 'todas');
  }, [selectedEmpresa]);

  return (
    <EmpresaContext.Provider value={{ empresas, selectedEmpresa, setSelectedEmpresa, loading }}>
      {children}
    </EmpresaContext.Provider>
  );
}
