import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Users, Plus, Search, Loader2, Shield, Building2, Key,
  Mail, Calendar, User, Eye, EyeOff, Pencil,
} from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  nome: string;
  avatar_url: string | null;
  roles: string[];
  empresas: { id: string; nome: string }[];
  created_at: string;
  last_sign_in_at: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  almoxarifado: 'Almoxarifado',
  gestor: 'Gestor de Área',
  supervisor: 'Supervisor',
  tecnico: 'Técnico',
  colaborador: 'Colaborador',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-500/10 text-purple-600 border-purple-200',
  admin: 'bg-primary/10 text-primary border-primary/20',
  almoxarifado: 'bg-amber-500/10 text-amber-600 border-amber-200',
  gestor: 'bg-blue-500/10 text-blue-600 border-blue-200',
  supervisor: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
  tecnico: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  colaborador: 'bg-muted text-muted-foreground border-border',
};

const ASSIGNABLE_ROLES = ['admin', 'almoxarifado', 'gestor', 'supervisor', 'tecnico', 'colaborador'];

export default function Usuarios() {
  const { toast } = useToast();
  const { empresas } = useEmpresa();
  const { roles: myRoles } = useAuth();
  const isSuperAdmin = myRoles.includes('super_admin');

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ nome: '', email: '', password: '', role: 'almoxarifado', empresa_ids: [] as string[] });
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editEmpresaIds, setEditEmpresaIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('list-users');
    if (error) {
      toast({ title: 'Erro ao carregar usuários', description: error.message, variant: 'destructive' });
    } else if (data?.error) {
      toast({ title: 'Erro', description: data.error, variant: 'destructive' });
    } else {
      setUsers(data.users || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async () => {
    if (!createForm.nome || !createForm.email || !createForm.password) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: {
        action: 'create_user',
        email: createForm.email,
        password: createForm.password,
        nome: createForm.nome,
        role: createForm.role,
        empresa_ids: createForm.empresa_ids,
      },
    });
    if (error || data?.error) {
      toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' });
    } else {
      toast({ title: 'Usuário criado com sucesso!' });
      setCreateOpen(false);
      setCreateForm({ nome: '', email: '', password: '', role: 'almoxarifado', empresa_ids: [] });
      await loadUsers();
    }
    setCreating(false);
  };

  const openEdit = (u: UserData) => {
    setEditUser(u);
    setEditRole(u.roles[0] || 'almoxarifado');
    setEditEmpresaIds(u.empresas.map(e => e.id));
    setEditOpen(true);
  };

  const handleSaveRole = async () => {
    if (!editUser) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: { action: 'update_role', user_id: editUser.id, role: editRole },
    });
    if (error || data?.error) {
      toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' });
    } else {
      toast({ title: 'Perfil atualizado!' });
    }
    setSaving(false);
  };

  const handleSaveEmpresas = async () => {
    if (!editUser) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: { action: 'update_empresas', user_id: editUser.id, empresa_ids: editEmpresaIds },
    });
    if (error || data?.error) {
      toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' });
    } else {
      toast({ title: 'Revendas atualizadas!' });
      setEditOpen(false);
      await loadUsers();
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: 'Senha deve ter no mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    setResetting(true);
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: { action: 'reset_password', user_id: resetUserId, new_password: newPassword },
    });
    if (error || data?.error) {
      toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' });
    } else {
      toast({ title: 'Senha redefinida com sucesso!' });
      setResetOpen(false);
      setNewPassword('');
    }
    setResetting(false);
  };

  const toggleEmpresa = (id: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter(e => e !== id) : [...list, id]);
  };

  const filtered = users.filter(u =>
    !search ||
    u.nome?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd/MM/yyyy HH:mm'); } catch { return d; }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Users size={22} /> Usuários
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie os acessos ao sistema, perfis e revendas</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> Novo Usuário
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..." className="pl-9 h-9" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border p-10 text-center">
          <Users size={36} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum usuário encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => {
            const primaryRole = u.roles[0] || 'colaborador';
            const roleColor = ROLE_COLORS[primaryRole] || ROLE_COLORS.colaborador;
            return (
              <div key={u.id} className="bg-card rounded-lg border shadow-sm hover:border-primary/30 transition-colors cursor-pointer overflow-hidden"
                onClick={() => openEdit(u)}
              >
                <div className="flex items-center p-4 gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={18} className="text-muted-foreground/50" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", roleColor)}>
                        {ROLE_LABELS[primaryRole] || primaryRole}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Mail size={11} /> {u.email}
                    </p>
                  </div>

                  {/* Empresas */}
                  <div className="hidden sm:flex items-center gap-1 shrink-0">
                    {u.empresas.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground/50 italic">Sem revenda</span>
                    ) : u.empresas.length <= 2 ? (
                      u.empresas.map(e => (
                        <Badge key={e.id} variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-muted/50">
                          <Building2 size={10} className="mr-0.5" /> {e.nome}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-muted/50">
                        <Building2 size={10} className="mr-0.5" /> {u.empresas.length} revendas
                      </Badge>
                    )}
                  </div>

                  {/* Last sign in */}
                  <div className="hidden md:block text-[10px] text-muted-foreground shrink-0">
                    <Calendar size={10} className="inline mr-0.5" />
                    {formatDate(u.last_sign_in_at)}
                  </div>

                  <Pencil size={14} className="text-muted-foreground/40 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Plus size={18} /> Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={createForm.nome} onChange={e => setCreateForm({ ...createForm, nome: e.target.value })} className="mt-1 h-9" placeholder="Nome completo" />
            </div>
            <div>
              <Label className="text-xs">E-mail *</Label>
              <Input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} className="mt-1 h-9" placeholder="usuario@empresa.com" />
            </div>
            <div>
              <Label className="text-xs">Senha *</Label>
              <div className="relative mt-1">
                <Input type={showPassword ? 'text' : 'password'} value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} className="h-9 pr-9" placeholder="Mín. 6 caracteres" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Perfil (Role)</Label>
              <Select value={createForm.role} onValueChange={v => setCreateForm({ ...createForm, role: v })}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(isSuperAdmin ? ['super_admin', ...ASSIGNABLE_ROLES] : ASSIGNABLE_ROLES).map(r => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Revendas com acesso</Label>
              <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                {empresas.map(emp => (
                  <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/40 rounded px-2 py-1.5">
                    <Checkbox
                      checked={createForm.empresa_ids.includes(emp.id)}
                      onCheckedChange={() => toggleEmpresa(emp.id, createForm.empresa_ids, ids => setCreateForm({ ...createForm, empresa_ids: ids }))}
                    />
                    <Building2 size={13} className="text-muted-foreground shrink-0" />
                    <span className="truncate">{emp.nome}</span>
                    {emp.matriz_id && <span className="text-[9px] text-muted-foreground ml-auto">Filial</span>}
                  </label>
                ))}
                {empresas.length === 0 && <p className="text-xs text-muted-foreground italic px-2">Nenhuma revenda cadastrada</p>}
              </div>
            </div>
            <Button className="w-full h-9 font-medium" onClick={handleCreate} disabled={creating}>
              {creating ? <><Loader2 size={14} className="animate-spin mr-1" /> Criando...</> : 'Criar Usuário'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Pencil size={16} /> Editar Usuário</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-5">
              {/* User info (read-only) */}
              <div className="flex items-center gap-3 pb-3 border-b">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {editUser.avatar_url ? (
                    <img src={editUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={18} className="text-muted-foreground/50" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">{editUser.nome}</p>
                  <p className="text-xs text-muted-foreground">{editUser.email}</p>
                </div>
              </div>

              {/* Role */}
              <div>
                <Label className="text-xs">Perfil (Role)</Label>
                <div className="flex gap-2 mt-1">
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(isSuperAdmin ? ['super_admin', ...ASSIGNABLE_ROLES] : ASSIGNABLE_ROLES).map(r => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={handleSaveRole} disabled={saving} className="h-9 gap-1">
                    <Shield size={13} /> Salvar
                  </Button>
                </div>
              </div>

              {/* Empresas */}
              <div>
                <Label className="text-xs">Revendas com acesso</Label>
                <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto border rounded-lg p-2">
                  {empresas.map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/40 rounded px-2 py-1.5">
                      <Checkbox
                        checked={editEmpresaIds.includes(emp.id)}
                        onCheckedChange={() => toggleEmpresa(emp.id, editEmpresaIds, setEditEmpresaIds)}
                      />
                      <Building2 size={13} className="text-muted-foreground shrink-0" />
                      <span className="truncate">{emp.nome}</span>
                      {emp.matriz_id && <span className="text-[9px] text-muted-foreground ml-auto">Filial</span>}
                    </label>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="mt-2 h-8 gap-1 w-full" onClick={handleSaveEmpresas} disabled={saving}>
                  <Building2 size={13} /> Salvar Revendas
                </Button>
              </div>

              {/* Reset password */}
              <div className="border-t pt-3">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => {
                  setResetUserId(editUser.id);
                  setNewPassword('');
                  setResetOpen(true);
                }}>
                  <Key size={13} /> Redefinir senha
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Key size={16} /> Redefinir Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nova senha</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1 h-9" placeholder="Mín. 6 caracteres" />
            </div>
            <Button className="w-full h-9" onClick={handleResetPassword} disabled={resetting}>
              {resetting ? 'Redefinindo...' : 'Redefinir Senha'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
