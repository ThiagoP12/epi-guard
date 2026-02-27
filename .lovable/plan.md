

## Analysis: User-Unit Relationship

The relationship `USUARIO_UNIDADE` already exists in the database as the `user_empresas` table:

| Column | Type |
|--------|------|
| `id` | uuid PK |
| `user_id` | uuid |
| `empresa_id` | uuid (= unidade_id) |

RLS policies are already configured (super_admin full access, admin manages within own empresas, users read own links).

The UI is also already implemented in the **Usuários** page (`src/pages/Usuarios.tsx`):
- **Create dialog**: checkboxes to assign "Revendas com acesso" on user creation
- **Edit dialog**: checkboxes to update empresa/unidade assignments with "Salvar Revendas" button
- Backend handled via `manage-user` edge function (`update_empresas` action)

**Conclusion**: No changes needed — this feature is fully implemented. The `user_empresas` table is the `USUARIO_UNIDADE` relation, and the admin UI already allows linking/unlinking users to units.

