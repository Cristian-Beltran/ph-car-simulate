const canvas = document.getElementById("trackCanvas");
const ctx = canvas.getContext("2d");
const speedInput = document.getElementById("speed");
const manualButton = document.getElementById("manual");
const autoButton = document.getElementById("auto");
const samplesList = document.getElementById("samples");
const oledScreen = document.querySelector(".oled-text");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let robot = { x: 50, y: 50, width: 120, height: 180, speed: 5, angle: 0 };
let isManual = false;
let points = generatePoints();
let targetPoint = 0;
let isMoving = true;
let collectedSamples = [];
let isAnalyzing = false;
let analyzeTimer = null;

const backgroundImage = new Image();
backgroundImage.src = "assets/background.jpg";
const robotMovingImage = new Image();
robotMovingImage.src = "assets/robot-moving.png";
const robotSamplingImage = new Image();
robotSamplingImage.src = "assets/robot-sampling.png";

// Esperar a que todas las imágenes se carguen
Promise.all([
    new Promise((resolve) => (backgroundImage.onload = resolve)),
    new Promise((resolve) => (robotMovingImage.onload = resolve)),
    new Promise((resolve) => (robotSamplingImage.onload = resolve)),
]).then(() => {
    // Iniciar la simulación una vez que las imágenes estén cargadas
    update();
});

function generatePoints() {
    const margin = 200; // Margen desde los bordes del canvas
    const cols = 5;
    const rows = 5;
    const maxWidth = canvas.width; // 70% del ancho de la pantalla
    const maxHeight = canvas.height; // 70% del alto de la pantalla
    const stepX = (maxWidth - 2 * margin) / (cols - 1);
    const stepY = (maxHeight - 2 * margin) / (rows - 1);

    let points = [];
    for (let row = 0; row < rows; row++) {
        let rowPoints = [];
        for (let col = 0; col < cols; col++) {
            let x = margin + col * stepX;
            let y = margin + row * stepY;
            rowPoints.push({ x, y });
        }

        // Si es una fila impar, invertimos el orden de los puntos
        if (row % 2 !== 0) {
            rowPoints.reverse();
        }

        points = points.concat(rowPoints);
    }
    return points;
}
function drawRobot() {
    ctx.save();
    ctx.translate(robot.x, robot.y);
    ctx.rotate(robot.angle + Math.PI / 2);
    // Seleccionar la imagen apropiada
    const robotImage = isAnalyzing ? robotSamplingImage : robotMovingImage;
    // Dibujar la imagen centrada en la posición del robot
    ctx.drawImage(
        robotImage,
        -robot.width / 2,
        -robot.height / 2,
        robot.width,
        robot.height,
    );
    ctx.restore();
}

function drawTrack() {
    // Dibujar el fondo
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    // Dibujar los puntos
    points.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = index === targetPoint ? "red" : "green";
        ctx.fill();
        ctx.closePath();
    });

    drawRobot();
}

function moveTowards(targetX, targetY) {
    let dx = targetX - robot.x;
    let dy = targetY - robot.y;
    let targetAngle = Math.atan2(dy, dx);

    let angleDiff = targetAngle - robot.angle;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    robot.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.05);

    if (Math.abs(angleDiff) < 0.1) {
        robot.x += robot.speed * Math.cos(robot.angle);
        robot.y += robot.speed * Math.sin(robot.angle);
    }

    return Math.sqrt(dx * dx + dy * dy) < 5;
}

function autoMove() {
    if (!isMoving || isAnalyzing) return;

    let point = points[targetPoint];
    if (moveTowards(point.x, point.y)) {
        isAnalyzing = true;
        analyzeSample();
    }
}

function analyzeSample() {
    oledScreen.textContent = "Analizando...";
    setTimeout(() => {
        let ph = calculatePH();
        oledScreen.textContent = `pH: ${ph.toFixed(2)}`;
        setTimeout(() => {
            isAnalyzing = false;
            targetPoint = (targetPoint + 1) % points.length;
            oledScreen.textContent = "Listo para muestrear";
        }, 2000);
    }, 2000);
}
function calculatePH() {
    const soilType = document.getElementById("soilType").value;
    const moistureLevel = document.getElementById("moistureLevel").value;
    const fertilizerAmount =
        parseFloat(document.getElementById("fertilizerAmount").value) || 0;

    // pH inicial y capacidad tampón por tipo de suelo
    let initialPH, bufferCapacity;
    switch (soilType) {
        case "arcilloso":
            initialPH = 6.5;
            bufferCapacity = 0.8;
            break;
        case "arenoso":
            initialPH = 6.0;
            bufferCapacity = 0.3;
            break;
        case "franco":
            initialPH = 7.0;
            bufferCapacity = 0.6;
            break;
        default:
            initialPH = 7.0;
            bufferCapacity = 0.5;
    }

    // Efecto de la humedad
    let moistureEffect;
    switch (moistureLevel) {
        case "bajo":
            moistureEffect = 0.3;
            break;
        case "medio":
            moistureEffect = 0;
            break;
        case "alto":
            moistureEffect = -0.2;
            break;
        default:
            moistureEffect = 0;
    }

    // Efecto del fertilizante (asumiendo un fertilizante ácido)
    let fertilizerEffect = -0.05 * fertilizerAmount;

    // Cálculo del pH final
    let pHChange = (moistureEffect + fertilizerEffect) * (1 - bufferCapacity);
    let finalPH = initialPH + pHChange;

    // Asegurar que el pH esté en el rango válido (0-14)
    finalPH = Math.max(0, Math.min(14, finalPH));

    return finalPH;
}

function moveManual(e) {
    if (!isManual || isAnalyzing) return;

    switch (e.key) {
        case "ArrowUp":
            robot.x += robot.speed * Math.cos(robot.angle);
            robot.y += robot.speed * Math.sin(robot.angle);
            break;
        case "ArrowDown":
            robot.x -= robot.speed * Math.cos(robot.angle);
            robot.y -= robot.speed * Math.sin(robot.angle);
            break;
        case "ArrowLeft":
            robot.angle -= 0.1;
            break;
        case "ArrowRight":
            robot.angle += 0.1;
            break;
        case " ":
            if (!isAnalyzing) {
                isAnalyzing = true;
                analyzeSample();
            }
            break;
    }
}

speedInput.addEventListener("input", () => {
    robot.speed = parseInt(speedInput.value);
});

manualButton.addEventListener("click", () => {
    isManual = true;
    isMoving = false;
    clearTimeout(analyzeTimer);
    oledScreen.textContent = "Modo Manual";
});

autoButton.addEventListener("click", () => {
    isManual = false;
    isMoving = true;
    targetPoint = 0;
    robot.x = points[0].x;
    robot.y = points[0].y;
    oledScreen.textContent = "Modo Automático";
});

window.addEventListener("keydown", moveManual);

function update() {
    if (!isManual) {
        autoMove();
    }
    drawTrack();
    requestAnimationFrame(update);
}

update();
