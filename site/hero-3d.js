import * as THREE from "./assets/three.module.js";

const container = document.getElementById("logoScene");

if (container) {
  try {
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.append(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.1, 9.2);

    scene.add(new THREE.HemisphereLight(0xf4f6fa, 0x000d48, 2.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 4.8);
    keyLight.position.set(4, 5, 7);
    scene.add(keyLight);
    const greenLight = new THREE.PointLight(0x02f9a8, 8, 15);
    greenLight.position.set(-4, -2, 4);
    scene.add(greenLight);

    const group = new THREE.Group();
    group.rotation.set(-0.08, -0.26, -0.025);
    scene.add(group);

    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x02f9a8,
      metalness: 0.28,
      roughness: 0.3,
    });
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(5.62, 3.28, 0.34, 2, 2, 2),
      edgeMaterial,
    );
    group.add(backing);

    const texture = new THREE.TextureLoader().load(
      "assets/matchwear-logo-green-on-blue.png",
      () => container.classList.add("is-ready"),
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const faceMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 0.06,
      roughness: 0.42,
    });
    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(5.48, 3.08),
      faceMaterial,
    );
    front.position.z = 0.178;
    group.add(front);

    const back = front.clone();
    back.position.z = -0.178;
    back.rotation.y = Math.PI;
    group.add(back);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let dragging = false;
    let previousX = 0;
    let targetRotation = group.rotation.y;

    container.addEventListener("pointerdown", (event) => {
      dragging = true;
      previousX = event.clientX;
      container.setPointerCapture(event.pointerId);
    });
    container.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      targetRotation += (event.clientX - previousX) * 0.009;
      previousX = event.clientX;
    });
    container.addEventListener("pointerup", (event) => {
      dragging = false;
      container.releasePointerCapture(event.pointerId);
    });
    container.addEventListener("pointercancel", () => {
      dragging = false;
    });

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(container);
    resize();

    const startedAt = performance.now();
    const animate = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      if (!dragging && !reducedMotion.matches) targetRotation += 0.0032;
      group.rotation.y += (targetRotation - group.rotation.y) * 0.075;
      if (!reducedMotion.matches) {
        group.position.y = Math.sin(elapsed * 1.15) * 0.08;
        group.rotation.x = -0.08 + Math.sin(elapsed * 0.7) * 0.025;
      }
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();
  } catch (error) {
    console.warn("Visual 3D indisponível; usando logo estática.", error);
  }
}
