import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Pencil, Check, X, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Setor {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export default function SetoresManager() {
  const [setores, setSetores] = useState<Setor[]>([]);
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
    const { data } = await supabase.from('setores').select('id, nome, descricao, ativo').order('nome');
    if (data) setSetores(data as Setor[]);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    setLoading(true);
    const { error } = await supabase.from('setores').insert({ nome, descricao: novaDescricao.trim() || null });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro', description: error.message.includes('unique') ? 'Setor já existe.' : error.message, variant: 'destructive' });
    } else {
      setNovoNome('');
      setNovaDescricao('');
      toast({ title: 'Setor adicionado!' });
      load();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('setores').delete().eq('id', id);
    toast({ title: 'Setor removido.' });
    load();
  };

  const startEdit = (s: Setor) => {
    setEditingId(s.id);
    setEditNome(s.nome);
    setEditDescricao(s.descricao || '');
  };

  const saveEdit = async () => {
    if (!editingId || !editNome.trim()) return;
    const { error } = await supabase.from('setores').update({ nome: editNome.trim(), descricao: editDescricao.trim() || null }).eq('id', editingId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Setor atualizado!' });
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
      // Skip header if it looks like one
      const start = lines[0]?.toLowerCase().includes('nome') ? 1 : 0;
      const names = lines.slice(start).map(l => {
        const parts = l.split(/[;,\t]/);
        return { nome: parts[0]?.trim(), descricao: parts[1]?.trim() || null };
      }).filter(item => item.nome);

      if (names.length === 0) {
        toast({ title: 'Arquivo vazio', description: 'Nenhum setor encontrado no arquivo.', variant: 'destructive' });
        setImporting(false);
        return;
      }

      const { error } = await supabase.from('setores').insert(names.map(n => ({ nome: n.nome, descricao: n.descricao })));
      if (error) {
        toast({ title: 'Erro na importação', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: `${names.length} setor(es) importado(s)!` });
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
          <h2 className="text-sm font-semibold flex items-center gap-2"><span className="w-1.5 h-4 rounded-full bg-primary inline-block" /> Setores</h2>
          <p className="text-xs text-muted-foreground mt-1.5 ml-3.5">Gerencie os setores disponíveis para vincular aos colaboradores.</p>
        </div>
        <div>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload size={14} className="mr-1" /> {importing ? 'Importando...' : 'Importar CSV'}
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,.txt,.xls,.xlsx" onChange={handleImportCSV} className="hidden" />
        </div>
      </div>

      {/* Add form */}
      <div className="flex gap-2.5 mb-5">
        <Input placeholder="Nome do setor" value={novoNome} onChange={e => setNovoNome(e.target.value)} className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <Input placeholder="Descrição (opcional)" value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <Button size="sm" onClick={handleAdd} disabled={loading || !novoNome.trim()} className="gap-1.5">
          <Plus size={14} /> Adicionar
        </Button>
      </div>

      {/* List */}
      {setores.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-muted-foreground">Nenhum setor cadastrado.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Adicione setores acima ou importe via CSV.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {setores.map(s => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-accent/30">
              {editingId === s.id ? (
                <>
                  <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-7 text-xs flex-1" />
                  <Input value={editDescricao} onChange={e => setEditDescricao(e.target.value)} className="h-7 text-xs flex-1" placeholder="Descrição" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit}><Check size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X size={14} /></Button>
                </>
              ) : (
                <>
                  <span className="font-medium flex-1">{s.nome}</span>
                  {s.descricao && <span className="text-xs text-muted-foreground flex-1 truncate">{s.descricao}</span>}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(s)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}><Trash2 size={14} /></Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
