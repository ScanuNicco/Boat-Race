//show("disclaimer");
function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
        vars[key] = value;
    });
    return vars;
}

var loc = getUrlVars()["location"];
var track = getUrlVars()["track"];
if (loc == null) {
    loc = "Venice";
    track = "1";
}
notify("Location: " + loc, "Track number " + track);

//FPS counter setup
var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

var camera, scene, renderer, controls;

var objects = [];

var raycaster;
var water;

var moveForward = false;
var moveBackward = false;
var turnLeft = false;
var turnRight = false;
var canJump = false;

var COLLISION_CORRECTION_INCREMENT = .1;

var collidableMeshList = []; //Meshes that can be collided with, initially everything but the water

var prevTime = performance.now();
var velocity = new THREE.Vector3();
var acceleration = new THREE.Vector3();
var direction = new THREE.Vector3();
var vertex = new THREE.Vector3();
var color = new THREE.Color();
var numSeconds = 8;
var waitClock = setInterval(countdown, 1000);
var canFinishLap = true;
var laps = 0;
var songNum = 1;
var nextSong = "";

var globalVertex;

init();
playerHealthLower(50);
immortal(6000);
animate();
var lapMSeconds = 0;
var lapSeconds = 0;
var lapMinutes = 0;
var bestLap = 0;
var bestString = "None Yet";
var lapString = "";
var lastLap = "None Yet";

var directionVector = new THREE.Vector3(); //used in the collision detection later
//var timer = window.setInterval(runTimer, 1);

function init() {
    document.getElementById('backgroundMusic').addEventListener('ended', function () {
        console.log("songEnded");
        songNum++;
        nextSong = "Music/Venice/" + songNum + ".mp3";
        audioPlayer = document.getElementById('backgroundMusic'); //This line doesn't do anything
        audioPlayer.src = nextSong;
        audioPlayer.load(); //audioPlayer at this point is a string, which does not have a function load() or play()
        audioPlayer.play();
        if (songNum == 7) // this is the end of the songs.
        {
            songNum = 1;
        }
    }, false);
    //alert("started init");
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.y = 10;
    camera.position.z = 25;

    controls = new THREE.PointerLockControls(camera);
    //alert("Controls is " + controls);
    /*velocity.y += 350;
    playerHealth = 100;
    document.getElementById("healthDisplay").innerHTML = playerHealth;
    playerHealthLower(1);*/

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x00ff00);
    scene.fog = new THREE.Fog(0xffffff, 200, 750);

    var light = new THREE.DirectionalLight(0xffffff, 0.8);;
    scene.add(light);

    var light = new THREE.AmbientLight(0x202020); // soft white light
    scene.add(light);


    var blocker = document.getElementById('blocker');
    var instructions = document.getElementById('menu');

    instructions.style.display = 'block';
    blocker.style.bottom = '0px';
    document.getElementById("loading").style.display = "none";
    /*
                document.body.addEventListener('click', function(event) {
                    controls.lock();

                }, false);*/
    controls.addEventListener('lock', function () {

        instructions.style.display = 'block';
        blocker.style.bottom = '150%';
        document.getElementById("loading").style.display = "none";

    });
    controls.addEventListener('unlock', function () {

        blocker.style.bottom = '0px';
        instructions.style.display = '';

    });

    scene.add(controls.getObject());
    var onKeyDown = function (event) {

        switch (event.keyCode) {

            case 38: // up
            case 87: // w
                moveForward = true;
                break;

            case 37: // left
            case 65: // a
                turnLeft = true;
                break;

            case 40: // down
            case 83: // s
                moveBackward = true;
                break;

            case 39: // right
            case 68: // d
                turnRight = true;
                break;
        }

    };

    var onKeyUp = function (event) {

        switch (event.keyCode) {

            case 38: // up
            case 87: // w
                moveForward = false;
                break;

            case 37: // left
            case 65: // a
                turnLeft = false;
                break;

            case 40: // down
            case 83: // s
                moveBackward = false;
                break;

            case 39: // right
            case 68: // d
                turnRight = false;
                break;

        }

    };
    //alert("point 5");
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);

    raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10);
    var waterGeometry = new THREE.PlaneBufferGeometry(10000, 10000);
    water = new THREE.Water(
        waterGeometry, {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader().load(
                'https://threejs.org/examples/textures/waternormals.jpg',
                function (texture) {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                }),
            alpha: 1.0,
            sunDirection: light.position.clone().normalize(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,
            distortionScale: 3.7,
            fog: scene.fog !== undefined
        }
    );
    water.name = "water";
    water.rotation.x = -Math.PI / 2;
    scene.add(water);
    var sky = new THREE.Sky();
    sky.scale.setScalar(10000);;
    scene.add(sky);
    var uniforms = sky.material.uniforms;
    uniforms.turbidity.value = 10;
    uniforms.rayleigh.value = 2;
    uniforms.luminance.value = 1;
    uniforms.mieCoefficient.value = 0.005;
    uniforms.mieDirectionalG.value = 0.8;
    var parameters = {
        distance: 400,
        inclination: 0.3,
        azimuth: 0.205
    };

    function updateSun() {
        var theta = Math.PI * (parameters.inclination - 0.5);
        var phi = 2 * Math.PI * (parameters.azimuth - 0.5);
        light.position.x = parameters.distance * Math.cos(phi);
        light.position.y = parameters.distance * Math.sin(phi) * Math.sin(theta);
        light.position.z = parameters.distance * Math.sin(phi) * Math.cos(theta);
        sky.material.uniforms.sunPosition.value = light.position.copy(light.position);
        water.material.uniforms.sunDirection.value.copy(light.position).normalize();
        //camera.update( renderer, scene );
    }
    updateSun();
    // floor

    /*var floorGeometry = new THREE.PlaneBufferGeometry(2000, 2000, 100, 100);
    floorGeometry.rotateX(-Math.PI / 2);

    // vertex displacement

    var position = floorGeometry.attributes.position;

    for (var i = 0, l = position.count; i < l; i++) {

        vertex.fromBufferAttribute(position, i);

        vertex.x += Math.random() * 20 - 10;
        vertex.y += Math.random() * 2;
        vertex.z += Math.random() * 20 - 10;

        position.setXYZ(i, vertex.x, vertex.y, vertex.z);

    }

    floorGeometry = floorGeometry.toNonIndexed(); // ensure each face has unique vertices

    position = floorGeometry.attributes.position;
    var colors = [];



    for (var i = 0, l = position.count; i < l; i++) {

        color.setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75);
        colors.push(color.r, color.g, color.b);

    }

    floorGeometry.addAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    waterTexture = new THREE.TextureLoader().load("Images/water.jpg");
    var floorMaterial = new THREE.MeshBasicMaterial({
        map: waterTexture
    });

    var floor = new THREE.Mesh(floorGeometry, floorMaterial);
    scene.add(floor);*/

    // objects

    boxGeometry = new THREE.BoxBufferGeometry(24, 12, 24);
    boxGeometry = boxGeometry.toNonIndexed(); // ensure each face has unique vertices
    middleGeometry = new THREE.BoxBufferGeometry(24 * 60, 12, 24 * 20);
    middleGeometry = middleGeometry.toNonIndexed(); // ensure each face has unique vertices

    position = boxGeometry.attributes.position;
    midPosition = middleGeometry.attributes.position;
    colors = [];

    for (var i = 0, l = position.count; i < l; i++) {

        color.setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75);
        colors.push(color.r, color.g, color.b);

    }

    boxGeometry.addAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    sandTexture = new THREE.TextureLoader().load("https://scanunicco.github.io/Boat-Race/Images/brick.jpg");
    middleMaterial = new THREE.MeshBasicMaterial({
        map: sandTexture
    });

    //Middle Block
    /*for (var h = -20; h < 40; h++) {
            	for (var j = 1; j < 20; j++) {
            		boxMaterial = new THREE.MeshBasicMaterial({
            			map: sandTexture
            		});
            		var box = new THREE.Mesh(boxGeometry, boxMaterial);
            		box.position.x = h * 24;
            		box.position.z = j * 24;
            		box.position.y = 4;
            		scene.add(box);
            		objects.push(box);
            	}
            }
            var middle = new THREE.Mesh(middleGeometry, middleMaterial);
            					middle.position.x = 10 * 24;
            		middle.position.z = 10 * 24;
            		middle.position.y = 4;
            		scene.add(middle);
            		objects.push(middle);

            //Right Side
            /*for (var h = -35; h < 43; h++) {
            	for (var j = -19; j < -2; j++) {
            		boxMaterial = new THREE.MeshBasicMaterial({
            			map: sandTexture
            		});
            		var box = new THREE.Mesh(boxGeometry, boxMaterial);
            		box.position.x = h * 24;
            		box.position.z = j * 24;
            		box.position.y = 4;
            		scene.add(box);
            		objects.push(box);
            	}
            }
			
            			var right = new THREE.Mesh(middleGeometry, middleMaterial);
            					right.position.x = 10 * 24;
            		right.position.z = -12 * 24;
            		right.position.y = 4;
            		scene.add(right);
            		objects.push(right);

            //Above
            for (var h = 43; h < 60; h++) {
            	for (var j = -20; j < 40; j++) {
            		boxMaterial = new THREE.MeshBasicMaterial({
            			map: sandTexture
            		});
            		var box = new THREE.Mesh(boxGeometry, boxMaterial);
            		box.position.x = h * 24;
            		box.position.z = j * 24;
            		box.position.y = 4;
            		scene.add(box);
            		objects.push(box);
            	}
            }

            //Left Side
            for (var h = -23; h < 43; h++) {
            	for (var j = 23; j < 40; j++) {
            		boxMaterial = new THREE.MeshBasicMaterial({
            			map: sandTexture
            		});
            		var box = new THREE.Mesh(boxGeometry, boxMaterial);
            		box.position.x = h * 24;
            		box.position.z = j * 24;
            		box.position.y = 4;
            		scene.add(box);
            		objects.push(box);
            	}
            }

            // Behind
            for (var h = -43; h < -23; h++) {
            	for (var j = -2; j < 43; j++) {
            		boxMaterial = new THREE.MeshBasicMaterial({
            			map: sandTexture
            		});
            		var box = new THREE.Mesh(boxGeometry, boxMaterial);
            		box.position.x = h * 24;
            		box.position.z = j * 24;
            		box.position.y = 4;
            		scene.add(box);
            		objects.push(box);
            	}
            }*/
    //alert("point 7");
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ -- LOADERS -- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // instantiate a loader
    var loader = new THREE.OBJLoader();
    var loader2 = new THREE.OBMLoader();
    // load a resource
    loader.load(
        // resource URL
        'Models/boat.obj',
        // called when resource is loaded
        function (object) {

            scene.add(object);
            object.rotation.x = Math.PI / -2;

            object.scale.set(6, 6, 6);
            object.position.y = 4.5;
            object.geometry = new THREE.Geometry().fromBufferGeometry(object.children[0].geometry);
            //object.rotation.y = Math.PI / 2;
            boat = object;

        },
        // called when loading is in progresses
        function (xhr) {
            //alert((xhr.loaded / xhr.total * 100) + '% loaded');
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');

        },
        // called when loading has errors
        function (error) {
            //alert('An error happened');
            console.log('An error happened');

        }
    );
    /*
    			// load a resource
    			loader.load(
    				// resource URL
    				'Models/bridge.obj',
    				// called when resource is loaded
    				function(object) {

    					scene.add(object);
    					object.rotation.x = Math.PI / -2;
    					object.rotation.z = Math.PI / -2;
    					//object.scale.set(.1, .1, .1);
    					object.position.z = -35;
    					bridge = object;

    					collidableMeshList.push(bridge.children[0]);

    				},
    				// called when loading is in progresses
    				function(xhr) {

    					console.log((xhr.loaded / xhr.total * 100) + '% loaded');

    				},
    				// called when loading has errors
    				function(error) {

    					console.log('An error happened');

    				}
    			);


    			// load a resource
    			loader.load(
    				// resource URL
    				'Models/bridge2.obj',
    				// called when resource is loaded
    				function(object) {

    					scene.add(object);
    					object.scale.set(15, 15, 15);
    					object.position.x = 400;
    					object.position.z = -30;
    					object.position.y = 20;
    					bridge2 = object;

    					collidableMeshList.push(bridge2.children[0]);

    				},
    				// called when loading is in progresses
    				function(xhr) {

    					console.log((xhr.loaded / xhr.total * 100) + '% loaded');

    				},
    				// called when loading has errors
    				function(error) {

    					console.log('An error happened');

    				}
    			);

    			var counter = 0;
    			var fenceMaterial = new THREE.MeshPhongMaterial({
    				color: 0x555555
    			});
    			
    				*/ // load a resource

    //This loader should be replaced by the track system
    loader.load(
        // resource URL
        'Models/' + loc + '.obj',
        // called when resource is loaded
        function (object) {

            scene.add(object);
            object.scale.set(150, 150, 150);
            object.position.x = 200;
            object.position.z = 625;
            object.position.y = -5;
            bridge2 = object;
	    object.rotation.x = Math.PI / -2;
            collidableMeshList.push(bridge2.children[0]);
            bridge2.children[0].material.transparent = true;
            bridge2.children[0].material.opacity = 0.0;

        },
        // called when loading is in progresses
        function (xhr) {

            console.log((xhr.loaded / xhr.total * 100) + '% loaded');

        },
        // called when loading has errors
        function (error) {

            console.log('An error happened');

        }
    );

    var counter = 0;
    var fenceMaterial = new THREE.MeshPhongMaterial({
        color: 0x555555
    });
    /*
    			for (var i = 0; i <= 10; i++) {
    				// load a resource
    				loader2.load(
    					// resource URL
    					'Models/railing.obm',
    					// called when resource is loaded
    					function(object) {


    						object.scale.set(3, 3, 3);
    						object.position.x = counter * 45;
    						console.log("added object at " + (counter));
    						object.position.z = 20;
    						object.position.y = 10;
    						object.material = fenceMaterial;
    						scene.add(object);
    						counter++;
    					},
    					// called when loading is in progresses
    					function(xhr) {

    						console.log((xhr.loaded / xhr.total * 100) + '% loaded');

    					},
    					// called when loading has errors
    					function(error) {

    						console.log('An error happened');

    					}
    				);
    			}*/

    //alert("point 8");
    //

    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xff0000);
    document.body.appendChild(renderer.domElement);

    //

    window.addEventListener('resize', onWindowResize, false);

    //alert("init over");



}
//beeTexture = new THREE.TextureLoader().load("https://scanunicco.github.io/Boat-Race/Images/bee.png");
//var beeMaterial = new THREE.MeshBasicMaterial({
//	map: beeTexture
//});


function countdown() {
    numSeconds--;
    if (numSeconds == 1) {
        document.getElementById("secondsDisplay").innerHTML = "Game starts in 1 second.";
    } else if (numSeconds == 0) {
        document.getElementById("secondsDisplay").innerHTML = "Game has started.";
        clearInterval(waitClock);
        controls.lock();
    } else {
        document.getElementById("secondsDisplay").innerHTML = "Game starts in " + numSeconds + " seconds.";
    }
}


function youDead(message) {
    document.getElementById("died").style.display = 'block';
    document.getElementById("messageDisplay").value = message;
    controls.unlock();
    mainSound.pause();
    diedMusic.play();
    document.getElementById("menu").style.display = "none";
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

var oof = document.getElementById("oofSound");
var diedMusic = document.getElementById("diedSound");
var mainSound = document.getElementById("backgroundMusic");

function playerHealthLower(amount) {
    if (canDie == "yes") {
        playerHealth -= amount;
        document.getElementById("healthDisplay").innerHTML = playerHealth;
        if (playerHealth < 1) {
            youDead("Out of health");
        } else if (playerHealth < 26) {
            document.getElementById("healthDisplay").style.background = "red";
            document.getElementById("healthDisplay").style.color = "white";
        }
        oof.play();
        immortal(1000);
    }
}

var canDie = "no";

function immortal(howLong) {
    canDie = "no";
    console.log("immortal");
    setTimeout(mortal, howLong);
}

function mortal() {
    canDie = "yes";
}

function runTimer(ms) {
    if (controls.isLocked === true) {
        lapMSeconds += ms;

        lapHundredthSeconds = Math.floor((lapMSeconds / 10) % 100);

        lapSeconds = Math.floor((lapMSeconds / 1000) % 60);

        lapMinutes = Math.floor(lapMSeconds / 60000)

        lapString = fixTime(lapMinutes) + "." + fixTime(lapSeconds) + "." + fixTime(lapHundredthSeconds);
        document.getElementById("timerDisplay").innerHTML = "Current Lap: " + lapString + "<br>Last Lap: " + lastLap + "<br>Best Lap: " + bestString;
    }
}

function fixTime(num) {
    var str = String(num);
    if (str.length == 1) {
        str = "0" + str;
    }
    return str;
}

function show(EID) {
    document.getElementById(EID).style.right = "0px";
    document.getElementById("menu").style.left = "100%";
}

function hide(EID) {
    document.getElementById(EID).style.right = "100%";
    document.getElementById("menu").style.left = "0px";
}

var BOAT_STATS = {
    acceleration: 100,
    turning: 2,
    friction: .5
}

function canFinish() {
    canFinishLap = true;
}

function notify(header, paragraph) {
    document.getElementById("notifyHeader").innerHTML = header;
    document.getElementById("notifyText").innerHTML = paragraph;
    document.getElementById("notifyContainer").style.left = "0px";
    setTimeout(closeNotify, 5000);
}

function closeNotify() {
    document.getElementById("notifyContainer").style.left = "calc(-45% - 30px)";
}

function milToMin(millis) {
    var minutes = Math.floor(millis / 60000);
    var seconds = ((millis % 60000) / 1000).toFixed(0);
    return minutes + "." + (seconds < 10 ? '0' : '') + seconds;
}

document.getElementById("musicSwitch").checked = false;
toggleMusic();
function toggleMusic() {
    if (document.getElementById("musicSwitch").checked) {
        document.getElementById("backgroundMusic").play();
    } else {
        document.getElementById("backgroundMusic").pause();
    }
}

function renderDistance() {
    camera.far = parseInt(document.getElementById("distInput").value, 10);
    camera.updateProjectionMatrix();
}

function checkCollision() {
	for (var vertexIndex = 0; vertexIndex < boat.geometry.vertices.length; vertexIndex++) {
		var localVertex = boat.geometry.vertices[vertexIndex].clone();
		globalVertex = localVertex.applyMatrix4(boat.matrixWorld);
		directionVector.subVectors(globalVertex, boat.position);
		var ray = new THREE.Raycaster(boat.position, directionVector.clone().normalize(), 0, directionVector.length);
		var collisionResults = ray.intersectObjects(collidableMeshList);
		if (collisionResults.length > 0 && collisionResults[0].distance < directionVector.length()) {
			return collisionResults[0];
		}
	}
	return null;
}


function animate() {
    //alert("starting animate");
    stats.begin();
    //controls.update();
    requestAnimationFrame(animate);
    if (controls.isLocked === true) {
        //alert("point 1");
        raycaster.ray.origin.copy(controls.getObject().position);
        raycaster.ray.origin.y -= 10;

        var intersections = raycaster.intersectObjects(objects);

        var onObject = intersections.length > 0;

        var time = performance.now();
        var delta = (time - prevTime) / 1000;

        runTimer(Math.floor(delta * 1000));

        velocity.x -= velocity.x * BOAT_STATS.friction * delta;
        velocity.z -= velocity.z * BOAT_STATS.friction * delta;

        direction.z = Number(moveForward) - Number(moveBackward);

        direction.normalize(); // this ensures consistent movements in all directions

        acceleration.z = direction.z * BOAT_STATS.acceleration * delta;

        var turnDist = (Number(turnLeft) - Number(turnRight)) * BOAT_STATS.turning * delta;

        var vector = new THREE.Vector3(1, 0, 0);

        vector.applyQuaternion(boat.quaternion);
        vector.multiplyScalar(acceleration.z);

        velocity.x += vector.x;
        //velocity.y += vector.y;
        velocity.z += vector.z;

        if (boat.position.x < 10 && boat.position.x > -10) {
            if (boat.position.z < 0 && boat.position.z > -40) {
                if (canFinishLap) {
                    laps++;
                    if (laps == 1) {
                        bestLap = lapMSeconds;
                        bestString = milToMin(lapMSeconds) + "." + lapHundredthSeconds;
                        lastLap = lapString;
                    } else {
                        if (lapMSeconds < bestLap) {
                            bestLap = lapMSeconds;
                            bestString = milToMin(lapMSeconds) + "." + fixTime(lapHundredthSeconds);
                            lastLap = bestString;
                            notify("New Best Lap!", "Your time was " + bestString + ".");
                        } else {
                            lastLap = lapString;
                        }
                    }
                    lapMSeconds = 0;
                    canFinishLap = false;
                    document.getElementById("lapsDisplay").innerText = "Laps: " + laps;
                    setTimeout(canFinish, 1000);
                }
            }
        }



        controls.getObject().position.x += velocity.x * delta;
        //controls.getObject().position.y += velocity.y * delta;
        controls.getObject().position.z += velocity.z * delta;



        //var boatGeo = new THREE.Geometry().fromBufferGeometry(boat.children[0].geometry);



        var collisionResults = checkCollision();


                if (collisionResults != null) {
		    //alert("collision");
		    //alert(directionVector.x);
		    //alert(collisionResults[0].point.x);
		    //alert((velocity.x * delta) + (directionVector.x - collisionResults[0].point.x));
		    
		    try {
                    boat.rotation.z -= turnDist * 1.1;

                    var newVelocity = new THREE.Vector3(velocity.x, velocity.y, velocity.z);

                    var reflectVector = {x: collisionResults.face.normal.x, y: 0, z: collisionResults.face.normal.y};
                    
                    newVelocity.reflect(reflectVector);
		
                    controls.getObject().position.x -= (velocity.x * delta)/* + (globalVertex.x - collisionResults.point.x)*/;

                    controls.getObject().position.z -= (velocity.z * delta)/* + (globalVertex.z - collisionResults.point.z)*/;

                    velocity = newVelocity;

                    controls.getObject().position.x += velocity.x * delta;

                    controls.getObject().position.z += velocity.z * delta;
			    
		    collisionResults = checkCollision();
			    
		    //while (collisionResults != null) {
			    controls.getObject().position.x += collisionResults.face.normal.x * COLLISION_CORRECTION_INCREMENT;
			    controls.getObject().position.z -= collisionResults.face.normal.y * COLLISION_CORRECTION_INCREMENT; //Don't know why this works but it does, probably related to rotating the track
			    //collisionResults = checkCollision();
		    //}
		    } catch(e) {
			    alert("Error with collision: " + e.message);
		    }
                }


        prevTime = time;
        boat.position.x = controls.getObject().position.x;
        boat.position.z = controls.getObject().position.z;
        boat.rotation.z += turnDist;

        var speed = Math.floor(Math.abs(velocity.x) + Math.abs(velocity.y) + Math.abs(velocity.z));
        document.getElementById("speedDisplay").innerText = "Speed: " + speed;
        if (speed > 200) {
            document.getElementById("speedDisplay").style.color = "red";
        } else if (speed > 150) {
            document.getElementById("speedDisplay").style.color = "orange";
        } else if (speed > 100) {
            document.getElementById("speedDisplay").style.color = "#bca600";
        } else {
            document.getElementById("speedDisplay").style.color = "green";
        }
    }
    water.material.uniforms.time.value += 1.0 / 60.0;

    renderer.render(scene, camera);

    stats.update();
}
