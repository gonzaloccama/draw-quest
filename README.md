# draw-quest
El código es la implementación del servidor para un juego en tiempo real llamado "Draw Quest". El juego es una versión simplificada del popular juego en línea "Skribbl.io", donde varios jugadores compiten en rondas para adivinar la palabra que otro jugador está dibujando. A continuación, se describen las principales características y mecánicas del juego:

Registro de jugadores: Los jugadores pueden unirse al juego proporcionando un nombre de jugador único. Cada jugador se representa mediante la clase Player, que contiene información como el nombre del jugador, el ID del socket asociado, si es el dueño de la sala y su puntuación.

Elección de palabras y dibujo: El juego consiste en varias rondas. En cada ronda, un jugador se elige al azar para ser el dibujante, mientras que los demás jugadores son los adivinadores. El dibujante elige una palabra de una lista de palabras generadas al azar. El dibujante tiene un tiempo limitado para dibujar la palabra seleccionada, mientras que los adivinadores intentan adivinarla.

Comunicación en tiempo real: Los jugadores pueden comunicarse en tiempo real a través de un chat de texto. Los mensajes enviados en el chat pueden contener adivinanzas o comandos especiales para el administrador del juego.

Puntuación y rondas: Los jugadores ganan puntos cuando adivinan correctamente la palabra dibujada por el dibujante. La puntuación se calcula según el orden en que los jugadores adivinan correctamente y el número de rondas jugadas. El juego se juega en un número predefinido de rondas, y el jugador con la puntuación más alta al final de las rondas es el ganador.

Administración del juego: El administrador del juego tiene comandos especiales para realizar acciones como expulsar jugadores, otorgar puntos, cambiar el tiempo de dibujo y más.

Actualización en tiempo real: La información del juego, como la lista de jugadores, el jugador actual dibujante, las palabras disponibles, las adivinanzas correctas y el marcador, se actualizan en tiempo real para todos los jugadores a través del uso de sockets.
