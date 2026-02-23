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
        if (data) setEmpresas(data as Empresa[]);
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
          if (data) setEmpresas(data as Empresa[]);
        }
      }

      setLoading(false);
    };

    load();
  }, [user, role]);

  // Auto-select from localStorage or first empresa
  useEffect(() => {
    if (empresas.length > 0 && !selectedEmpresa) {
      const saved = localStorage.getItem('selected_empresa_id');
      const found = saved ? empresas.find(e => e.id === saved) : null;
      setSelectedEmpresa(found || empresas[0]);
    }
  }, [empresas, selectedEmpresa]);

  // Persist selection
  useEffect(() => {
    if (selectedEmpresa) {
      localStorage.setItem('selected_empresa_id', selectedEmpresa.id);
    }
  }, [selectedEmpresa]);

  return (
    <EmpresaContext.Provider value={{ empresas, selectedEmpresa, setSelectedEmpresa, loading }}>
      {children}
    </EmpresaContext.Provider>
  );
}
