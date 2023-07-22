const socket = io({
    autoConnect: false
});

let brushsize = 1;
let canSendCords = true;
let sendTick = 0, recieveTick = 0;
let playerCount = 0;
let chatString = "";
let coord = { x: 0, y: 0, brushsize: brushsize };
let paint = false;
let canDraw = false;

let chatArea = document.getElementById("chat-container");
let chatText = document.getElementById('chatField');
let chatForm = document.getElementById('chat-form');
let wordCounter = document.getElementById('wordcounter');
let chatSendBtn = document.getElementById('sendMsgBtn');
let guessField = document.getElementById('guessWordField')

const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');
var pName = "";
var isHost = false;
var hasGameStarted = false;

var canChooseWord = true;
var guessWord = "";
var guessedPlayer = false;
var atleastOneGuessed = false;
var audioMute = false;

var penColor = "#000000";

///****///
// score = 0;
class PlayerContainer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.players = [];
    }

    addPlayer(playerId, playerScore) {
        // score = playerScore;
        const player = document.createElement('div');
        player.classList.add('player');
        player.setAttribute('data-id', playerId);
        player.setAttribute('data-score', playerScore);
        player.innerHTML = `<div class="player-div"><div class="player-name"></b><pre><code><xmp>${player.getAttribute('data-id')}</xmp></pre></code></div>  <div class="player-score">${player.getAttribute('data-score')}</div> </div>`;
        this.players.push(player);
        this.container.appendChild(player);
        this.sortPlayersByScore();
    }

    removePlayer(playerId) {
        const index = this.players.findIndex(player => player.getAttribute('data-id') === playerId);
        if (index >= 0) {
            this.players.splice(index, 1);
            const player = this.container.querySelector(`[data-id="${playerId}"]`);
            this.container.removeChild(player);
        }
    }

    rearrangePlayers() {
        this.players.forEach((player, index) => {
            player.style.order = index;
        });
    }

    highlightPlayer(playerName) {
        const playerDiv = this.container.querySelector(`.player[data-id="${playerName}"]`);

        if (playerDiv) {
            playerDiv.querySelector(".player-div").classList.add('drawingPlayer');
        }
    }

    unhighlightPlayer(playerName) {
        const playerDiv = this.container.querySelector(`.player[data-id="${playerName}"]`);

        if (playerDiv) {
            playerDiv.querySelector(".player-div").classList.remove('drawingPlayer');
        }
    }

    sortPlayersByScore() {
        this.players.sort((a, b) => b.getAttribute('data-score') - a.getAttribute('data-score'));
        this.rearrangePlayers();
        this.addCrownToFirst();
    }

    addCrownToFirst() {
        if (this.players[0].getAttribute('data-score') > 0) {
            this.players[0].innerHTML = `<div class="player-div"> <img width="30px" height="30px"  src="images/crown.png"> <div class="player-name">${this.players[0].getAttribute('data-id')}</div>  <div class="player-score">${this.players[0].getAttribute('data-score')}</div> </div>`;
        }
        for (let index = 1; index < this.players.length; index++) {
            const element = this.players[index];
            if (element.getAttribute('data-score') > 0) {
                element.innerHTML = `<div class="player-div"><div class="player-name"></b><pre><code><xmp>${element.getAttribute('data-id')}</xmp></pre></code></div>  <div class="player-score">${element.getAttribute('data-score')}</div> </div>`;
            }
        }
    }

    markWinnerCelebrate() {
        this.players[0].classList.add('winner');

    }

    markCorrectGuess(playerName) {
        const playerDiv = this.container.querySelector(`.player[data-id="${playerName}"]`);

        if (playerDiv) {
            playerDiv.querySelector(".player-div").classList.add('correctGuessPlayer');
        }
    }

    resetCorrectGuess() {
        var p = this.getPlayers();
        p.forEach(element => {
            const playerDiv = this.container.querySelector(`.player[data-id="${element}"]`);

            if (playerDiv) {
                playerDiv.querySelector(".player-div").classList.remove('correctGuessPlayer');
            }
        });
    }

    getPlayers() {
        return this.players.map(playerDiv => playerDiv.getAttribute('data-id'));
    }

    updatePlayerScore(player_id, newScore) {
        this.players.forEach(p => {
            if (p.getAttribute('data-id') == player_id) {
                p.setAttribute('data-score', newScore);
            }
        });
        this.sortPlayersByScore();
    }
}
const playerContainer = new PlayerContainer('player-container');

// Plantillas para las interfaces
loginDiv = `
<div id="overlay" onclick=""></div>
<div class="loginArea pb-0 ">
    <h1>Draw Quest <i class="fa-solid fa-feather"></i></h1>
    <div class="separator"></div>    
    <form id="loginForm">
       <input id="playerName" type="text" maxlength="20" placeholder="Ingresa tu apodo aquí" autocomplete="off" autofocus class="form-control">
       <button id="loginButton" class="mt-3" type="submit" onclick="loginToGame()">¡Jugar!</button>
    </form>
    
       <button  id="randomName" onclick="randomNameGen()"><i class="fa-solid fa-dice"></i></button>
   
</div>
`;

hostDiv = `<div id="overlay" onclick=""></div>
<div class="loginArea">
  <h1 class="fs-20">Eres el anfitrión del juego...</h1>
  <h1 class="fs-20">Presiona iniciar para comenzar</h1>

  <button id="loginButton" class="mt-3" onClick="startGame()">
    ¡A dibujar!
  </button>
</div>`;

waitingDiv = `  
<div id="overlay" onclick=""></div>
<div class="loginArea">
  <h1 class="fs-20">Esperando al anfitrión...</h1>
  <img width="50px"  src="/images/loadingGif.gif">
  
</div>`;

choosingWord = ``;

votingDiv = ` <button onclick="voteUp();document.querySelector('.voting').innerHTML='';"><img id="thumbsUp" src="images/thumbsUp.gif"></button>
<button onclick="voteDown();document.querySelector('.voting').innerHTML='';"><img id="thumbsDown" src="images/thumbsDown.gif"></button>`;

let loginContainer = document.getElementById('login-container');
loginContainer.innerHTML = String(loginDiv);

document.getElementById('loginForm').addEventListener('submit', event => {
    event.preventDefault();
    loginToGame();

});

class sound {
    constructor(src) {
        this.sound = document.createElement("audio");
        this.sound.src = src;
        this.sound.setAttribute("preload", "auto");
        this.sound.setAttribute("controls", "none");
        this.sound.style.display = "none";
        document.body.appendChild(this.sound);
        this.play = function () {
            if (!audioMute) {
                console.log("Playing sound!");
                this.sound.play();
            }
        };
    }
}

//Eventos y funciones relacionadas con el canvas

// Función para ajustar el tamaño del canvas en respuesta a cambios de tamaño en la ventana
function resizeCanvas() {
    // Guardamos el contenido actual del canvas en una imagen temporal
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.drawImage(canvas, 0, 0);

    // Redimensionamos el canvas
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Volvemos a dibujar el contenido del canvas desde la imagen temporal
    ctx.drawImage(tempCanvas, 0, 0);
}

// Función para obtener la posición del cursor en el canvas redimensionado
function getPosition(event) {
    // Obtener el tamaño del canvas dinámicamente
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Obtener la posición del cursor relativa al canvas redimensionado
    coord.x = (event.clientX - canvas.offsetLeft) * (canvas.width / canvas.clientWidth);
    coord.y = (event.clientY - canvas.offsetTop) * (canvas.height / canvas.clientHeight);

    // Verifica si el puntero del ratón está dentro del área del canvas
    if ((coord.x < 0 || coord.y < 0) || (coord.x > canvasWidth || coord.y > canvasHeight)) {
        stopPainting();
    } else if (canSendCords) {
        sendPosition(coord.x, coord.y);
        return;
    }
}

// Función para ajustar el tamaño del canvas al cargar la página y en respuesta a cambios de tamaño en la ventana
function setupCanvas() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

// Función para comenzar a dibujar
function startPainting(event) {
    paint = true;
    getPosition(event);
    socket.emit('startPaint', paint);
}

// Función para dejar de dibujar
function stopPainting() {
    paint = false;
    socket.emit('startPaint', paint);
    sendTick = 0;
}

// Función para dibujar en el canvas
function sketch(event) {
    if (!paint) return;
    if (canDraw) {
        ctx.beginPath();
        ctx.lineWidth = brushsize;
        ctx.lineCap = 'round';
        console.log(penColor);
        ctx.strokeStyle = penColor;
        ctx.moveTo(coord.x, coord.y);
        getPosition(event);
        ctx.lineTo(coord.x, coord.y);
        ctx.stroke();
    }
}

// Evento para el dibujo en el canvas
window.addEventListener('load', () => {
    setupCanvas();
    canvas.addEventListener('mousedown', startPainting);
    canvas.addEventListener('mouseup', stopPainting);
    document.addEventListener('mousemove', sketch);
    canvas.addEventListener('wheel', brushSize);
    canvas.addEventListener('mouseout', stopPainting);
});

// Función para ajustar el tamaño del pincel
function brushSize(event) {
    if (event.deltaY < 0 && brushsize < 10) {
        brushsize += 1;
    } else if (brushsize > 1) {
        brushsize -= 1;
    }
}

// Función para establecer el color del pincel
function setColor(hexValue) {
    if (canDraw) {
        socket.emit('penColor', hexValue);
    }
}

// Evento para recibir el estado de dibujo desde el servidor
socket.on('startPaint', paintStatus => {
    paint = paintStatus;
    if (!paint) {
        recieveTick = 0;
    }
});

// Funciones relacionados con reaciones del dibujo
function voteUp() {
    socket.emit('vote', [pName, "up"]);
}

function voteDown() {
    socket.emit('vote', [pName, "down"]);
}

socket.on('vote', voteStatus => {
    const voterName = voteStatus[0];

    if (voteStatus[1] == "up") {
        addContentToChat(undefined, `${voterName} le dio un "Me gusta" al dibujo. 👍`, "green");
    }
    if (voteStatus[1] == "down") {
        addContentToChat(undefined, `${voterName} le dio un "No me gusta" al dibujo. 👎`, "red");
    }
});

//Eventos y funciones relacionadas con el chat:

// Función para enviar el mensaje de chat al servidor
function updateSendChat() {
    chatText.focus();
    if (chatString.length > 0 && canDraw == false || chatString.includes("//admin")) {
        var msg = `<div class="chat-message"><b>${pName}: </b><pre><code><xmp>${chatText.value}</xmp></pre></code> </div>`;
        sendMsg = ([pName, chatText.value]);
        socket.emit('updateText', sendMsg); //JSON.stringify(sendMsg)
        //chatArea.innerHTML = msg + chatArea.innerHTML;

        chatString = "";
        wordcounter.innerHTML = `(${chatString.length})`;
        chatText.value = ""
    }
}

function enableChat() {
    chatSendBtn.disabled = false;
    chatText.disabled = false;
}

function addContentToChat(chatPlayerName = "Server", chatContent, color = "black", bgColor = "white") {
    let msg = "";
    if (chatPlayerName == "Server") {
        if (color == "red") {
            msg = `<div class="chat-message" style=" color:${color};background-color:rgb(252, 153, 153);"><b>${chatPlayerName}: </b><i>${chatContent}</i> </div>`;

        } else {
            msg = `<div class="chat-message" style=" color:${color};background-color:light${bgColor};"><b>${chatPlayerName}: </b><i>${chatContent}</i> </div>`;
        }
    } else {
        msg = `<div class="chat-message"><b>${chatPlayerName}: </b><i>${chatContent}</i> </div>`;
    }
    chatArea.innerHTML = msg + chatArea.innerHTML;
}

// Función para manejar el envío de mensajes del chat
chatForm.addEventListener('submit', event => {
    chatString = "";
    wordcounter.innerHTML = `(${chatString.length})`;
    chatText.value = ""
    chatText.focus();
    event.preventDefault();
});

chatText.addEventListener('input', event => {
    chatString = chatText.value;
    wordcounter.innerHTML = `(${chatString.length})`;

    if (chatString.length == 0)
        wordcounter.innerHTML = "";

});

// Evento para recibir el contenido del chat desde el servidor
socket.on('chatContent', content => {
    //content = [who, what]

    if (content[0] == "kick") {
        addContentToChat(undefined, `${content[1]} is kicked 🦵🏻`, "red");
    } else {
        if (content[1] == "almost" && !guessedPlayer) {
            addContentToChat(undefined, ` ${content[0]}'s guess is close `, "orange");
        } else {
            if (guessedPlayer && content[1].includes(guessWord)) {
                var censorWord = "";
                for (i = 0; i < content[1].length; i++) {
                    censorWord += "*";
                }
                addContentToChat(content[0], censorWord);
            } else {
                addContentToChat(content[0], content[1]);
            }
        }
    }
});

// Evento para recibir los mensajes de votación desde el servidor
socket.on('vote', voteStatus => {
    const voterName = voteStatus[0];

    if (voteStatus[1] == "up") {
        addContentToChat(undefined, `${voterName} le dio un "Me gusta" al dibujo. 👍`, "green");
    }
    if (voteStatus[1] == "down") {
        addContentToChat(undefined, `${voterName} le dio un "No me gusta" al dibujo. 👎`, "red");
    }
});

// Evento para recibir la lista de jugadores desde el servidor
socket.on('playersList', playersList => {
    pList = JSON.parse(playersList);
    for (const player in pList) {
        if (player != pName) {
            playerContainer.addPlayer(player, pList[player]);
        }
    }
});

// Evento para recibir el estado de anfitrión desde el servidor
socket.on('hostPlayer', boolVal => {
    isHost = boolVal;
    if (isHost) {
        loginContainer.style.height = "230px";
        loginContainer.style.width = "550px";
        loginContainer.innerHTML = hostDiv;
    }
});

// Evento para recibir la lista de palabras disponibles desde el servidor
socket.on('wordList', wordList => {

    if (canDraw) {
        var wordChooseDiv = `  
        <div id="overlay" onclick=""></div>
        <div class="loginArea" style="width: fit-content; height: fit-content;">
           <h1>Elige una palabra</h1>
            <button class="optBtn" id="opt1" onclick="selectedOpt('${wordList[0]}')">${wordList[0]}</button>
            <button class="optBtn" id="opt2" onclick="selectedOpt('${wordList[1]}')">${wordList[1]}</button>
            <button class="optBtn" id="opt3" onclick="selectedOpt('${wordList[2]}')">${wordList[2]}</button>
        </div>`;
        loginContainer.innerHTML = wordChooseDiv;
        console.log("TE TOCA DIBUJAR");
    }
});

let timerChooseReset;
// Evento para recibir el inicio del tiempo de elección de palabra desde el servidor
socket.on('chooseStart', chooseTime => {
    timerChooseReset = timer(chooseTime);
    canChooseWord = true;
})

// Evento para recibir el final del tiempo de elección de palabra desde el servidor
socket.on('chooseEnd', () => {
    canChooseWord = false;
    loginContainer.innerHTML = "";
    clearInterval(timerChooseReset);
})

// Evento para recibir el inicio del tiempo de dibujo desde el servidor
let drawTimerReset;
socket.on('drawStart', drawtime => {
    var startDrawing = new sound("/sfx/startDrawing.mp3");
    startDrawing.play();
    playerContainer.resetCorrectGuess();
    clearCanvas();
    drawTimerReset = timer(drawtime);
})

// Función para iniciar el juego cuando se presiona el botón de inicio
function startGame() {
    socket.emit('startGame');
    loginContainer.innerHTML = "";
}

// Función para enviar la posición del cursor en el canvas al servidor
function sendPosition(Xpos, Ypos) {
    if (canDraw) {
        socket.emit('position', {x: Xpos, y: Ypos, brushsize: brushsize});
        sendTick++;
    }
}

// Función para borrar el contenido del canvas
function clearCanvas() {
    if (canDraw) {
        socket.emit('clearCanvas');
    }
}

// Función para recibir el color del pincel desde el servidor
socket.on('penColor', hexValue => {
    penColor = hexValue;
    console.log('PC: ', penColor);
});

// Evento para recibir el borrado del canvas desde el servidor
socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Evento para recibir el inicio del juego desde el servidor
socket.on('gameStarted', () => {
    console.log("GAME STARTED!!");
    loginContainer.innerHTML = "";
    hasGameStarted = true;
});

// Evento para recibir la palabra elegida desde el servidor
socket.on('chosenWord', wordAndPlayer => {
    if (pName == wordAndPlayer[1]) {
        selectedOpt(wordAndPlayer[0], true);
    }
})

//Eventos y funciones relacionadas con el juego:

// Función para recibir la lista de jugadores que se han unido al juego desde el servidor
socket.on('newPlayerJoined', newPlayerName => {
    let joinSound = new sound("/sfx/joinGame.mp3");
    joinSound.play();
    console.log(newPlayerName, " se unió al juego 👋🏻");
    addContentToChat(undefined, newPlayerName + " se unió al juego 👋🏻", "green");
    playerContainer.addPlayer(newPlayerName, 0);
});

// Función para recibir el estado de votación correcta desde el servidor
socket.on('correctGuess', correctGuessPlayer => {
    atleastOneGuessed = true;
    var correctGuessSFX = new sound("/sfx/correctGuess.mp3");
    correctGuessSFX.play();
    playerContainer.markCorrectGuess(correctGuessPlayer[0]);
    addContentToChat(undefined, correctGuessPlayer[0] + " adivinó la palabra.", "green", "green");
    if (pName === correctGuessPlayer[0]) {
        guessField.innerHTML = "Palabra: " + correctGuessPlayer[1];
        guessWord = correctGuessPlayer[1];
        guessedPlayer = true;
    }
});

// Función para recibir el marcado del jugador ganador desde el servidor
socket.on('gameOver', () => {
    console.log("GO!");
    playerContainer.markWinnerCelebrate();
});

// Evento cuando un jugador abandona el juego
socket.on('playerLeft', leftPlayer => {
    const leftSound = new sound("/sfx/leaveGame.mp3");
    leftSound.play();

    // Elimina al jugador que ha abandonado el juego del #player-container
    playerContainer.removePlayer(leftPlayer);

    // Añade un mensaje a la caja de chat para notificar que el jugador se ha ido con el emoji 😢
    addContentToChat(undefined, `${leftPlayer} ha abandonado el juego 😢`, "red");
});

// Evento para recibir la actualización del puntaje de los jugadores desde el servidor
socket.on('scoreBoard', scoreBoard => {
    scoreBoard.forEach(ele => {
        playerContainer.updatePlayerScore(ele[0], ele[1]);
    });
});

// Evento para recibir el jugador seleccionado para dibujar desde el servidor
socket.on('chosenPlayer', drawingPlayer => {
    document.querySelector('.voting').innerHTML = votingDiv;
    guessedPlayer = false;

    // Unhighlight all players before highlighting
    playerContainer.getPlayers().forEach(element => {
        playerContainer.unhighlightPlayer(element);
    });

    playerContainer.highlightPlayer(drawingPlayer);
    console.log('Jugador seleccionado para dibujar: ', drawingPlayer);

    // Agregar contenido al chat para indicar al jugador que va a dibujar
    addContentToChat(undefined, `${drawingPlayer} va a dibujar`, "blue");

    if (drawingPlayer === pName) {
        // Si el jugador actual es el que va a dibujar, mostrar la interfaz de dibujo
        document.querySelector('.voting').innerHTML = '';
        canDraw = true;
    } else {
        // Si el jugador actual no es el que va a dibujar, mostrar un mensaje
        canDraw = false;
        loginContainer.innerHTML = `
            <div class="loginArea">
                <h1 class="fs-20">${drawingPlayer} está eligiendo una palabra...</h1>
                <img width="50px"  src="/images/loadingGif.gif">
            </div>
        `;
    }
});

// Funciones de utilidad:

// Función para cambiar el estado de silencio de audio
function audioToggle() {
    audioMute = !audioMute;
    if (audioMute) {
        document.getElementById('audioControl').src = "images/audioOff.gif"
    } else {
        document.getElementById('audioControl').src = "images/audioOn.gif"
    }
}

// Función para generar un nombre de jugador aleatorio
function randomNameGen() {

    fetch('./data/nameList.json')
        .then(response => response.json())
        .then(data => {
            const nameList = data;
            if (nameList.length === 0) {
                throw new Error('The nameList is empty.');
            }

            const randomName = nameList[Math.floor(Math.random() * nameList.length)];
            document.getElementById('playerName').value = randomName;
        })
        .catch(error => {
            console.error('Error reading or parsing nameList:', error.message);
        });
}

// Función para iniciar sesión en el juego
function loginToGame() {
    pName = playerName.value;
    document.title = `Draw Quest | ${pName}`;
    if (pName.length > 0 && pName !== "" && pName != " ") {
        enableChat();
        pName = pName.trim();
        socket.connect();
        playerContainer.addPlayer(pName, 0);
        socket.emit('playerName', pName)
        loginContainer.style.height = "200px";
        loginContainer.innerHTML = waitingDiv;
        chatText.focus();
    } else {
        console.log("INVALID LOGIN!");
    }
}

// Función para la cuenta regresiva del tiempo
function timer(timerVal) {
    const timerText = document.getElementById('countdown');
    let counter = parseInt(timerVal);

    const clockTick = new Audio("/sfx/clockTick.mp3"); // Crear objeto de sonido una vez

    function updateTimer() {
        timerText.innerText = `${counter}`;

        if (counter < 10) {
            clockTick.play(); // Reproducir el sonido directamente
        }

        if (counter === 0) {
            clearInterval(timerFunc);
            timerFunc = null;
        }

        counter--;
    }

    updateTimer(); // Mostrar el valor inicial sin esperar al primer segundo

    let timerFunc = setInterval(updateTimer, 1000);

    return timerFunc;
}

// Función para seleccionar una palabra
function selectedOpt(chosenWord, autoSelected = false) {
    if (!autoSelected) {
        socket.emit('chosenWord', chosenWord);
    }
    loginContainer.innerHTML = "";
    guessField.innerHTML = `Dibujar:  <span>${chosenWord}</span>`;
}

socket.on('wordCount', guessWordCount => {
    if (!canDraw) {
        var dashStr = "";
        guessField.innerHTML = "Dibujar: ";
        dashStr = "(" + String(guessWordCount) + "): ";
        for (let count = 0; count < guessWordCount; count++) {
            dashStr += "_ ";
        }
        guessField.innerHTML += dashStr;
    }
});

socket.on('allGuessed', () => {
    var allGuessed = new sound("/sfx/allGuess.mp3");
    allGuessed.play();
});

socket.on('otherPOS', position => {
    recieveTick++;
    paint = true;
    ctx.beginPath();

    ctx.lineWidth = position.brushsize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = penColor;
    if (recieveTick == 1) {
        ctx.moveTo(position.x, position.y);
    } else {
        ctx.moveTo(coord.x, coord.y);
    }
    ctx.lineTo(position.x, position.y);
    coord.x = position.x;
    coord.y = position.y;
    ctx.stroke();
    paint = false;
});

// Evento cuando se termina el dibujo
socket.on('drawEnd', () => {
    clearInterval(drawTimerReset);
    canDraw = false;
    clearCanvas();
    if (!atleastOneGuessed) {
        const noGuessSound = new sound("/sfx/noGuess.mp3");
        noGuessSound.play();
    }
});

socket.on('maxRounds', maxRounds => {
    // Actualizar la vista con el número máximo de rondas
    document.getElementById('maxRounds').innerText = `${maxRounds}`;
});

socket.on('currentRound', currentRound => {
    // Actualizar la vista con el número de rondas actuales
    document.getElementById('currentRound').innerText = `${currentRound}`;
});

// Eventos adicionales:

// Evento cuando se desconecta del servidor
socket.on("disconnect", () => {
    socket.disconnect();
    loginContainer.innerHTML = loginDiv;
    location.reload();
});
