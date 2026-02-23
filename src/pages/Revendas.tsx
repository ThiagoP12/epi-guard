import { useState } from 'react';
import { Building2, MapPin, Phone, Mail, GitBranch, CheckCircle } from 'lucide-react';
import { useEmpresa, type Empresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function Revendas() {
  const { empresas, selectedEmpresa, setSelectedEmpresa } = useEmpresa();
  const { role } = useAuth();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Empresa>>({});
  const [submitting, setSubmitting] = useState(false);

  const matrices = empresas.filter(e => !e.matriz_id);
  const getFiliais = (matrizId: string) => empresas.filter(e => e.matriz_id === matrizId);

  const openEdit = (empresa: Empresa) => {
    setEditForm({ id: empresa.id, nome: empresa.nome, cnpj: empresa.cnpj || '', endereco: empresa.endereco || '', telefone: empresa.telefone || '', email: empresa.email || '' });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editForm.id) return;
    setSubmitting(true);
    const { error } = await supabase.from('empresas').update({
      cnpj: editForm.cnpj || null,
      endereco: editForm.endereco || null,
      telefone: editForm.telefone || null,
      email: editForm.email || null,
    }).eq('id', editForm.id);
    setSubmitting(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Dados atualizados.' });
      setEditOpen(false);
      // Reload page to refresh context
      window.location.reload();
    }
  };

  const selectEmpresa = (empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    toast({ title: `Empresa selecionada`, description: empresa.nome });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Revendas</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {empresas.length} unidades • Selecione uma empresa para trabalhar
        </p>
      </div>

      <div className="space-y-6">
        {matrices.map(matriz => {
          const filiais = getFiliais(matriz.id);
          const isSelected = selectedEmpresa?.id === matriz.id;

          return (
            <div key={matriz.id} className="space-y-2">
              {/* Matriz Card */}
              <div
                className={`bg-card rounded-xl border-2 p-4 cursor-pointer transition-all duration-150 hover:shadow-md ${
                  isSelected ? 'border-primary shadow-sm' : 'border-transparent hover:border-muted'
                }`}
                onClick={() => selectEmpresa(matriz)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      <Building2 size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{matriz.nome}</h3>
                        <span className="text-[10px] uppercase font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">Matriz</span>
                        {isSelected && <CheckCircle size={14} className="text-primary" />}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                        {matriz.cnpj && <span>{matriz.cnpj}</span>}
                        {matriz.endereco && <span className="flex items-center gap-0.5"><MapPin size={10} />{matriz.endereco}</span>}
                        {matriz.telefone && <span className="flex items-center gap-0.5"><Phone size={10} />{matriz.telefone}</span>}
                        {matriz.email && <span className="flex items-center gap-0.5"><Mail size={10} />{matriz.email}</span>}
                        {!matriz.cnpj && !matriz.endereco && <span className="text-muted-foreground/50 italic">Dados não preenchidos</span>}
                      </div>
                    </div>
                  </div>
                  {role === 'admin' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={(e) => { e.stopPropagation(); openEdit(matriz); }}>
                      Editar
                    </Button>
                  )}
                </div>
                {filiais.length > 0 && (
                  <p className="text-[10px] text-muted-foreground/50 mt-2 pl-13">
                    <GitBranch size={10} className="inline mr-0.5" /> {filiais.length} filial(is)
                  </p>
                )}
              </div>

              {/* Filiais */}
              {filiais.map(filial => {
                const isFilialSelected = selectedEmpresa?.id === filial.id;
                return (
                  <div
                    key={filial.id}
                    className={`ml-6 sm:ml-10 bg-card rounded-lg border-2 p-3.5 cursor-pointer transition-all duration-150 hover:shadow-sm ${
                      isFilialSelected ? 'border-primary shadow-sm' : 'border-transparent hover:border-muted'
                    }`}
                    onClick={() => selectEmpresa(filial)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                          isFilialSelected ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
                        }`}>
                          <GitBranch size={15} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{filial.nome}</span>
                            <span className="text-[9px] uppercase font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Filial</span>
                            {isFilialSelected && <CheckCircle size={13} className="text-primary" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            Filial de {matriz.nome}
                            {filial.cnpj && ` • ${filial.cnpj}`}
                          </p>
                        </div>
                      </div>
                      {role === 'admin' && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={(e) => { e.stopPropagation(); openEdit(filial); }}>
                          Editar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Empresa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={editForm.nome || ''} disabled className="mt-1 h-9 bg-muted/30" />
            </div>
            <div>
              <Label className="text-xs">CNPJ</Label>
              <Input value={editForm.cnpj || ''} onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value })} className="mt-1 h-9" placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label className="text-xs">Endereço</Label>
              <Input value={editForm.endereco || ''} onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })} className="mt-1 h-9" placeholder="Rua, nº, Cidade - UF" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={editForm.telefone || ''} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} className="mt-1 h-9" placeholder="(00) 0000-0000" />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="mt-1 h-9" placeholder="contato@empresa.com" />
              </div>
            </div>
            <Button className="w-full h-9 font-medium" onClick={handleSave} disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
