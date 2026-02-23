export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      colaboradores: {
        Row: {
          ativo: boolean
          created_at: string
          data_admissao: string
          email: string | null
          funcao: string
          id: string
          matricula: string
          nome: string
          setor: string
          tamanho_bota: string | null
          tamanho_luva: string | null
          tamanho_uniforme: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_admissao?: string
          email?: string | null
          funcao: string
          id?: string
          matricula: string
          nome: string
          setor: string
          tamanho_bota?: string | null
          tamanho_luva?: string | null
          tamanho_uniforme?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_admissao?: string
          email?: string | null
          funcao?: string
          id?: string
          matricula?: string
          nome?: string
          setor?: string
          tamanho_bota?: string | null
          tamanho_luva?: string | null
          tamanho_uniforme?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          chave: string
          descricao: string | null
          id: string
          updated_at: string
          valor: string
        }
        Insert: {
          chave: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor: string
        }
        Update: {
          chave?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      entrega_epi_itens: {
        Row: {
          ca_snapshot: string | null
          created_at: string
          custo_unitario_snapshot: number | null
          entrega_id: string
          id: string
          nome_snapshot: string
          produto_id: string
          quantidade: number
          validade_snapshot: string | null
        }
        Insert: {
          ca_snapshot?: string | null
          created_at?: string
          custo_unitario_snapshot?: number | null
          entrega_id: string
          id?: string
          nome_snapshot: string
          produto_id: string
          quantidade: number
          validade_snapshot?: string | null
        }
        Update: {
          ca_snapshot?: string | null
          created_at?: string
          custo_unitario_snapshot?: number | null
          entrega_id?: string
          id?: string
          nome_snapshot?: string
          produto_id?: string
          quantidade?: number
          validade_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entrega_epi_itens_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "entregas_epi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrega_epi_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas_epi: {
        Row: {
          assinatura_base64: string
          colaborador_id: string
          created_at: string
          data_hora: string
          declaracao_aceita: boolean
          email_enviado: boolean | null
          email_enviado_em: string | null
          email_erro: string | null
          id: string
          ip_origem: string | null
          motivo: Database["public"]["Enums"]["motivo_entrega"]
          observacao: string | null
          pdf_hash: string | null
          pdf_storage_path: string | null
          user_agent: string | null
          usuario_id: string
          versao_termo: string | null
        }
        Insert: {
          assinatura_base64: string
          colaborador_id: string
          created_at?: string
          data_hora?: string
          declaracao_aceita?: boolean
          email_enviado?: boolean | null
          email_enviado_em?: string | null
          email_erro?: string | null
          id?: string
          ip_origem?: string | null
          motivo: Database["public"]["Enums"]["motivo_entrega"]
          observacao?: string | null
          pdf_hash?: string | null
          pdf_storage_path?: string | null
          user_agent?: string | null
          usuario_id: string
          versao_termo?: string | null
        }
        Update: {
          assinatura_base64?: string
          colaborador_id?: string
          created_at?: string
          data_hora?: string
          declaracao_aceita?: boolean
          email_enviado?: boolean | null
          email_enviado_em?: string | null
          email_erro?: string | null
          id?: string
          ip_origem?: string | null
          motivo?: Database["public"]["Enums"]["motivo_entrega"]
          observacao?: string | null
          pdf_hash?: string | null
          pdf_storage_path?: string | null
          user_agent?: string | null
          usuario_id?: string
          versao_termo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregas_epi_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          ajuste_tipo: Database["public"]["Enums"]["ajuste_tipo"] | null
          colaborador_id: string | null
          created_at: string
          data_hora: string
          entrega_id: string | null
          id: string
          motivo: string | null
          observacao: string | null
          produto_id: string
          quantidade: number
          referencia_nf: string | null
          tipo_movimentacao: Database["public"]["Enums"]["tipo_movimentacao"]
          usuario_id: string | null
        }
        Insert: {
          ajuste_tipo?: Database["public"]["Enums"]["ajuste_tipo"] | null
          colaborador_id?: string | null
          created_at?: string
          data_hora?: string
          entrega_id?: string | null
          id?: string
          motivo?: string | null
          observacao?: string | null
          produto_id: string
          quantidade: number
          referencia_nf?: string | null
          tipo_movimentacao: Database["public"]["Enums"]["tipo_movimentacao"]
          usuario_id?: string | null
        }
        Update: {
          ajuste_tipo?: Database["public"]["Enums"]["ajuste_tipo"] | null
          colaborador_id?: string | null
          created_at?: string
          data_hora?: string
          entrega_id?: string | null
          id?: string
          motivo?: string | null
          observacao?: string | null
          produto_id?: string
          quantidade?: number
          referencia_nf?: string | null
          tipo_movimentacao?: Database["public"]["Enums"]["tipo_movimentacao"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          ca: string | null
          codigo_interno: string
          created_at: string
          custo_unitario: number | null
          data_validade: string | null
          estoque_minimo: number
          fornecedor: string | null
          id: string
          localizacao_fisica: string | null
          marca: string | null
          nome: string
          tamanho: string | null
          tipo: Database["public"]["Enums"]["tipo_produto"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          ca?: string | null
          codigo_interno: string
          created_at?: string
          custo_unitario?: number | null
          data_validade?: string | null
          estoque_minimo?: number
          fornecedor?: string | null
          id?: string
          localizacao_fisica?: string | null
          marca?: string | null
          nome: string
          tamanho?: string | null
          tipo: Database["public"]["Enums"]["tipo_produto"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          ca?: string | null
          codigo_interno?: string
          created_at?: string
          custo_unitario?: number | null
          data_validade?: string | null
          estoque_minimo?: number
          fornecedor?: string | null
          id?: string
          localizacao_fisica?: string | null
          marca?: string | null
          nome?: string
          tamanho?: string | null
          tipo?: Database["public"]["Enums"]["tipo_produto"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          setor: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nome: string
          setor?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          setor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_saldo_produto: { Args: { p_produto_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      ajuste_tipo: "AUMENTO" | "REDUCAO"
      app_role: "admin" | "almoxarifado" | "gestor"
      motivo_entrega:
        | "Primeira entrega"
        | "Troca por desgaste"
        | "Perda"
        | "Danificado"
        | "Outro"
      tipo_movimentacao: "ENTRADA" | "SAIDA" | "AJUSTE"
      tipo_produto: "EPI" | "EPC"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ajuste_tipo: ["AUMENTO", "REDUCAO"],
      app_role: ["admin", "almoxarifado", "gestor"],
      motivo_entrega: [
        "Primeira entrega",
        "Troca por desgaste",
        "Perda",
        "Danificado",
        "Outro",
      ],
      tipo_movimentacao: ["ENTRADA", "SAIDA", "AJUSTE"],
      tipo_produto: ["EPI", "EPC"],
    },
  },
} as const
