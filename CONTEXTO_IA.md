# Contexto do Projeto - CRM Unimed

Este documento fornece um resumo técnico e funcional do projeto para auxiliar IAs no desenvolvimento e manutenção do código.

## 📌 Visão Geral
O projeto é um **Gerador de Propostas Comerciais para a Unimed**, desenvolvido como uma aplicação web moderna. Ele permite que consultores e vendedores criem propostas personalizadas, consultem dados de empresas via CNPJ e gerem documentos prontos para impressão/PDF.

## 🛠️ Stack Tecnológica
- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS + Vanilla CSS
- **Frontend**: React 19
- **Autenticação e Banco de Dados**: [Supabase](https://supabase.com/)
- **Animações**: Framer Motion (importado como `motion/react`)
- **Ícones**: Lucide React
- **Processamento de Dados**: PapaParse (CSV), date-fns
- **Geração de Documentos**: jsPDF, html2canvas
- **IA**: Integração com Google Generative AI (Gemini)

## 📂 Estrutura de Pastas Principal
- `/app`: Roteamento e páginas principais.
  - `page.tsx`: Componente principal `UnimedProposalGenerator` (Contém a lógica de negócio central).
  - `layout.tsx`: Layout raiz com configurações de SEO e fontes.
  - `/api`: Endpoints do backend (ex: busca de planos).
- `/components`: Componentes reutilizáveis (Login, UI, etc).
- `/hooks`: Custom hooks (ex: `useAuth.ts` para gerenciamento de sessão).
- `/lib`: Configurações de bibliotecas externas (Supabase client).
- `/public`: Ativos estáticos como logos e imagens de capa de propostas.
- `/supabase`: Configurações e scripts relacionados ao banco de dados.

## ⚙️ Funcionalidades Principais
1. **Autenticação**: Gerenciada pelo Supabase Auth.
2. **Busca de CNPJ**: Integração com BrasilAPI para autopreencher dados da empresa.
3. **Seleção de Planos**: Filtros dinâmicos por abrangência e acomodação.
4. **Cálculo de Proposta**: Lógica complexa de cálculo baseada em faixas etárias, quantidades de vidas e descontos.
5. **Geração de PDF/Impressão**: Layout otimizado para impressão que gera um documento de várias páginas (Capa, Tabelas de Preços, Condições, etc).
6. **Histórico**: Armazenamento de propostas geradas no Supabase e fallback em LocalStorage.

## 📋 Regras de Negócio Importantes
- **Cálculo de Desconto**: Aplicado sobre o valor de cada faixa etária antes da soma total.
- **Registro ANS**: Todos os planos devem exibir o registro ANS formatado (ex: `000.000.00-0`).
- **Pós-Impressão**: A aplicação recarrega a página (`window.location.reload()`) após a confirmação do fluxo de impressão para limpar o estado sensível.
- **Sync de Perfil**: O nome do vendedor é sincronizado automaticamente a partir do perfil do usuário logado no Supabase.

## 🚀 Como Contribuir
- Mantenha a estética premium e vibrante (estilo Unimed).
- Use componentes do Framer Motion para micro-interações.
- Certifique-se de que novos planos adicionados ao CSV/API sigam a interface `Plan`.
- Evite placeholders; use imagens reais ou gere assets conforme necessário.

---
*Este arquivo deve ser atualizado sempre que houver mudanças significativas na arquitetura ou regras de negócio.*
