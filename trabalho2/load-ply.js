/**
 * Carrega e faz o parse de um arquivo PLY ASCII (como o bun_zipper.ply).
 * Retorna coordenadas empacotadas em [x, y, z, 1] e índices triangulares.
 */
export function parsePly(text) {
    const lines = text.split(/\r?\n/);
    let vertexCount = 0;
    let faceCount = 0;
    let headerEnd = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('element vertex')) {
            vertexCount = parseInt(line.split(/\s+/)[2], 10);
        } else if (line.startsWith('element face')) {
            faceCount = parseInt(line.split(/\s+/)[2], 10);
        } else if (line === 'end_header') {
            headerEnd = i + 1;
            break;
        }
    }

    if (headerEnd === -1 || vertexCount <= 0 || faceCount <= 0) {
        throw new Error('Cabeçalho PLY inválido.');
    }

    const coords = new Float32Array(vertexCount * 4);
    let lineIdx = headerEnd;

    for (let v = 0; v < vertexCount; v++) {
        while (lineIdx < lines.length && lines[lineIdx].trim() === '') lineIdx++;
        const parts = lines[lineIdx++].trim().split(/\s+/);
        coords[v * 4 + 0] = parseFloat(parts[0]);
        coords[v * 4 + 1] = parseFloat(parts[1]);
        coords[v * 4 + 2] = parseFloat(parts[2]);
        coords[v * 4 + 3] = 1.0;
    }

    const indices = [];
    for (let f = 0; f < faceCount; f++) {
        while (lineIdx < lines.length && lines[lineIdx].trim() === '') lineIdx++;
        const parts = lines[lineIdx++].trim().split(/\s+/);
        const count = parseInt(parts[0], 10);
        const v0 = parseInt(parts[1], 10);

        // Triangulação em leque caso alguma face tenha mais de 3 vértices
        for (let k = 1; k < count - 1; k++) {
            const v1 = parseInt(parts[1 + k], 10);
            const v2 = parseInt(parts[2 + k], 10);
            indices.push(v0, v1, v2);
        }
    }

    return { coords, indices };
}

export async function loadPly(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erro ao carregar PLY: HTTP ${response.status}`);
    }
    return parsePly(await response.text());
}