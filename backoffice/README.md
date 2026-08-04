# Backoffice — Licor Dª Graça

Projeto separado para gerir o conteúdo do site público, servido em `/backoffice/`.

## O que permite gerir

- identidade, logótipo, favicon e destaque inicial;
- menu e mensagens gerais;
- produtos, categorias, tamanhos, preços e imagens;
- kits, preços e grupos de escolhas;
- eventos;
- secção Sobre Nós e perguntas frequentes;
- contactos, redes sociais e feedback;
- cores, visibilidade das secções e portes;
- importação e exportação de cópias de segurança.

## Configuração inicial

1. Executar `supabase/site-cms.sql` no SQL Editor do projeto Supabase.
2. Entrar no backoffice com uma das contas autorizadas no ficheiro SQL.
3. Rever o conteúdo inicial e carregar em **Guardar alterações**. Esta primeira gravação cria o conteúdo dinâmico usado pelo site público.

As imagens carregadas no backoffice são guardadas no bucket público `site-assets`. As políticas RLS permitem escrita apenas às contas autorizadas.
