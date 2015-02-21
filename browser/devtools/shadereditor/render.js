const { loadTexture, setMatrixUniforms, loadShaders, createCubeBuffers } = require("devtools/shadereditor/gl-utils");
const { mat4, vec3 } = require("devtools/shadereditor/gl-matrix");
const { DOM } = require("devtools/tilt/tilt-utils");
const ROTATE_CONSTANT = 2;

let RenderView = {
  initialize: function () {
    let pane = $("#render-pane");
    let canvas = DOM.initCanvas(pane, { append: true, width: 200, height: 200 });
    this.render = this.render.bind(this);

    try {
      this.gl = canvas.getContext("webgl");
      this.gl.viewportWidth = canvas.width;
      this.gl.viewportHeight = canvas.height;
      this.gl.viewport(0, 0, canvas.width, canvas.height);
    } catch (e) {
      this.UNSUPPORTED = true;
    }
  },

  destroy: function () {

  },

  reset: function () {
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
    this.gl.clearDepth(1.0);                 // Clear everything
    this.gl.enable(this.gl.DEPTH_TEST);      // Enable depth testing
    this.gl.depthFunc(this.gl.LEQUAL);       // Near things obscure far things
  },

  load: Task.async(function *(source) {
    let { program, vs, fs } = loadShaders(this.gl, source);
    this.buffers = createCubeBuffers(this.gl);
    this.texture = yield loadTexture(this.gl, Image);

    this.program = program;
    this.pMatrix = mat4.create();
    this.mvMatrix = mat4.create();
  }),

  play: function () {
    this.reset();

    this.rotation = 0;
    this.time = Date.now();
    this.raf = window.requestAnimationFrame(this.render);
  },

  stop: function () {
    if (this.raf) {

    }
  },

  render: function () {
    let gl = this.gl;
    let program = this.program;
    let buffers = this.buffers;
    
    let now = Date.now();
    let delta = now - this.time;
    this.rotation += (ROTATE_CONSTANT * delta) / 1000;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    mat4.perspective(this.pMatrix, 45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);

    mat4.identity(this.mvMatrix);
    mat4.translate(this.mvMatrix, this.mvMatrix, [0, 0, -6]);
    mat4.rotate(this.mvMatrix, this.mvMatrix, this.rotation * Math.PI / 180, [1, 0, 1]);

    // Draw the cube by binding the array buffer to the cube's vertices
    // array, setting attributes, and pushing it to GL
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertices);
    gl.vertexAttribPointer(program.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
    
    // Set the texture coordinates attribute for the vertices
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.verticesTextureCoordinates);
    gl.vertexAttribPointer(program.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

    // Bind the normals buffer to the shader attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.verticesNormal);
    gl.vertexAttribPointer(program.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);

    // Specify the texture to map onto the faces
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(gl.getUniformLocation(program, "uSampler"), 0);

    // Draw the cube
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.verticesIndex);
    setMatrixUniforms(gl, program, this.pMatrix, this.mvMatrix);
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

    this.raf = window.requestAnimationFrame(this.render);
  },
};

