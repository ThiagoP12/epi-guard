import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Pencil, Check, X, Upload } from 'lucide-react';
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
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const start = lines[0]?.toLowerCase().includes('nome') ? 1 : 0;
      const names = lines.slice(start).map(l => {
        const parts = l.split(/[;,\t]/);
        return { nome: parts[0]?.trim(), descricao: parts[1]?.trim() || null };
      }).filter(item => item.nome);

      if (names.length === 0) {
        toast({ title: 'Arquivo vazio', description: 'Nenhuma função encontrada no arquivo.', variant: 'destructive' });
        setImporting(false);
        return;
      }

      const { error } = await supabase.from('funcoes').insert(names.map(n => ({ nome: n.nome, descricao: n.descricao })));
      if (error) {
        toast({ title: 'Erro na importação', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: `${names.length} função(ões) importada(s)!` });
        load();
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: 'Falha ao ler o arquivo.', variant: 'destructive' });
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-card rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2"><span className="w-1.5 h-4 rounded-full bg-primary inline-block" /> Funções</h2>
          <p className="text-xs text-muted-foreground mt-1.5 ml-3.5">Gerencie as funções disponíveis para vincular aos colaboradores.</p>
        </div>
        <div>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload size={14} className="mr-1" /> {importing ? 'Importando...' : 'Importar CSV'}
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,.txt,.xls,.xlsx" onChange={handleImportCSV} className="hidden" />
        </div>
      </div>

      <div className="flex gap-2.5 mb-5">
        <Input placeholder="Nome da função" value={novoNome} onChange={e => setNovoNome(e.target.value)} className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <Input placeholder="Descrição (opcional)" value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <Button size="sm" onClick={handleAdd} disabled={loading || !novoNome.trim()} className="gap-1.5">
          <Plus size={14} /> Adicionar
        </Button>
      </div>

      {funcoes.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-muted-foreground">Nenhuma função cadastrada.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Adicione funções acima ou importe via CSV.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {funcoes.map(f => (
            <div key={f.id} className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-accent/30">
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
