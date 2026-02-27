

## Plan: Integrate Unidades (Revendas) Page

The `empresas` table already has the required fields (`id`, `nome`, `ativo`, `matriz_id`, `cnpj`, etc.), so no database migration is needed. The `Revendas.tsx` page exists but is **not routed or accessible** — it's missing from both `App.tsx` routes and the sidebar menu.

### Changes

1. **Add route in `App.tsx`** — Import `Revendas` and add `<Route path="/revendas" element={<Revendas />} />` inside the Layout routes.

2. **Add sidebar menu item in `Layout.tsx`** — Add `{ label: 'Unidades', icon: Building2, path: '/revendas', phase: 1 }` to `menuItems` array (after Dashboard or Configurações).

3. **Enhance `Revendas.tsx`** — Add CRUD capabilities:
   - **Create new unit** (filial): button + dialog with nome field, auto-links to selected matriz via `matriz_id`. Only for admin/super_admin.
   - **Toggle ativo**: switch on each card to activate/deactivate units.
   - **Edit nome** (currently disabled): allow admin/super_admin to edit the name.
   - Rename page title from "Revendas" to "Unidades" for consistency with the spec.

### Files affected
- `src/App.tsx` — add route
- `src/components/Layout.tsx` — add menu item
- `src/pages/Revendas.tsx` — add create dialog, ativo toggle, allow name editing

