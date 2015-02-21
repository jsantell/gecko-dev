const { mat3 } = require("./gl-matrix");
const { defer } = require("sdk/core/promise");
const DEFAULT_TEXTURE = "chrome://browser/content/devtools/shadereditor/texture.png";

exports.loadTexture = function (gl, Image, url=DEFAULT_TEXTURE) {
  let { resolve, promise } = defer();

  let texture = gl.createTexture();
  let image = new Image();
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    resolve(texture);
  };
  image.src = url;

  return promise;
};

exports.createCubeBuffers = function (gl) {
  // Create a buffer for the cube's vertices.
  let cubeVerticesBuffer = gl.createBuffer();

  // Select the cubeVerticesBuffer as the one to apply vertex
  // operations to from here out.
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesBuffer);

  // Now create an array of vertices for the cube.
  let vertices = [
    // Front face
    -1.0, -1.0,  1.0,
     1.0, -1.0,  1.0,
     1.0,  1.0,  1.0,
    -1.0,  1.0,  1.0,

    // Back face
    -1.0, -1.0, -1.0,
    -1.0,  1.0, -1.0,
     1.0,  1.0, -1.0,
     1.0, -1.0, -1.0,

    // Top face
    -1.0,  1.0, -1.0,
    -1.0,  1.0,  1.0,
     1.0,  1.0,  1.0,
     1.0,  1.0, -1.0,

    // Bottom face
    -1.0, -1.0, -1.0,
     1.0, -1.0, -1.0,
     1.0, -1.0,  1.0,
    -1.0, -1.0,  1.0,

    // Right face
     1.0, -1.0, -1.0,
     1.0,  1.0, -1.0,
     1.0,  1.0,  1.0,
     1.0, -1.0,  1.0,

    // Left face
    -1.0, -1.0, -1.0,
    -1.0, -1.0,  1.0,
    -1.0,  1.0,  1.0,
    -1.0,  1.0, -1.0
  ];

  // Now pass the list of vertices into WebGL to build the shape. We
  // do this by creating a Float32Array from the JavaScript array,
  // then use it to fill the current vertex buffer.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  // Set up the normals for the vertices, so that we can compute lighting.
  let cubeVerticesNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesNormalBuffer);

  var vertexNormals = [
    // Front
     0.0,  0.0,  1.0,
     0.0,  0.0,  1.0,
     0.0,  0.0,  1.0,
     0.0,  0.0,  1.0,

    // Back
     0.0,  0.0, -1.0,
     0.0,  0.0, -1.0,
     0.0,  0.0, -1.0,
     0.0,  0.0, -1.0,

    // Top
     0.0,  1.0,  0.0,
     0.0,  1.0,  0.0,
     0.0,  1.0,  0.0,
     0.0,  1.0,  0.0,

    // Bottom
     0.0, -1.0,  0.0,
     0.0, -1.0,  0.0,
     0.0, -1.0,  0.0,
     0.0, -1.0,  0.0,

    // Right
     1.0,  0.0,  0.0,
     1.0,  0.0,  0.0,
     1.0,  0.0,  0.0,
     1.0,  0.0,  0.0,

    // Left
    -1.0,  0.0,  0.0,
    -1.0,  0.0,  0.0,
    -1.0,  0.0,  0.0,
    -1.0,  0.0,  0.0
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals), gl.STATIC_DRAW);

  // Map the texture onto the cube's faces.

  let cubeVerticesTextureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer);

  let textureCoordinates = [
    // Front
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Back
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Top
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Bottom
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Right
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Left
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates),
                gl.STATIC_DRAW);

  // Build the element array buffer; this specifies the indices
  // into the vertex array for each face's vertices.

  let cubeVerticesIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);

  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.

  let cubeVertexIndices = [
    0,  1,  2,      0,  2,  3,    // front
    4,  5,  6,      4,  6,  7,    // back
    8,  9,  10,     8,  10, 11,   // top
    12, 13, 14,     12, 14, 15,   // bottom
    16, 17, 18,     16, 18, 19,   // right
    20, 21, 22,     20, 22, 23    // left
  ]

  // Now send the element array to GL

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);

  return {
    vertices: cubeVerticesBuffer,
    verticesTextureCoordinates: cubeVerticesTextureCoordBuffer,
    verticesNormal: cubeVerticesNormalBuffer,
    verticesIndex: cubeVerticesIndexBuffer 
  };
};

exports.setMatrixUniforms = function (gl, program, pMatrix, mvMatrix) {
  let normalMatrix = mat3.create();
  let pUniform = gl.getUniformLocation(program, "uPMatrix");
  let mvUniform = gl.getUniformLocation(program, "uMVMatrix");
  gl.uniformMatrix4fv(pUniform, false, pMatrix);
  gl.uniformMatrix4fv(mvUniform, false, mvMatrix);

  let nUniform = gl.getUniformLocation(program, "uNormalMatrix");
  mat3.normalFromMat4(normalMatrix, mvMatrix);
  mat3.transpose(normalMatrix, normalMatrix);
  gl.uniformMatrix3fv(nUniform, false, normalMatrix);
};

exports.loadShaders = function (gl, { vs: vsSource, fs: fsSource }) {
  let fs = gl.createShader(gl.FRAGMENT_SHADER);
  let vs = gl.createShader(gl.VERTEX_SHADER);
  let program = gl.createProgram();

  gl.shaderSource(fs, fsSource);
  gl.shaderSource(vs, vsSource);

  gl.compileShader(fs);
  gl.compileShader(vs);

  gl.attachShader(program, fs);
  gl.attachShader(program, vs);
  gl.linkProgram(program);

  gl.useProgram(program);

  program.vertexPositionAttribute = gl.getAttribLocation(program, "aVertexPosition");
  gl.enableVertexAttribArray(program.vertexPositionAttribute);

  program.textureCoordAttribute = gl.getAttribLocation(program, "aTextureCoord");
  gl.enableVertexAttribArray(program.textureCoordAttribute);

  program.vertexNormalAttribute = gl.getAttribLocation(program, "aVertexNormal");
  gl.enableVertexAttribArray(program.vertexNormalAttribute);

  return { vs, fs, program };
};
