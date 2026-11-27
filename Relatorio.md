# Relatório de Projeto: Cena 3D Interativa em WebGPU (Stanford Bunny e Mesa Implícita)

Este projeto implementa uma cena 3D interativa desenvolvida exclusivamente com a API WebGPU e shaders WGSL, tendo como base os códigos fornecidos na disciplina. A cena é composta pelo modelo *Stanford Bunny* ("bun_zipper.ply") apoiado sobre uma mesa modelada implicitamente via *Marching Cubes*, posicionada sobre um chão plano texturizado, com iluminação de Phong por fragmento (duas luzes pontuais fixas) e câmera orbital em projeção perspectiva.

## 1. Estrutura de Arquivos

O projeto foi organizado na pasta "trabalho2/" da seguinte forma:

* **"../lib/utils.js" e "../lib/webgpu.js":** Bibliotecas base fornecidas na disciplina, contendo as operações matriciais (translação, escala, "lookAt", projeção perspectiva e matriz normal) e a abstração do pipeline gráfico do WebGPU.
* **"main.html" e "main.css":** Estrutura da página e estilização básica do canvas ("1024x768").
* **"phong.vert.js" e "phong.frag.js":** Shaders WGSL responsáveis pela iluminação de Phong por fragmento com duas fontes de luz pontuais para os objetos de cor sólida (mesa e *Stanford Bunny*).
* **"floor.vert.js" e "floor.frag.js":** Shaders WGSL utilizados no chão, realizando a amostragem da textura 2D ("Tiles074_1K-JPG_Color.jpg") como cor difusa combinada ao modelo de iluminação de Phong.
* **"marching-cubes.js":** Implementação do algoritmo *Marching Cubes* para extração da malha triangular da mesa a partir da função implícita $F(x, y, z) = 0$.
* **"load-ply.js":** Parser para leitura dos vértices e faces triangulares do arquivo ASCII "bun_zipper.ply".
* **"half-edge.js":** Implementação da estrutura de dados *Half-Edge* ("Vertex", "HalfEdge", "Face" e "HalfEdgeDS"), utilizada para percorrer as faces incidentes a cada vértice e calcular suas normais.
* **"main.js":** Arquivo principal do projeto, contendo a montagem da cena, transformações de posicionamento, controle interativo da câmera e o loop de renderização.

## 2. Principais Funções e Lógica

### Modelagem Implícita da Mesa ("marching-cubes.js")

* **"tableField(x, y, z)":** Avalia a função implícita $F(x,y,z) = \max(x^2 + z^2 - 0.36 - 2.5(y - 0.8)^2, -y, y - 1.6)$ no domínio $[-1.6, 1.6] \times [-0.2, 1.8] \times [-1.6, 1.6]$.
* **"createImplicitTable(resolution, color)":** Gera a malha triangular uma única vez na inicialização usando uma grade regular de resolução **"100 × 81 × 100"** (escolhida com "ny" ímpar para evitar que planos da grade coincidam exatamente com $y = 0$ e $y = 1.6$, preservando a curvatura das laterais e o recorte circular do topo e da base). Para cada célula ativa, determina os cruzamentos nas 12 arestas por interpolação linear, resolve faces ambíguas via decisor assintótico e triangula os polígonos gerados.
* **"computeFieldNormal(x, y, z)":** Calcula as normais dos vértices da mesa através do gradiente numérico por diferenças centrais da função implícita, garantindo iluminação suave nas laterais curvas e transição limpa nas quinas do topo e da base.

### Stanford Bunny e Estrutura Half-Edge ("load-ply.js" e "half-edge.js")

* **"parsePly(text)" e "loadPly(url)":** Lê o cabeçalho do "bun_zipper.ply" e extrai os 35.947 vértices e 69.451 faces triangulares.
* **"HalfEdgeDS.build(coords, trigs)":** Constrói os vértices, faces e semi-arestas, associa semi-arestas opostas ("computeOpposites") e prioriza arestas de bordo ("opposite === null") em "computeVertexHe".
* **"estrela(v)" e "computeVertexNormals()":** Utiliza efetivamente a estrutura *half-edge* para percorrer todas as faces incidentes a cada vértice. Para tratar corretamente as aberturas na base do *Bunny*, quando a travessia encontra uma aresta de bordo ("opposite === null") sem fechar o ciclo, o algoritmo percorre também o sentido oposto ("start.opposite"). As normais das faces incidentes são somadas e normalizadas para compor a normal de cada vértice.

### Cena, Iluminação, Textura e Câmera ("main.js" e Shaders)

* **"createFloorGeometry(size, repeat)":** Cria o plano do chão formado por dois triângulos em "y = -0.005" (evitando *z-fighting* com a base da mesa) com coordenadas UV repetidas ("addressModeU/V: 'repeat'").
* **Iluminação de Phong ("phong.frag.js" e "floor.frag.js"):** Calcula as componentes ambiente, difusa e especular por fragmento no espaço da câmera, normalizando as normais interpoladas e transformando as duas luzes pontuais fixas no mundo pela matriz "view" para que permaneçam estáticas durante a movimentação da câmera.
* **Posicionamento do Bunny ("Scene"):** Calcula a *bounding box* do modelo e aplica translação e escala uniforme para centralizá-lo e apoiá-lo exatamente sobre o topo plano da mesa ($y = 1.6$).
* **"OrbitCamera":** Controla a órbita da câmera ao arrastar o mouse e a distância ao centro da cena pela roda do mouse ("wheel"), mantendo o alvo fixo na região central da mesa e do *Bunny* com projeção perspectiva ("createPerspectiveMat4") e teste de profundidade habilitado.

## 3. Divisão de Tarefas da Equipe

Para manter o desenvolvimento organizado e equilibrado, o grupo dividiu as responsabilidades em três frentes integradas:

* **João Lucas Pontes (Estrutura da Cena, Shaders de Phong e Textura):**
  Ficou responsável pela configuração do pipeline em WebGPU, implementação dos shaders WGSL de iluminação de Phong por fragmento com duas luzes pontuais fixas, mapeamento e repetição da textura do chão ("Tiles074_1K-JPG_Color.jpg") e integração final dos modelos na cena.
* **Pedro Henrique Vargas (Modelagem Implícita e Marching Cubes):**
  Desenvolveu a avaliação da superfície implícita da mesa e a implementação do algoritmo *Marching Cubes* ("marching-cubes.js"), incluindo a interpolação linear nas arestas, resolução de casos ambíguos, ajuste da resolução da grade ("100 × 81 × 100") e cálculo das normais por gradiente numérico.
* **Pedro do Amaral Rangel (Parser PLY, Half-Edge e Câmera Interativa):**
  Implementou o carregamento do arquivo "bun_zipper.ply" ("load-ply.js"), a estrutura *Half-Edge* com travessia de estrela e tratamento de arestas de bordo para o cálculo das normais por vértice ("half-edge.js"), além das transformações de posicionamento do *Bunny* e do controle orbital/zoom da câmera perspectiva ("OrbitCamera").

## 4. Imagens da Aplicação

* **Vista em perspectiva (padrão):** ![Vista em perspectiva](./img/Perspectiva.JPG)
* **Vista lateral (perfil):** ![Vista lateral](./img/Lateral.JPG)
* **Vista traseira:** ![Vista traseira](./img/Traseira.JPG)
* **Vista superior:** ![Vista superior](./img/Superior.JPG)

## 5. Instruções de Execução

1. Abra a pasta raiz do repositório (que contém as pastas lib/ e trabalho2/) no Visual Studio Code.
2. Utilize a extensão **Live Server** clicando com o botão direito em trabalho2/main.html e selecionando **Open with Live Server**.
3. Interaja com a cena arrastando o mouse para rotacionar a câmera em torno do centro e utilizando a roda do mouse para aproximar ou afastar o zoom.
