const express = require('express');
const Socket = require('socket.io');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const fs = require('fs');

const chooseWordTime = 20; // in seconds
const drawTime = 80; // in seconds
const chatAdminPWD = "admin";

app.use(express.static('public'));

class Player {
    constructor(playerName, socID, isRoomOwner = false) {
        this.playerName = playerName;
        this.socID = socID;
        this.isRoomOwner = isRoomOwner;
        this.score = 0;
    }

    getPlayerSocID() {
        return this.socID;
    }

    getPlayerName() {
        return this.playerName;
    }

    getIsRoomOwner() {
        return this.isRoomOwner;
    }

    setScore(val) {
        this.score = val;
    }

    getScore() {
        return this.score;
    }
}

const players = [];
const socs = new Set();
let playerIndex = 0;
let hasGameStarted = false;
let wordToDraw = null;
let cancelChooseWordTimer;
let cancelDrawTimer = null;
let chosenPlayer;
let guessersList = [];
let scoreBoard = [];
const playersList = {}; // Initialize playersList as an empty object

const maxRounds = 4; // Cambia 10 por el número máximo de rondas que desees tener
let currentRound = 0; // Agrega una variable para rastrear el número de rondas actuales

function random_word_gen() {
    try {
        const wordlistData = fs.readFileSync('./public/data/wordlist.json');
        const wordlist = JSON.parse(wordlistData);

        if (wordlist.length === 0) {
            throw new Error('The wordlist is empty.');
        }

        return wordlist[Math.floor(Math.random() * wordlist.length)];
    } catch (err) {
        console.error('Error reading or parsing wordlist:', err.message);
        return null;
    }
}


io.on('connection', socket => {
    console.log('A user connected:', socket.id);
    socs.add(socket);

    socket.on('playerName', pName => {
        const existingPlayer = players.find(p => p.getPlayerName() === pName);
        if (existingPlayer) {
            socket.disconnect();
            return;
        }

        const newPlayer = new Player(pName, socket, players.length === 0);
        if (players.length === 0) {
            socket.emit('hostPlayer', true);
        }
        players.push(newPlayer);
        playersList[pName] = 0;

        socket.broadcast.emit('newPlayerJoined', pName);
        socket.emit('playersList', JSON.stringify(playersList));
    });

    if (hasGameStarted) {
        socket.emit('gameStarted');
    }

    socket.emit('welcom', "welcome to skribbl");

    socket.on('position', position => {
        socket.broadcast.emit('otherPOS', position);
    });

    socket.on('startPaint', paint => {
        socket.broadcast.emit('startPaint', paint);
    });

    socket.on('startGame', () => {
        socket.broadcast.emit('gameStarted');
        hasGameStarted = true;
        gameStart();
    });

    socket.on('penColor', hexValue => {
        io.sockets.emit('penColor', hexValue);
    });

    socket.on('clearCanvas', () => {
        io.sockets.emit('clearCanvas');
    });

    socket.on('vote', status => {
        io.sockets.emit('vote', status);
    });

    socket.on('chosenWord', cWord => {
        wordToDraw = cWord;
        io.sockets.emit('wordCount', cWord.length);
        cancelChooseWordTimer();
    });

    socket.on('updateText', receivedMsg => {
        if (wordToDraw !== null) {
            const formattedWord = receivedMsg[1].toLowerCase().trim();
            const formattedGuessWord = wordToDraw.toLowerCase().trim();

            if (receivedMsg[1].includes("//admin")) {
                adminControl(receivedMsg[1]);
            }

            if (formattedGuessWord === formattedWord && !guessersList.includes(receivedMsg[0]) && players.length > 1) {
                io.sockets.emit('correctGuess', [receivedMsg[0], wordToDraw]);
                guessersList.push(receivedMsg[0]);
            } else if (receivedMsg[1].includes(wordToDraw) && receivedMsg[1].length <= wordToDraw.length + 1 && !guessersList.includes(receivedMsg[0])) {
                io.sockets.emit('chatContent', receivedMsg);
                io.sockets.emit('chatContent', [receivedMsg[0], "almost"]);
            } else if (!receivedMsg[1].includes("//admin")) {
                io.sockets.emit('chatContent', receivedMsg);
            }

            if (guessersList.length === players.length - 1 && cancelDrawTimer !== null) {
                io.sockets.emit('allGuessed');
                cancelDrawTimer();
            }
        }
    });


    function adminControl(command) {
        const commands = command.split(" ");
        if (commands[1] === chatAdminPWD) {
            if (commands[2] === "kickall") {
                socs.forEach(s => {
                    s.disconnect(true);
                });
                console.log(">Admin kicked all players.");
            } else if (commands[2] === "kick") {
                players.forEach(p => {
                    if (p.getPlayerName() === commands[3]) {
                        socs.forEach(soc => {
                            if (p.getPlayerSocID().id === soc.id) {
                                soc.disconnect();
                                io.sockets.emit('chatContent', ["kick", commands[3]]);
                                console.log(`>Admin kicked ${commands[3]}`);
                            }
                        });
                    }
                });
            } else if (commands[2] === "givePoints") {
                players.forEach(p => {
                    if (p.getPlayerName() === commands[3]) {
                        p.setScore(parseInt(commands[4]));
                        console.log(`>Admin added ${commands[4]}Points to ${commands[3]}`);
                    }
                });
            } else if (commands[2] === "setdrawtime") {
                const oldDrawTime = drawTime;
                drawTime = parseInt(commands[3]);
                console.log(`>Admin set draw time from ${oldDrawTime} to ${commands[3]}`);
            } else if (commands[2] === "setchoosetime") {
                const oldChooseTime = chooseWordTime;
                chooseWordTime = parseInt(commands[3]);
                console.log(`>Admin set time to choose word from ${oldChooseTime} to ${commands[3]}`);
            } else if (command[2] === "restart") {
                socket.broadcast.emit('gameStarted');
                hasGameStarted = true;
                gameStart();
            }
        }
    }

    socket.on('disconnect', () => {
        console.log('A user disconnected: ', socket.id);
        const disconnectedPlayer = players.find(p => p.getPlayerSocID().id === socket.id);
        if (disconnectedPlayer) {
            if (chosenPlayer === disconnectedPlayer.getPlayerName()) {
                if (cancelChooseWordTimer !== null && cancelDrawTimer !== null) {
                    cancelChooseWordTimer();
                    cancelDrawTimer();
                    console.log("Drawing player left...");
                }
            }

            if (disconnectedPlayer.isRoomOwner) {
                hasGameStarted = false;
                socs.forEach(s => {
                    s.disconnect(true);
                });
                if (cancelChooseWordTimer !== null && cancelDrawTimer !== null) {
                    cancelChooseWordTimer();
                    cancelDrawTimer();
                }
            }
            socket.broadcast.emit('playerLeft', disconnectedPlayer.getPlayerName());
            const index = players.indexOf(disconnectedPlayer);
            if (index > -1) {
                players.splice(index, 1);
                delete playersList[disconnectedPlayer.getPlayerName()];
            }
        }
    });

    async function chooseWordtimer() {
        return new Promise((resolve) => {
            cancelChooseWordTimer = resolve;
            const t = setTimeout(() => {
                resolve();
                clearTimeout(t);
            }, (chooseWordTime * 1000) + 10);
        });
    }

    async function Drawingtimer() {
        return new Promise((resolve) => {
            cancelDrawTimer = resolve;
            const t = setTimeout(() => {
                resolve();
                clearTimeout(t);
            }, (drawTime * 1000) + 10);
        });
    }

    async function Fun() {
        cancelChooseWordTimer = null;
        cancelDrawTimer = null;
        guessersList = [];
        scoreBoard = [];
        io.sockets.emit('chooseStart', chooseWordTime);
        await chooseWordtimer();
        io.sockets.emit('chooseEnd');
        if (wordToDraw === null) {
            wordToDraw = wordOptions[0];
            console.log("AUTO CHOSEN WORD: ", wordToDraw);
            io.sockets.emit('wordCount', wordToDraw.length);
            io.sockets.emit('chosenWord', [wordToDraw, chosenPlayer]);
        }
        io.sockets.emit("drawStart", drawTime);
        await Drawingtimer();
        io.sockets.emit('drawEnd');

        function calculateScore(playerIndex) {
            if (playerIndex === 0) {
                return 300;
            } else {
                const baseScore = 290;
                const scoreReduction = (playerIndex - 1) * 10;
                return baseScore - scoreReduction;
            }
        }

        for (let i = 0; i < guessersList.length; i++) {
            const player = guessersList[i];
            const score = calculateScore(i);
            players.forEach(element => {
                if (element.getPlayerName() === guessersList[i]) {
                    const s = element.getScore() + score;
                    element.setScore(s);
                    scoreBoard.push([element.getPlayerName(), element.getScore()]);
                }
                if (element.getPlayerName() === chosenPlayer && guessersList.length !== 0) {
                    scoreBoard.push([chosenPlayer, element.getScore() + 100]);
                }
            });
        }

        io.sockets.emit('scoreBoard', scoreBoard);

        gameStart();
    }

    function gameStart() {
        wordToDraw = null;
        wordOptions = [];

        // Después de incrementar currentRound, enviar el nuevo valor al cliente
        io.sockets.emit('currentRound', currentRound);

        if (currentRound < maxRounds && players.length > 0) {
            chosenPlayer = players[playerIndex % players.length].getPlayerName();

            for (let i = 0; i < 3; i++) {
                let genWord = random_word_gen();
                if (!wordOptions.includes(genWord)) {
                    wordOptions.push(genWord);
                } else {
                    wordOptions.push(random_word_gen());
                }
            }
            io.sockets.emit('chosenPlayer', chosenPlayer);
            io.sockets.emit('wordList', wordOptions);
            playerIndex++;
            currentRound++; // Incrementa el número de rondas actuales
            Fun();
        } else {
            console.log("FIN DEL JUEGO...");
            io.sockets.emit('gameOver');
        }

    }

    // Agrega la siguiente línea para enviar el valor de `maxRounds` al cliente
    io.sockets.emit('maxRounds', maxRounds);

    // Agrega la siguiente línea para enviar el valor de `currentRound` al cliente en tiempo real
    io.sockets.emit('currentRound', currentRound);


});

// Start the server
const port = 3000;
server.listen(port, () => {
    console.log(`🎮 Escuchando en el puerto ${port}...`);
    console.log(`🌐 Ingresa a -> http://localhost:${port} para jugar :)`);
});
