import floorVertSrc from './floor.vert.js';
import floorFragSrc from './floor.frag.js';
import phongVertSrc from './phong.vert.js';
import phongFragSrc from './phong.frag.js';
import WebGPU from '../lib/webgpu.js';
import { createImplicitTable } from './marching-cubes.js';
import { loadPly } from './load-ply.js';
import { HalfEdgeDS } from './half-edge.js';
import {
    createIdentityMat4,
    createLookAtMat4,
    createNormalMat4,
    createPerspectiveMat4,
    createScaleMat4,
    createTranslationMat4,
    multiplyMat4,
} from '../lib/utils.js';

const UNIFORM_FLOATS = 96;

function writeUniformData(target, model, view, projection, lights, material) {
    const modelView = multiplyMat4(view, model);
    const normalMatrix = createNormalMat4(modelView);

    target.set(model, 0);
    target.set(view, 16);
    target.set(projection, 32);
    target.set(normalMatrix, 48);

    target.set(lights[0].position, 64);
    target.set(lights[0].color, 68);
    target.set(lights[1].position, 72);
    target.set(lights[1].color, 76);

    target.set(material.ambient, 80);
    target.set(material.diffuse, 84);
    target.set(material.specular, 88);
    target.set([material.shininess, 0, 0, 0], 92);
}

function createFloorGeometry(size = 12, repeat = 4) {
    const positions = [
        -size, -0.005,  size, 1,
         size, -0.005,  size, 1,
         size, -0.005, -size, 1,
        -size, -0.005, -size, 1,
    ];
    const uvs = [
        0, repeat,
        repeat, repeat,
        repeat, 0,
        0, 0,
    ];
    const normals = [
        0, 1, 0, 0,
        0, 1, 0, 0,
        0, 1, 0, 0,
        0, 1, 0, 0,
    ];
    const indices = [0, 1, 2, 0, 2, 3];

    return { positions, uvs, normals, indices, vertexCount: 4 };
}

function computeBoundingBox(coords) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    for (let i = 0; i < coords.length; i += 4) {
        for (let c = 0; c < 3; c++) {
            if (coords[i + c] < min[c]) min[c] = coords[i + c];
            if (coords[i + c] > max[c]) max[c] = coords[i + c];
        }
    }

    return { min, max };
}

class OrbitCamera {
    constructor(canvas, target = [0, 1.35, 0]) {
        this.target = target;
        this.theta = 0.55;
        this.phi = 1.18;
        this.radius = 5.2;

        this.dragging = false;
        this.lastX = 0;
        this.lastY = 0;

        canvas.addEventListener('mousedown', (e) => {
            this.dragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
        });

        window.addEventListener('mouseup', () => {
            this.dragging = false;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.dragging) return;
            const dx = e.clientX - this.lastX;
            const dy = e.clientY - this.lastY;
            this.lastX = e.clientX;
            this.lastY = e.clientY;

            this.theta -= dx * 0.008;
            this.phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, this.phi - dy * 0.008));
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.radius = Math.max(2.2, Math.min(14.0, this.radius + e.deltaY * 0.005));
        }, { passive: false });
    }

    getViewMatrix() {
        const sinPhi = Math.sin(this.phi);
        const eye = [
            this.target[0] + this.radius * sinPhi * Math.sin(this.theta),
            this.target[1] + this.radius * Math.cos(this.phi),
            this.target[2] + this.radius * sinPhi * Math.cos(this.theta),
        ];
        return createLookAtMat4(eye, this.target, [0, 1, 0], true);
    }
}

class Scene {
    constructor(gpu, floorTexture, bunnyData) {
        this.camera = new OrbitCamera(gpu.canvas, [0, 1.35, 0]);

        // Duas luzes pontuais fixas no mundo
        this.lights = [
            { position: [3.5, 5.5, 4.0, 1.0], color: [1.0, 0.98, 0.94, 0.85] },
            { position: [-4.0, 3.5, -2.5, 1.0], color: [0.85, 0.9, 1.0, 0.45] },
        ];

        // --- Pipeline 1: Chão texturizado ---
        this.floorProgram = gpu.createProgram(floorVertSrc, floorFragSrc, {
            cullMode: 'back',
            buffers: [
                { arrayStride: 4 * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }] },
                { arrayStride: 2 * 4, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x2' }] },
                { arrayStride: 4 * 4, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x4' }] },
            ],
        });

        const floorGeom = createFloorGeometry(12, 4);
        this.floorShape = gpu.createShape({
            buffers: [floorGeom.positions, floorGeom.uvs, floorGeom.normals],
            indices: floorGeom.indices,
            indexFormat: 'uint32',
            vertexCount: floorGeom.vertexCount,
        });

        this.floorMaterial = {
            ambient: [1, 1, 1, 0.25],
            diffuse: [1, 1, 1, 0.8],
            specular: [1, 1, 1, 0.1],
            shininess: 16,
        };

        this.floorUniform = {
            data: new Float32Array(UNIFORM_FLOATS),
            buffer: gpu.createUniformBuffer(new Float32Array(UNIFORM_FLOATS)),
        };

        const sampler = gpu.createSampler({
            addressModeU: 'repeat',
            addressModeV: 'repeat',
            magFilter: 'linear',
            minFilter: 'linear',
        });

        this.floorBindGroup = gpu.createBindGroup(this.floorProgram, [
            { binding: 0, resource: { buffer: this.floorUniform.buffer } },
            { binding: 1, resource: sampler },
            { binding: 2, resource: floorTexture.createView() },
        ]);

        // --- Pipeline 2: Objetos de cor sólida (Mesa e Bunny) ---
        this.solidProgram = gpu.createProgram(phongVertSrc, phongFragSrc, {
            cullMode: 'back',
            buffers: [
                { arrayStride: 4 * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }] },
                { arrayStride: 4 * 4, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }] },
                { arrayStride: 4 * 4, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x4' }] },
            ],
        });

        // --- Mesa implícita (Marching Cubes, resolução 100 x 81 x 100) ---
        const tableGeom = createImplicitTable([100, 81, 100], [0.28, 0.52, 0.96, 1.0]);
        this.tableShape = gpu.createShape(
            [tableGeom.positions, tableGeom.colors, tableGeom.normals],
            tableGeom.vertexCount,
        );
        this.tableUniform = gpu.createUniform(this.solidProgram, new Float32Array(UNIFORM_FLOATS));
        this.tableMaterial = {
            ambient: [1, 1, 1, 0.30],
            diffuse: [1, 1, 1, 0.80],
            specular: [1, 1, 1, 0.14],
            shininess: 18,
        };

        // --- Stanford Bunny (Half-Edge + normais por vértice) ---
        this.bunnyHeds = new HalfEdgeDS();
        this.bunnyHeds.build(bunnyData.coords, bunnyData.indices);

        const bunnyColor = [0.95, 0.91, 0.82, 1.0];
        for (const v of this.bunnyHeds.vertices) {
            v.color = bunnyColor;
        }

        const [bPos, bCol, bNorm, bIdx] = this.bunnyHeds.getVBOs();
        this.bunnyShape = gpu.createShape({
            buffers: [bPos, bCol, bNorm],
            indices: bIdx,
            indexFormat: 'uint32',
            vertexCount: this.bunnyHeds.vertices.length,
        });
        this.bunnyUniform = gpu.createUniform(this.solidProgram, new Float32Array(UNIFORM_FLOATS));
        this.bunnyMaterial = {
            ambient: [1, 1, 1, 0.28],
            diffuse: [1, 1, 1, 0.82],
            specular: [1, 1, 1, 0.16],
            shininess: 24,
        };

        // Transformações de escala e translação para apoiar o Bunny no topo da mesa (y = 1.6)
        const { min, max } = computeBoundingBox(bunnyData.coords);
        const cx = (min[0] + max[0]) / 2;
        const cz = (min[2] + max[2]) / 2;
        const height = max[1] - min[1];
        const scaleFactor = 1.45 / height;

        const toOrigin = createTranslationMat4(-cx, -min[1], -cz);
        const scale = createScaleMat4(scaleFactor, scaleFactor, scaleFactor);
        const toTableTop = createTranslationMat4(0, 1.6, 0);

        let bunnyModel = toOrigin;
        bunnyModel = multiplyMat4(scale, bunnyModel);
        bunnyModel = multiplyMat4(toTableTop, bunnyModel);
        this.bunnyModel = bunnyModel;
    }

    draw(gpu) {
        const view = this.camera.getViewMatrix();
        const projection = createPerspectiveMat4(Math.PI / 4, 1024 / 768, 0.1, 50);

        // 1. Chão texturizado
        writeUniformData(
            this.floorUniform.data,
            createIdentityMat4(),
            view,
            projection,
            this.lights,
            this.floorMaterial,
        );
        gpu.writeBuffer(this.floorUniform.buffer, this.floorUniform.data);
        gpu.draw(this.floorProgram, this.floorShape, [this.floorBindGroup]);

        // 2. Mesa implícita
        writeUniformData(
            this.tableUniform.data,
            createIdentityMat4(),
            view,
            projection,
            this.lights,
            this.tableMaterial,
        );
        gpu.writeBuffer(this.tableUniform.buffer, this.tableUniform.data);
        gpu.draw(this.solidProgram, this.tableShape, [this.tableUniform.bindGroup]);

        // 3. Stanford Bunny
        writeUniformData(
            this.bunnyUniform.data,
            this.bunnyModel,
            view,
            projection,
            this.lights,
            this.bunnyMaterial,
        );
        gpu.writeBuffer(this.bunnyUniform.buffer, this.bunnyUniform.data);
        gpu.draw(this.solidProgram, this.bunnyShape, [this.bunnyUniform.bindGroup]);
    }
}

class Main {
    async init() {
        this.gpu = await WebGPU.createCanvas('#glcanvas', 1024, 768, {
            clearColor: { r: 0.18, g: 0.18, b: 0.19, a: 1.0 },
        });

        const [floorTexture, bunnyData] = await Promise.all([
            this.gpu.createTextureFromImage(new URL('./Tiles074_1K-JPG_Color.jpg', import.meta.url)),
            loadPly(new URL('./bun_zipper.ply', import.meta.url)),
        ]);

        this.scene = new Scene(this.gpu, floorTexture, bunnyData);
    }

    draw() {
        this.gpu.start();
        this.scene.draw(this.gpu);
        this.gpu.finish();
        requestAnimationFrame(this.draw.bind(this));
    }
}

try {
    const app = new Main();
    await app.init();
    app.draw();
} catch (error) {
    console.error(error);
    document.body.insertAdjacentHTML('beforeend', `<p style="color:white">${error.message}</p>`);
}