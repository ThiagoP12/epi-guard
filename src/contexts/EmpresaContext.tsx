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
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setEmpresas([]);
      setSelectedEmpresa(null);
      setLoading(false);
      setInitialLoaded(false);
      return;
    }

    const load = async () => {
      // Only show loading on initial load, not on subsequent re-fetches
      if (!initialLoaded) setLoading(true);

      const { data } = await supabase
        .from('empresas')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (data) {
        setEmpresas(data as Empresa[]);
      }

      setLoading(false);
      setInitialLoaded(true);
    };

    load();
  }, [user, role]);

  // Auto-select from localStorage
  useEffect(() => {
    if (empresas.length > 0 && selectedEmpresa === null) {
      const saved = localStorage.getItem('selected_empresa_id');
      if (saved && saved !== 'todas') {
        const found = empresas.find(e => e.id === saved);
        if (found) setSelectedEmpresa(found);
      }
      // If only one empresa, auto-select it
      if (empresas.length === 1 && !saved) {
        setSelectedEmpresa(empresas[0]);
      }
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
