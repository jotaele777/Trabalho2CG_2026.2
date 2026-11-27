export class Vertex {
    constructor(vid, x, y, z, color = [0.95, 0.91, 0.82, 1.0]) {
        this.vid = vid;
        this.position = [x, y, z, 1.0];
        this.normal = [0.0, 0.0, 0.0, 0.0];
        this.color = color;
        this.he = null;
    }
}

export class HalfEdge {
    constructor(vertex) {
        this.vertex = vertex;
        this.next = null;
        this.face = null;
        this.opposite = null;
    }
}

export class Face {
    constructor(baseHe) {
        this.baseHe = baseHe;
        this.normal = [0.0, 0.0, 0.0];
    }
}

export class HalfEdgeDS {
    constructor() {
        this.vertices = [];
        this.halfEdges = [];
        this.faces = [];
    }

    build(coords, trigs) {
        // 1. Constrói os vértices
        for (let i = 0; i < coords.length; i += 4) {
            this.vertices.push(
                new Vertex(i / 4, coords[i], coords[i + 1], coords[i + 2]),
            );
        }

        // 2. Constrói faces e semi-arestas
        for (let tid = 0; tid < trigs.length; tid += 3) {
            const v0 = this.vertices[trigs[tid]];
            const v1 = this.vertices[trigs[tid + 1]];
            const v2 = this.vertices[trigs[tid + 2]];

            const he0 = new HalfEdge(v0);
            const he1 = new HalfEdge(v1);
            const he2 = new HalfEdge(v2);

            const face = new Face(he0);
            this.faces.push(face);

            he0.face = face;
            he1.face = face;
            he2.face = face;

            he0.next = he1;
            he1.next = he2;
            he2.next = he0;

            this.halfEdges.push(he0, he1, he2);
        }

        this.computeOpposites();
        this.computeVertexHe();
        this.computeFaceNormals();
        this.computeVertexNormals();
    }

    computeOpposites() {
        const edgeMap = new Map();

        for (let hid = 0; hid < this.halfEdges.length; hid++) {
            const he = this.halfEdges[hid];
            const a = he.vertex.vid;
            const b = he.next.vertex.vid;
            const key = a < b ? `${a},${b}` : `${b},${a}`;

            const op = edgeMap.get(key);
            if (op !== undefined) {
                op.opposite = he;
                he.opposite = op;
                edgeMap.delete(key);
            } else {
                edgeMap.set(key, he);
            }
        }
    }

    computeVertexHe() {
        for (let hid = 0; hid < this.halfEdges.length; hid++) {
            const he = this.halfEdges[hid];
            const v = he.vertex;

            if (v.he === null || he.opposite === null) {
                v.he = he;
            }
        }
    }

    computeFaceNormals() {
        for (const face of this.faces) {
            const v0 = face.baseHe.vertex.position;
            const v1 = face.baseHe.next.vertex.position;
            const v2 = face.baseHe.next.next.vertex.position;

            const e1x = v1[0] - v0[0], e1y = v1[1] - v0[1], e1z = v1[2] - v0[2];
            const e2x = v2[0] - v0[0], e2y = v2[1] - v0[1], e2z = v2[2] - v0[2];

            // Produto vetorial (ponderado pela área da face)
            face.normal = [
                e1y * e2z - e1z * e2y,
                e1z * e2x - e1x * e2z,
                e1x * e2y - e1y * e2x,
            ];
        }
    }

    /**
     * Retorna todas as faces incidentes ao vértice v percorrendo a estrutura
     * half-edge nos dois sentidos quando encontra uma aresta de bordo (opposite === null).
     */
    estrela(v) {
        const incidentFaces = [];
        const start = v.he;
        if (!start) return incidentFaces;

        // Sentido 1: he -> he.next.next.opposite
        let curr = start;
        let closed = false;
        while (curr !== null) {
            incidentFaces.push(curr.face);
            const nextHe = curr.next.next.opposite;
            if (nextHe === start) {
                closed = true;
                break;
            }
            curr = nextHe;
        }

        // Sentido 2 (apenas se o vértice estiver no bordo e o ciclo não fechou)
        if (!closed) {
            let opp = start.opposite;
            while (opp !== null) {
                const prevHe = opp.next;
                if (prevHe === start) break;
                incidentFaces.push(prevHe.face);
                opp = prevHe.opposite;
            }
        }

        return incidentFaces;
    }

    /**
     * Calcula e normaliza a normal de cada vértice usando as faces incidentes
     * obtidas pela travessia na estrutura half-edge.
     */
    computeVertexNormals() {
        for (const v of this.vertices) {
            const faces = this.estrela(v);
            let nx = 0, ny = 0, nz = 0;

            for (const f of faces) {
                nx += f.normal[0];
                ny += f.normal[1];
                nz += f.normal[2];
            }

            const len = Math.hypot(nx, ny, nz);
            if (len > 0) {
                v.normal = [nx / len, ny / len, nz / len, 0.0];
            } else {
                v.normal = [0.0, 1.0, 0.0, 0.0];
            }
        }
    }

    getVBOs() {
        const coords = new Float32Array(this.vertices.length * 4);
        const colors = new Float32Array(this.vertices.length * 4);
        const normals = new Float32Array(this.vertices.length * 4);
        const indices = new Uint32Array(this.halfEdges.length);

        for (let i = 0; i < this.vertices.length; i++) {
            const v = this.vertices[i];
            coords.set(v.position, i * 4);
            colors.set(v.color, i * 4);
            normals.set(v.normal, i * 4);
        }

        for (let i = 0; i < this.halfEdges.length; i++) {
            indices[i] = this.halfEdges[i].vertex.vid;
        }

        return [coords, colors, normals, indices];
    }
}