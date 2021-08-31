import { GUI, gui } from "./utils/dat.gui.module.js";

var camera, scene, renderer, light;
var sphereGeometry, sphereMaterial, sphere;
var audioInput, audioControls, sound;
var analyser;
var guiControls;

function init(){
	var width = window.innerWidth;
	var height = window.innerHeight;
	var viewAngle = 45;
	var nearClipping = 0.1;
	var farClipping = 9999;

	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(viewAngle, width / height, nearClipping, farClipping);
	camera.position.z = 100;
	renderer = new THREE.WebGLRenderer();
	renderer.setSize(width, height);
	document.body.appendChild(renderer.domElement);

	//Create a light source and add it to the scene
	var light = new THREE.DirectionalLight(0xffffff, 0.5);
	light.position.setScalar(10);
	scene.add(light);
	scene.add(new THREE.AmbientLight(0xffffff, 0.5));

	createSphere(true);

	//GUI with user-controllable parameters
	guiControls = new (function () {
		this.SphereColor = 0xFF0000;
		this.Speed = 1;
		this.SpikeFrequency = 5;
		this.SpikeLength = 10;
		this.LowFrequencySensitivity = 5;
		this.HighFrequencySensitivity = 5;
	})();

	var gui = new GUI({width: 400});
	var folder = gui.addFolder("Parameters");
	folder.addColor(guiControls, "SphereColor").name("Sphere Color")
					.onChange(function(){
						sphereMaterial.color.set(guiControls.SphereColor);
					});
	folder.add(guiControls, "Speed", -10, 10).name("Rotational Speed");
	folder.add(guiControls, "SpikeFrequency", 0, 10).name("Spike Frequency");
	folder.add(guiControls, "SpikeLength", 0, 20).name("Spike Length");
	folder.add(guiControls, "LowFrequencySensitivity", 1, 10).name("Low Frequency Sensitivity");
	folder.add(guiControls, "HighFrequencySensitivity", 1, 10).name("High Frequency Sensitivity");

	folder.open();
}

function createSphere(addSphere){
	sphereGeometry = new THREE.SphereGeometry(20, 48, 48);
	sphereMaterial = new THREE.MeshPhongMaterial({
		color: 0xff0000,
		specular: 0x222222,
		shininess: 40
	});

	sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
	sphere.position.z = -5;
	if(addSphere){
		scene.add(sphere);
	}
}

function loadAudio(){

	audioInput.onchange = function() {
		
		var reader = new FileReader();
		var listener = new THREE.AudioListener();

		var file = audioInput.files[0];
		reader.readAsArrayBuffer( file );
		
		audioControls.src = URL.createObjectURL(file);
		
		sound = new THREE.Audio(listener);
		audioControls.volume = 0.1;
		sound.setMediaElementSource(audioControls);
		
		analyser = new THREE.AudioAnalyser(sound, 64);

	}
}

function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function resetSphere(){
	var positions = sphere.geometry.attributes.position.array;
	var sphereTmpGeometry = new THREE.SphereGeometry(20, 48, 48);
	var sphereTmpMaterial = new THREE.MeshPhongMaterial({
		color: 0xff0000,
		specular: 0x222222,
		shininess: 40,
	});
	var sphereTmp = new THREE.Mesh(sphereTmpGeometry, sphereTmpMaterial);
	const originalPositions = sphereTmp.geometry.attributes.position.array;
	for(let i = 0; i < positions.length; i++){

		positions[i*3] = originalPositions[i*3];
		positions[i*3+1] = originalPositions[i*3+1];
		positions[i*3+2] = originalPositions[i*3+2];
	}
	sphere.geometry.attributes.position.needsUpdate = true;
	sphere.geometry.computeVertexNormals();
}

function simplexNoise() {

	const time = performance.now() * 0.001;
	const positions = sphere.geometry.attributes.position.array;
	const radius = 20;

	//e is a small number to avoid division by 0
	const e = 0.000001;
  
	const SpikeFrequency = guiControls.SpikeFrequency;
	const SpikeLength = guiControls.SpikeLength;
	const LowFrequencySensitivity = 0.1 * guiControls.LowFrequencySensitivity;
	const HighFrequencySensitivity = 0.5 * guiControls.HighFrequencySensitivity;
  
	for(let i = 0; i < positions.length; i++){
		const p = new THREE.Vector3(
			positions[i*3],
			positions[i*3+1],
			positions[i*3+2]
		);

		var audioFrequencies = analyser.getFrequencyData();

		//Divide the different frequencies into two arrays containing the lower and higher frequencies respectively
		var lowFrequenciesArray = audioFrequencies.slice(0, (analyser.data.length / 2) - 1);
		var highFrequenciesArray = audioFrequencies.slice((analyser.data.length / 2), (analyser.data.length) - 1);

		var lowFreqSum = 0;
		for(var j = 0; j < lowFrequenciesArray.length; j++){
			lowFreqSum += lowFrequenciesArray[j];
		}
		var lowFrequencyAvg = lowFreqSum / lowFrequenciesArray.length;
		var lowFrequencyMax = Math.max(...lowFrequenciesArray);


		var highFreqSum = 0;
		for(var j = 0; j < highFrequenciesArray.length; j++){
			highFreqSum += highFrequenciesArray[j];
		}
		var highFrequencyAvg = highFreqSum / highFrequenciesArray.length;
		var highFrequencyMax = Math.max(...highFrequenciesArray);
		
		p.normalize().multiplyScalar(radius * (1 + (lowFrequencyAvg / (lowFrequencyMax + e) * LowFrequencySensitivity)) +
									(SpikeLength *
									noise.simplex3(
									p.x * SpikeFrequency + time, 
									p.y * SpikeFrequency, 
									p.z * SpikeFrequency)
									) * (1 + (highFrequencyAvg / (highFrequencyMax + e) * HighFrequencySensitivity))
									);

		positions[i*3] = p.x;
		positions[i*3+1] = p.y;
		positions[i*3+2] = p.z;
	}

	sphere.geometry.attributes.position.needsUpdate = true;
	sphere.geometry.computeVertexNormals();
}

var update = function(){

	audioInput = document.getElementById("audioInput");
	audioControls = document.getElementById("audioControls");
	
	window.addEventListener('resize', onWindowResize, true);
	
	if (audioInput != null){
		loadAudio();
	}

	sphere.rotation.y += guiControls.Speed * 0.005;

	if (analyser){

		if ((analyser.getAverageFrequency() != 0)){
			simplexNoise();
		}

	}

	if (audioControls.paused){
		resetSphere();
	}
	
}

function animate() {
	
	renderer.render(scene, camera);

	update();

	requestAnimationFrame(animate);

}

init();
animate();