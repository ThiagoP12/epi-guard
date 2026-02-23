import { useState, useEffect, useRef } from 'react';
import { Save, Upload, X, ImageIcon, Camera, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import SetoresManager from '@/components/SetoresManager';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Config {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
}

const labels: Record<string, string> = {
  empresa_razao_social: 'Razão Social',
  empresa_cnpj: 'CNPJ',
  empresa_endereco: 'Endereço',
  empresa_telefone: 'Telefone',
  dias_alerta_vencimento: 'Dias para alerta "vencendo"',
  periodicidade_inspecao_epc: 'Periodicidade inspeção EPC (dias)',
  criterio_epi_atualizado_meses: 'Critério EPI atualizado (meses)',
  data_ultimo_acidente: 'Data do último acidente',
  termo_nr06_texto: 'Texto do Termo NR-06',
};

export default function Configuracoes() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const loadLogo = async () => {
    const { data } = await supabase.storage.from('empresa').list('', { limit: 10 });
    const logoFile = data?.find(f => f.name.startsWith('logo'));
    if (logoFile) {
      const { data: urlData } = supabase.storage.from('empresa').getPublicUrl(logoFile.name);
      setLogoUrl(urlData.publicUrl + '?t=' + Date.now());
    }
  };

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('configuracoes').select('*').order('chave');
      if (data) {
        setConfigs(data as Config[]);
        const v: Record<string, string> = {};
        data.forEach((c: any) => { v[c.chave] = c.valor; });
        setValues(v);
      }
    };
    load();
    loadLogo();
  }, []);

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Erro', description: 'Selecione um arquivo de imagem.', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Erro', description: 'Imagem deve ter no máximo 2MB.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `logo.${ext}`;

    // Remove old logos
    const { data: existing } = await supabase.storage.from('empresa').list('', { limit: 10 });
    const oldLogos = existing?.filter(f => f.name.startsWith('logo')) || [];
    if (oldLogos.length > 0) {
      await supabase.storage.from('empresa').remove(oldLogos.map(f => f.name));
    }

    const { error } = await supabase.storage.from('empresa').upload(fileName, file, { upsert: true });
    setUploading(false);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Logo atualizado!' });
      loadLogo();
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveLogo = async () => {
    const { data } = await supabase.storage.from('empresa').list('', { limit: 10 });
    const logos = data?.filter(f => f.name.startsWith('logo')) || [];
    if (logos.length > 0) {
      await supabase.storage.from('empresa').remove(logos.map(f => f.name));
      setLogoUrl(null);
      toast({ title: 'Logo removido.' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    for (const config of configs) {
      if (values[config.chave] !== config.valor) {
        await supabase.from('configuracoes').update({ valor: values[config.chave] }).eq('id', config.id);
      }
    }
    toast({ title: 'Configurações salvas!' });
    setSaving(false);
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Erro', description: 'Selecione um arquivo de imagem.', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Erro', description: 'Imagem deve ter no máximo 2MB.', variant: 'destructive' });
      return;
    }
    setUploadingAvatar(true);
    const ext = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${ext}`;

    // Remove old avatars
    const { data: existing } = await supabase.storage.from('avatars').list(user.id, { limit: 10 });
    const oldFiles = existing?.filter(f => f.name.startsWith('avatar')) || [];
    if (oldFiles.length > 0) {
      await supabase.storage.from('avatars').remove(oldFiles.map(f => `${user.id}/${f.name}`));
    }

    const { error } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now();

    await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);
    setUploadingAvatar(false);
    toast({ title: 'Foto atualizada!' });
    // Reload page to refresh context
    window.location.reload();
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    const { data: existing } = await supabase.storage.from('avatars').list(user.id, { limit: 10 });
    const oldFiles = existing?.filter(f => f.name.startsWith('avatar')) || [];
    if (oldFiles.length > 0) {
      await supabase.storage.from('avatars').remove(oldFiles.map(f => `${user.id}/${f.name}`));
    }
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    toast({ title: 'Foto removida.' });
    window.location.reload();
  };

  const empresaKeys = ['empresa_razao_social', 'empresa_cnpj', 'empresa_endereco', 'empresa_telefone'];
  const paramKeys = ['dias_alerta_vencimento', 'periodicidade_inspecao_epc', 'criterio_epi_atualizado_meses', 'data_ultimo_acidente'];

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-5">Configurações</h1>
      <div className="max-w-2xl space-y-6">
        {/* Meu Perfil */}
        <div className="bg-card rounded-lg border p-5">
          <h2 className="text-sm font-semibold mb-4">Meu Perfil</h2>
          <div className="flex items-center gap-5">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/30 shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <User size={32} className="text-muted-foreground/40" />
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                disabled={uploadingAvatar}
              >
                <Camera size={20} className="text-primary-foreground" />
              </button>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{profile?.nome || 'Usuário'}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                  <Upload size={14} className="mr-1" /> {uploadingAvatar ? 'Enviando...' : 'Alterar foto'}
                </Button>
                {profile?.avatar_url && (
                  <Button variant="ghost" size="sm" onClick={handleRemoveAvatar} className="text-destructive">
                    <X size={14} className="mr-1" /> Remover
                  </Button>
                )}
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleUploadAvatar} className="hidden" />
              <p className="text-[10px] text-muted-foreground">PNG, JPG. Máx 2MB.</p>
            </div>
          </div>
        </div>
        {/* Logo da Empresa */}
        <div className="bg-card rounded-lg border p-5">
          <h2 className="text-sm font-semibold mb-4">Logo da Empresa</h2>
          <div className="flex items-center gap-5">
            <div className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/30 shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo da empresa" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon size={32} className="text-muted-foreground/40" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">PNG, JPG ou SVG. Máx 2MB.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload size={14} className="mr-1" /> {uploading ? 'Enviando...' : 'Enviar imagem'}
                </Button>
                {logoUrl && (
                  <Button variant="ghost" size="sm" onClick={handleRemoveLogo} className="text-destructive">
                    <X size={14} className="mr-1" /> Remover
                  </Button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadLogo} className="hidden" />
            </div>
          </div>
        </div>

        {/* Setores */}
        <SetoresManager />

        <div className="bg-card rounded-lg border p-5">
          <h2 className="text-sm font-semibold mb-4">Dados da Empresa (Termo NR-06)</h2>
          <div className="space-y-3">
            {empresaKeys.map(key => (
              <div key={key}>
                <Label>{labels[key] || key}</Label>
                <Input value={values[key] || ''} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className="mt-1" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h2 className="text-sm font-semibold mb-4">Parâmetros do Sistema</h2>
          <div className="grid grid-cols-2 gap-3">
            {paramKeys.map(key => (
              <div key={key}>
                <Label>{labels[key] || key}</Label>
                <Input
                  type={key === 'data_ultimo_acidente' ? 'date' : 'text'}
                  value={values[key] || ''}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          <Save size={16} className="mr-2" /> {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}
