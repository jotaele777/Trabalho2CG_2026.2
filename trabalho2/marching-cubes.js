/**
 * Função implícita da mesa:
 * F(x, y, z) = max(x^2 + z^2 - 0.36 - 2.5 * (y - 0.8)^2, -y, y - 1.6)
 * Interior: F < 0 | Superfície: F = 0 | Exterior: F > 0
 */
export function tableField(x, y, z) {
    const dy = y - 0.8;
    const fSide = x * x + z * z - 0.36 - 2.5 * dy * dy;
    const fBottom = -y;
    const fTop = y - 1.6;
    return Math.max(fSide, fBottom, fTop);
}

// 12 arestas do cubo unitário
const CUBE_EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0], // face traseira (z0)
    [4, 5], [5, 6], [6, 7], [7, 4], // face frontal (z1)
    [0, 4], [1, 5], [2, 6], [3, 7], // arestas paralelas ao eixo Z
];

// 6 faces do cubo em ordem anti-horária (CCW) vistas de fora,
// acompanhadas dos índices das 4 arestas correspondentes
const CUBE_FACES = [
    { corners: [0, 3, 2, 1], edges: [3, 2, 1, 0] },   // -Z
    { corners: [4, 5, 6, 7], edges: [4, 5, 6, 7] },   // +Z
    { corners: [0, 1, 5, 4], edges: [0, 9, 4, 8] },   // -Y
    { corners: [3, 7, 6, 2], edges: [11, 6, 10, 2] }, // +Y
    { corners: [0, 4, 7, 3], edges: [8, 7, 11, 3] },  // -X
    { corners: [1, 2, 6, 5], edges: [1, 10, 5, 9] },  // +X
];

// Tabela de casos de Marching Squares por face (bit = 1 quando F < 0).
// Cada par [inicio, fim] orienta o contorno no sentido CCW visto de fora.
const FACE_CASES = [
    [],               // 0
    [[3, 0]],         // 1
    [[0, 1]],         // 2
    [[3, 1]],         // 3
    [[1, 2]],         // 4
    null,             // 5 (ambíguo)
    [[0, 2]],         // 6
    [[3, 2]],         // 7
    [[2, 3]],         // 8
    [[2, 0]],         // 9
    null,             // 10 (ambíguo)
    [[2, 1]],         // 11
    [[1, 3]],         // 12
    [[1, 0]],         // 13
    [[0, 3]],         // 14
    [],               // 15
];

function interpolateVertex(p1, v1, p2, v2) {
    const denom = v2 - v1;
    const t = Math.abs(denom) < 1e-8 ? 0.5 : -v1 / denom;
    return [
        p1[0] + t * (p2[0] - p1[0]),
        p1[1] + t * (p2[1] - p1[1]),
        p1[2] + t * (p2[2] - p1[2]),
    ];
}

function computeFieldNormal(x, y, z, h = 0.015) {
    const nx = tableField(x + h, y, z) - tableField(x - h, y, z);
    const ny = tableField(x, y + h, z) - tableField(x, y - h, z);
    const nz = tableField(x, y, z + h) - tableField(x, y, z - h);
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
}

function pushTriangle(positions, colors, normals, a, b, c, color) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const faceLen = Math.hypot(
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
    );
    if (faceLen < 1e-10) {
        return;
    }

    const verts = [a, b, c];
    for (let i = 0; i < 3; i++) {
        const v = verts[i];
        const n = computeFieldNormal(v[0], v[1], v[2]);
        positions.push(v[0], v[1], v[2], 1.0);
        colors.push(color[0], color[1], color[2], color[3]);
        normals.push(n[0], n[1], n[2], 0.0);
    }
}

/**
 * Gera a malha triangular da mesa no domínio [-1.6, 1.6] x [-0.2, 1.8] x [-1.6, 1.6]
 * usando Marching Cubes clássico nas 12 arestas de cada célula.
 */
export function createImplicitTable(
    resolution = [96, 65, 96],
    color = [0.28, 0.52, 0.96, 1.0],
) {
    const [nx, ny, nz] = resolution;
    const minX = -1.6, maxX = 1.6;
    const minY = -0.2, maxY = 1.8;
    const minZ = -1.6, maxZ = 1.6;

    const dx = (maxX - minX) / nx;
    const dy = (maxY - minY) / ny;
    const dz = (maxZ - minZ) / nz;

    const sx = nx + 1;
    const sy = ny + 1;
    const strideY = sx;
    const strideZ = sx * sy;

    // 1. Avalia F(x, y, z) uma única vez em cada vértice da grade regular
    const field = new Float32Array(sx * sy * (nz + 1));
    for (let k = 0; k <= nz; k++) {
        const z = minZ + k * dz;
        for (let j = 0; j <= ny; j++) {
            const y = minY + j * dy;
            for (let i = 0; i <= nx; i++) {
                const x = minX + i * dx;
                field[k * strideZ + j * strideY + i] = tableField(x, y, z);
            }
        }
    }

    const positions = [];
    const colors = [];
    const normals = [];
    const nextEdge = new Int8Array(12);

    // 2. Percorre cada célula cúbica da grade
    for (let k = 0; k < nz; k++) {
        const z0 = minZ + k * dz;
        const z1 = z0 + dz;
        for (let j = 0; j < ny; j++) {
            const y0 = minY + j * dy;
            const y1 = y0 + dy;
            for (let i = 0; i < nx; i++) {
                const x0 = minX + i * dx;
                const x1 = x0 + dx;

                const idx0 = k * strideZ + j * strideY + i;
                const vals = [
                    field[idx0],
                    field[idx0 + 1],
                    field[idx0 + strideY + 1],
                    field[idx0 + strideY],
                    field[idx0 + strideZ],
                    field[idx0 + strideZ + 1],
                    field[idx0 + strideZ + strideY + 1],
                    field[idx0 + strideZ + strideY],
                ];

                // Caso da célula (8 bits, 0..255)
                let cubeCase = 0;
                for (let c = 0; c < 8; c++) {
                    if (vals[c] < 0) cubeCase |= (1 << c);
                }
                if (cubeCase === 0 || cubeCase === 255) continue;

                const pts = [
                    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
                    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
                ];

                // 3. Conecta as arestas cruzadas em cada uma das 6 faces
                nextEdge.fill(-1);
                for (const face of CUBE_FACES) {
                    const [c0, c1, c2, c3] = face.corners;
                    const v0 = vals[c0], v1 = vals[c1], v2 = vals[c2], v3 = vals[c3];
                    const mask =
                        (v0 < 0 ? 1 : 0) |
                        (v1 < 0 ? 2 : 0) |
                        (v2 < 0 ? 4 : 0) |
                        (v3 < 0 ? 8 : 0);

                    if (mask === 0 || mask === 15) continue;

                    let pairs = FACE_CASES[mask];
                    if (pairs === null) {
                        // Decisor assintótico para faces ambíguas (casos 5 e 10)
                        const det = v0 * v2 - v1 * v3;
                        if (mask === 5) {
                            pairs = det >= 0 ? [[3, 2], [1, 0]] : [[3, 0], [1, 2]];
                        } else {
                            pairs = det >= 0 ? [[0, 1], [2, 3]] : [[0, 3], [2, 1]];
                        }
                    }

                    for (const [startLocal, endLocal] of pairs) {
                        nextEdge[face.edges[startLocal]] = face.edges[endLocal];
                    }
                }

                // 4. Calcula as interseções por interpolação linear apenas nas arestas ativas
                const edgePts = new Array(12);
                for (let e = 0; e < 12; e++) {
                    if (nextEdge[e] !== -1) {
                        const [a, b] = CUBE_EDGES[e];
                        edgePts[e] = interpolateVertex(pts[a], vals[a], pts[b], vals[b]);
                    }
                }

                // 5. Extrai os ciclos fechados e triangula cada polígono
                const visited = new Uint8Array(12);
                for (let e = 0; e < 12; e++) {
                    if (nextEdge[e] === -1 || visited[e]) continue;

                    const loop = [];
                    let curr = e;
                    while (curr !== -1 && !visited[curr]) {
                        visited[curr] = 1;
                        loop.push(edgePts[curr]);
                        curr = nextEdge[curr];
                    }

                    for (let t = 1; t < loop.length - 1; t++) {
                        pushTriangle(positions, colors, normals, loop[0], loop[t], loop[t + 1], color);
                    }
                }
            }
        }
    }

    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        normals: new Float32Array(normals),
        vertexCount: positions.length / 4,
    };
}