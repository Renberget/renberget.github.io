const METABALL_COUNT = 10;

const MIN_METABALL_RADIUS = 50.0;
const MAX_METABALL_RADIUS = 180.0;
const NOISE_SPEED = 0.1;

const MIN_METABALL_VELOCITY = 50.0;
const MAX_METABALL_VELOCITY = 2000.0;

const BACKGROUND_COLOR = "1.0, 1.0, 1.0";
const METABALLS_COLOR = "0.85, 0.85, 0.85";

const MIN_MOUSE_DISTANCE = 300.0;
const MOUSE_FORCE_FACTOR = 0.15;

const SCROLL_FACTOR_X = 0.2;
const SCROLL_FACTOR_Y = 0.5;
const SCROLL_VARIATION = 0.4;

const REF_MIN_SIDE = 1000.0;

var canvas;
var gl;

var width;
var height;
var minSide;
var scale;

var previousScroll = { x: 100.0, y: 100.0 };

var program;

var resolutionUniformLocation;
var metaballsUniformLocation;

var metaballs = new Array(METABALL_COUNT);
var metaballsData = new Float32Array(3 * METABALL_COUNT);

window.onload = function() {
  //Init
  canvas = document.getElementById("webgl-canvas");
  gl = canvas.getContext("webgl");
  if (gl === null) {
    //No webgl, display default background
    document.getElementById("content").style.backgroundColor = "Gainsboro";
    return;
  }
  
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  width = gl.canvas.width;
  height = gl.canvas.height;

  //Shaders
  let vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, "\n\
    attribute vec2 pos;\n\
    \n\
    void main()\n\
    {\n\
      gl_Position = vec4(pos, 0.0, 1.0);\n\
    }");
  gl.compileShader(vertexShader);

  let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, "\n\
    precision highp float;\n\
    \n\
    const int METABALL_COUNT = " + METABALL_COUNT + ";\n\
    \n\
    uniform vec3 metaballs[METABALL_COUNT];\n\
    uniform vec2 resolution;\n\
    \n\
    float getMetaballValue(vec3 metaball, vec2 pos)\n\
    {\n\
      vec2 diff = metaball.xy - pos;\n\
      return metaball.z * metaball.z / (diff.x * diff.x + diff.y * diff.y);\n\
    }\n\
    \n\
    void main()\n\
    {\n\
      vec2 pos = gl_FragCoord.xy;\n\
      float value = 0.0;\n\
      for (int i = 0; i < METABALL_COUNT; ++i) {\n\
        value += getMetaballValue(metaballs[i], pos);\n\
      }\n\
      float alpha = pow(min(1.0, value), 25.0);\n\
      gl_FragColor = mix(vec4(" + BACKGROUND_COLOR + ", 0.0), vec4(" + METABALLS_COLOR + ", 1.0), alpha);\n\
    }\n");
  gl.compileShader(fragmentShader);
    
  program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);

  resolutionUniformLocation = gl.getUniformLocation(program, "resolution");
  metaballsUniformLocation = gl.getUniformLocation(program, "metaballs");

  let posAttribLocation = gl.getAttribLocation(program, "pos");
  
  //Vertices
  let vertices = new Float32Array([
    -1.0, 1.0,
    -1.0, -1.0,
    1.0, 1.0,
    1.0, -1.0
  ]);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(posAttribLocation);
  gl.vertexAttribPointer(posAttribLocation, 2, gl.FLOAT, gl.FALSE, 2 * 4, 0);

  //Metaballs
  for (let i = 0; i < METABALL_COUNT; ++i) {
    const SPAWN_OFFSET = 0.5 * MAX_METABALL_RADIUS;
    metaballs[i] = {
      posX: SPAWN_OFFSET + Math.random() * (width - MAX_METABALL_RADIUS),
      posY: SPAWN_OFFSET + Math.random() * (height - MAX_METABALL_RADIUS),
      velX: Math.random() * 30.0 - 15.0,
      velY: Math.random() * 30.0 - 15.0,
      radius: 0.0,
      seed: Math.random() * 2000.0 - 1000.0
    };
  }

  window.addEventListener("mousemove", function(e) {
    for (let i = 0; i < METABALL_COUNT; ++i) {
      let metaball = metaballs[i];

      let diffX = metaball.posX - e.clientX;
      let diffY = metaball.posY - (height - (e.clientY - canvas.offsetTop));
      let dist = Math.sqrt(diffX * diffX + diffY * diffY);
      
      diffX /= dist;
      diffY /= dist;
      
      let force = Math.max(0.0, MIN_MOUSE_DISTANCE - dist + metaball.radius);
      metaball.velX += MOUSE_FORCE_FACTOR * diffX * force;
      metaball.velY += MOUSE_FORCE_FACTOR * diffY * force;
    }
  });

  window.addEventListener("scroll", function(e) {
    for (let i = 0; i < METABALL_COUNT; ++i) {
      let deltaX = window.scrollX - previousScroll.x;
      let deltaY = window.scrollY - previousScroll.y;
      metaballs[i].velX += deltaX * SCROLL_FACTOR_X * (1.0 + SCROLL_VARIATION * (Math.random() * 2.0 - 0.5));
      metaballs[i].velY += deltaY * SCROLL_FACTOR_Y * (1.0 + SCROLL_VARIATION * (Math.random() * 2.0 - 0.5));
    }

    previousScroll.x = window.scrollX;
    previousScroll.y = window.scrollY;
  });

  resize();

  requestAnimationFrame(step);
}

function resize() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  width = gl.canvas.width;
  height = gl.canvas.height;
  minSide = Math.min(width, height);
  scale = minSide / REF_MIN_SIDE;
  gl.viewport(0, 0, width, height);
  gl.uniform2f(resolutionUniformLocation, width, height);
}

var previousTime = 0.0;
function step(currentTime) {
  currentTime *= 0.001;
  var deltaTime = currentTime - previousTime;
  previousTime = currentTime;
  
  //Resize canvas
  if (canvas.width != canvas.clientWidth || canvas.height != canvas.clientHeight) {
    resize();
  }
  
  // Update positions and velocities
  for (let i = 0; i < metaballs.length; ++i) {
    let metaball = metaballs[i];
    
    //Damping
    let length = Math.sqrt(metaball.velX * metaball.velX + metaball.velY * metaball.velY);
    metaball.velX /= length;
    metaball.velY /= length;
    length = Math.min(Math.max(MIN_METABALL_VELOCITY, length - deltaTime * 400.0), MAX_METABALL_VELOCITY);
    metaball.velX *= length;
    metaball.velY *= length;

    //Update pos
    metaball.posX += deltaTime * metaball.velX;
    metaball.posY += deltaTime * metaball.velY;
    
    if (metaball.posX - metaball.radius < 0) {
      metaball.posX = metaball.radius + 1;
      metaball.velX = Math.abs(metaball.velX);
    }
    else if (metaball.posX + metaball.radius > width) {
      metaball.posX = width - metaball.radius;
      metaball.velX = -Math.abs(metaball.velX);
    }
    
    if (metaball.posY - metaball.radius < 0) {
      metaball.posY = metaball.radius + 1;
      metaball.velY = Math.abs(metaball.velY);
    }
    else if (metaball.posY + metaball.radius > height) {
      metaball.posY = height - metaball.radius;
      metaball.velY = -Math.abs(metaball.velY);
    }

    //Update radius
    function noise(x) {
      return 0.5 * (Math.sin(2.0 * x) + Math.sin(Math.PI * x));
    }

    let noiseValue = 0.5 + 0.5 * noise(metaball.seed + NOISE_SPEED * currentTime);
    metaball.radius = scale * (MIN_METABALL_RADIUS + noiseValue * (MAX_METABALL_RADIUS - MIN_METABALL_RADIUS));
  }

  let index = 0;
  for (let i = 0; i < metaballs.length; ++i) {
    let metaball = metaballs[i];
    metaballsData[index++] = metaball.posX;
    metaballsData[index++] = metaball.posY;
    metaballsData[index++] = metaball.radius;
  }
  gl.uniform3fv(metaballsUniformLocation, metaballsData);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  
  requestAnimationFrame(step);
}
