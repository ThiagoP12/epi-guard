import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Funcao {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export default function FuncoesManager() {
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from('funcoes').select('id, nome, descricao, ativo').order('nome');
    if (data) setFuncoes(data as Funcao[]);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    setLoading(true);
    const { error } = await supabase.from('funcoes').insert({ nome, descricao: novaDescricao.trim() || null });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro', description: error.message.includes('unique') ? 'Função já existe.' : error.message, variant: 'destructive' });
    } else {
      setNovoNome('');
      setNovaDescricao('');
      toast({ title: 'Função adicionada!' });
      load();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('funcoes').delete().eq('id', id);
    toast({ title: 'Função removida.' });
    load();
  };

  const startEdit = (f: Funcao) => {
    setEditingId(f.id);
    setEditNome(f.nome);
    setEditDescricao(f.descricao || '');
  };

  const saveEdit = async () => {
    if (!editingId || !editNome.trim()) return;
    const { error } = await supabase.from('funcoes').update({ nome: editNome.trim(), descricao: editDescricao.trim() || null }).eq('id', editingId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Função atualizada!' });
      setEditingId(null);
      load();
    }
  };

  return (
    <div className="bg-card rounded-lg border p-5">
      <h2 className="text-sm font-semibold mb-4">Funções</h2>
      <p className="text-xs text-muted-foreground mb-3">Gerencie as funções disponíveis para vincular aos colaboradores.</p>

      <div className="flex gap-2 mb-4">
        <Input placeholder="Nome da função" value={novoNome} onChange={e => setNovoNome(e.target.value)} className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <Input placeholder="Descrição (opcional)" value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <Button size="sm" onClick={handleAdd} disabled={loading || !novoNome.trim()}>
          <Plus size={14} className="mr-1" /> Adicionar
        </Button>
      </div>

      {funcoes.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhuma função cadastrada.</p>
      ) : (
        <div className="space-y-1.5">
          {funcoes.map(f => (
            <div key={f.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              {editingId === f.id ? (
                <>
                  <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-7 text-xs flex-1" />
                  <Input value={editDescricao} onChange={e => setEditDescricao(e.target.value)} className="h-7 text-xs flex-1" placeholder="Descrição" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit}><Check size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X size={14} /></Button>
                </>
              ) : (
                <>
                  <span className="font-medium flex-1">{f.nome}</span>
                  {f.descricao && <span className="text-xs text-muted-foreground flex-1 truncate">{f.descricao}</span>}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(f)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(f.id)}><Trash2 size={14} /></Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
