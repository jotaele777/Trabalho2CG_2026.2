# 🐇 Cena 3D Interativa em WebGPU (Stanford Bunny e Mesa Implícita)

Este repositório contém a entrega do **Trabalho 2** da disciplina de **Computação Gráfica (2026.2)**. O projeto consiste em uma cena 3D interativa desenvolvida inteiramente com a API gráfica **WebGPU** e shaders escritos em **WGSL**, combinando modelagem implícita, malhas poligonais com estrutura *Half-Edge*, mapeamento de textura e iluminação de Phong.

O trabalho está todo na pasta trabalho2, a pasta lib é a pasta disponibilizada com os arquivos base do webgpu e a pasta bunny é a pasta baixada através do arquivo zip fornecido.

## 📌 Sobre o Projeto

O objetivo do trabalho foi construir uma cena 3D completa a partir da base fornecida na disciplina, integrando diferentes técnicas de modelagem geométrica e iluminação por fragmento em tempo real.

**Principais características e requisitos atendidos:**
* Uso exclusivo de **WebGPU nativo** e shaders **WGSL** (sem bibliotecas de renderização externas como Three.js).
* **Mesa implícita via Marching Cubes (`100 × 81 × 100`):** extração da malha triangular da superfície $F(x,y,z) = \max(x^2 + z^2 - 0.36 - 2.5(y - 0.8)^2, -y, y - 1.6) = 0$ na inicialização, com resolução de casos ambíguos e normais calculadas por gradiente numérico.
* **Stanford Bunny e Estrutura Half-Edge:** parser próprio para o arquivo `bun_zipper.ply` e construção da estrutura *Half-Edge* para percorrer as faces incidentes a cada vértice (com tratamento de arestas de bordo) no cálculo das normais suavizadas.
* **Chão texturizado:** plano com mapeamento UV repetido utilizando a textura `Tiles074_1K-JPG_Color.jpg`.
* **Iluminação de Phong por fragmento:** cálculo das componentes ambiente, difusa e especular com **duas fontes de luz pontuais fixas no mundo**.
* **Câmera interativa em projeção perspectiva:** controle orbital ao arrastar o mouse e aproximação/afastamento (*zoom*) pela roda do mouse.

## 🚀 Como executar o projeto

Devido às políticas de segurança dos navegadores (CORS), ao carregamento do arquivo `.ply` e da textura via `fetch`, e ao uso de módulos ES6 em JavaScript, o projeto não funcionará se o arquivo HTML for aberto com um duplo clique direto do sistema operacional. É necessário rodar um servidor local.

### Pré-requisitos
* Um navegador compatível com WebGPU (Google Chrome ou Microsoft Edge na versão 113 ou superior).
* Visual Studio Code (VS Code).
* Extensão **Live Server** instalada no VS Code.

### Passo a passo
1. Clone este repositório para a sua máquina:

   git clone [https://github.com/jotaele777/Trabalho2CG_2026.2.git](https://github.com/jotaele777/Trabalho2CG_2026.2.git)



* Abra a pasta raiz do projeto no VS Code

* Navegue até o arquivo trabalho2/main.html.

* Clique com o botão direito em trabalho2/main.html e selecione "Open with Live Server" (ou clique no botão "Go Live" no canto inferior direito do VS Code).

* O navegador padrão abrirá automaticamente exibindo a cena 3D (ex: http://127.0.0.1:5500/trabalho2/main.html).

* Controles: arraste o mouse para rotacionar a câmera em torno do centro da cena e utilize a roda do mouse (scroll) para controlar o zoom.

📄 Relatório
Para entender a fundo a modelagem implícita, a estrutura Half-Edge, o modelo de iluminação e visualizar as capturas da aplicação em diferentes ângulos, consulte o relatório completo:

Relatorio.md

👥 Equipe de Desenvolvimento:

João Lucas Pontes (Estrutura da Cena, Shaders de Phong e Textura): Ficou responsável pela configuração do pipeline em WebGPU, implementação dos shaders WGSL de iluminação de Phong por fragmento com duas luzes pontuais fixas, mapeamento e repetição da textura do chão (Tiles074_1K-JPG_Color.jpg) e integração final dos modelos na cena.

Pedro Henrique Vargas (Modelagem Implícita e Marching Cubes): Desenvolveu a avaliação da superfície implícita da mesa e a implementação do algoritmo Marching Cubes (marching-cubes.js), incluindo a interpolação linear nas arestas, resolução de casos ambíguos, ajuste da resolução da grade (100 × 81 × 100) e cálculo das normais por gradiente numérico.

Pedro do Amaral Rangel (Parser PLY, Half-Edge e Câmera Interativa): Implementou o carregamento do arquivo bun_zipper.ply (load-ply.js), a estrutura Half-Edge com travessia de estrela e tratamento de arestas de bordo para o cálculo das normais por vértice (half-edge.js), além das transformações de posicionamento do Bunny e do controle orbital/zoom da câmera perspectiva (OrbitCamera).
