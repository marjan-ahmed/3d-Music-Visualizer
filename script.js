const audioInput = document.getElementById("audio");
let noise = new SimplexNoise();
const area = document.getElementById("visualiser");
const label = document.getElementById("label");

audioInput.addEventListener("change", setAudio, false);
let audio = new Audio("Still.mp3");

function setAudio() {
  audio.pause();
  const audioFile = this.files[0];
  if (audioFile && audioFile.type.startsWith("audio/")) {
    const audioURL = URL.createObjectURL(audioFile);
    audio = new Audio(audioURL);
    clearScene();
    startVis();
  } else {
    alert("Invalid File Type!");
  }
}

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    if (audio.paused) {
      audio.play();
      label.style.display = "none";
    } else {
      audio.pause();
      label.style.display = "flex";
    }
  }
});

startVis();

function clearScene() {
  const canvas = area.firstElementChild;
  if (canvas) {
    area.removeChild(canvas);
  }
}

function startVis() {
  const context = new AudioContext();
  const src = context.createMediaElementSource(audio);
  const analyser = context.createAnalyser();
  src.connect(analyser);
  analyser.connect(context.destination);
  analyser.fftSize = 512;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 100;
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor("#000000");

  area.appendChild(renderer.domElement);

  // Create the sphere
  const sphereGeometry = new THREE.IcosahedronGeometry(20, 3);
  const sphereMaterial = new THREE.MeshLambertMaterial({
    color: "#696969",
    wireframe: true
  });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

  // Create the line
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x696969 });
  const points = [];
  for (let i = 0; i < 100; i++) {
    points.push(new THREE.Vector3(i - 50, 0, 0));
  }
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(lineGeometry, lineMaterial);

  const light = new THREE.DirectionalLight("#ffffff", 0.8);
  light.position.set(0, 50, 100);
  scene.add(light);
  scene.add(sphere);
  scene.add(line);

  let isMouseDown = false;
  let mouseX = 0, mouseY = 0;

  area.addEventListener('mousedown', (event) => {
    isMouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
  });

  area.addEventListener('mousemove', (event) => {
    if (isMouseDown) {
      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      sphere.rotation.y += deltaX * 0.01;
      sphere.rotation.x += deltaY * 0.01;

      mouseX = event.clientX;
      mouseY = event.clientY;
    }
  });

  area.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  function render() {
    analyser.getByteFrequencyData(dataArray);

    const lowerHalf = dataArray.slice(0, (dataArray.length / 2) - 1);
    const upperHalf = dataArray.slice((dataArray.length / 2) - 1, dataArray.length - 1);

    const lowerMax = max(lowerHalf);
    const upperAvg = avg(upperHalf);

    const lowerMaxFr = lowerMax / lowerHalf.length;
    const upperAvgFr = upperAvg / upperHalf.length;

    warpSphere(sphere, modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8), modulate(upperAvgFr, 0, 1, 0, 4));
    warpLine(line, modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8), modulate(upperAvgFr, 0, 1, 0, 4));
    requestAnimationFrame(render);
    renderer.render(scene, camera);
  }

  function warpSphere(mesh, bassFr, treFr) {
    mesh.geometry.vertices.forEach(vertex => {
      const offset = mesh.geometry.parameters.radius;
      const amp = 5;
      const time = window.performance.now();
      vertex.normalize();
      const rf = 0.00001;
      const distance = (offset + bassFr) + noise.noise3D(vertex.x + time * rf * 4, vertex.y + time * rf * 6, vertex.z + time * rf * 7) * amp * treFr * 2;
      vertex.multiplyScalar(distance);
    });
    mesh.geometry.verticesNeedUpdate = true;
    mesh.geometry.normalsNeedUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeFaceNormals();
  }

  function warpLine(mesh, bassFr, treFr) {
    const vertices = mesh.geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      const amp = 5;
      const time = window.performance.now();
      const rf = 0.00001;
      vertices[i + 1] = noise.noise3D(vertices[i] + time * rf * 4, 0, 0) * amp * treFr;
    }
    mesh.geometry.attributes.position.needsUpdate = true;
  }

  render();
}

// Helper functions
function fractionate(val, minVal, maxVal) {
  return (val - minVal) / (maxVal - minVal);
}

function modulate(val, minVal, maxVal, outMin, outMax) {
  const fr = fractionate(val, minVal, maxVal);
  const delta = outMax - outMin;
  return outMin + (fr * delta);
}

function avg(arr) {
  const total = arr.reduce((sum, b) => sum + b, 0);
  return (total / arr.length);
}

function max(arr) {
  return arr.reduce((a, b) => Math.max(a, b), 0);
}
